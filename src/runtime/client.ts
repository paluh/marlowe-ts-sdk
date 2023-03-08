import * as A from 'fp-ts/Array';
import * as ACL from './internal/anticorruptionlayer';
import { contractHeaderMapper,rolesConfigurationMapper } from './internal/anticorruptionlayer';
import { ErrorResponse, GetContractsResponse, contractsEndpoint } from './internal/restAPI';
import { Address, FetchResult, MintRoleTokenSimpleConfiguration,Collateral, Metadatum, ContractHeader, ContractId, MarloweTx } from './model/common';
import * as Internal from './internal/restAPI';
import { matchI } from 'ts-adt';
import { pipe } from 'fp-ts/function';
import axios from 'axios';
import * as DSL from '../dsl';
import curlirize from 'axios-curlirize';
import JSONbigint from 'json-bigint'
import * as TE from 'fp-ts/TaskEither'

JSON.stringify = JSONbigint.stringify;

(BigInt.prototype as any).toJSON = function () {
  return (JSONbigint.stringify(this));
};



(Map.prototype as any).toJSON = function () {
  return Object.fromEntries(this)
}

type FilterByContractHeader = (header: ContractHeader) => boolean;

export class ContractTxBuilder {
  private restClient;
  
  public constructor (baseURL: string) {
    const instance = axios.create({
      baseURL,
      headers: { Accept: 'application/json', ContentType: 'application/json' }
    });
   

    // instance.interceptors.response.use((response) => {
    //   response.data = JSONbigint.parse(response.data)
    //   return response
    // });

    curlirize(instance);
    this.restClient = Internal.RestClient(instance);
  }

  public create 
          ( contract : DSL.Contract
          , roles: MintRoleTokenSimpleConfiguration
          , change: Address
          , collateral?: Collateral[]
          , usedAddresses?:Address[] ) : TE.TaskEither<Error,[ContractId,MarloweTx]>  {
    const request : Internal.PostContractsRequest 
      = { contract: contract
        , roles: ACL.rolesConfigurationMapper.to(roles)
        , version: 'v1'
        , metadata: new Map<bigint, Metadatum>([[1985n , "test"]])
        , minUTxODeposit: 3_000_000
        , changeAddress: change
        , addresses: usedAddresses
        , collateralUTxOs: collateral
    }
    return pipe( this.restClient.contracts.post(contractsEndpoint,request)
               , TE.map((postContractsResponse) =>
                    [ postContractsResponse.contractId
                    , ACL.contractTxMapper.from(postContractsResponse.tx)]));
  }

  public submit (contractId : ContractId, txSigned: string) : TE.TaskEither<Error,any>  {
    return this.restClient.contract.put(contractId,{type:"ShelleyTxWitness BabbageEra", description:"",cborHex:txSigned})
  }
}

// contract: {
//   txBuilder: {
//     creation: (input: PostContractsRequest) => Promise<PostContractsResponse | ErrorResponse>;
//   };
//   header: {
//     filterBy: (predicate: FilterByContractHeader) => Promise<ContractHeader[]>;
//     all: () => Promise<ContractHeader[]>;
//   };
// };

export const MarloweRuntimeClient = function (baseURL: string) {
  const restClient = Internal.RestClient(
    axios.create({
      baseURL,
      headers: { Accept: 'application/json', ContentType: 'application/json' }
    })
  );

  const filterByContractHeader = async (predicate: FilterByContractHeader) => {
    const headers: ContractHeader[] = [];
    const step = async function (result: FetchResult<ErrorResponse, GetContractsResponse>) {
      await matchI(result)({
        success: async ({ data }) => {
          headers.push(...pipe(data.itemsWithinCurrentRange, A.map(ACL.contractHeaderMapper.from), A.filter(predicate)));
          if (data.nextRange) {
            await step(await restClient.contracts.get(contractsEndpoint, data.nextRange));
          }
        },
        failure: async ({ details }) => console.log('Error:', details)
      });
    };
    const response = await restClient.contracts.get(contractsEndpoint);
    await step(response);
    return headers;
  };

  return {
    contract: {
      header: {
        filterBy: async (predicate: FilterByContractHeader) => filterByContractHeader(predicate),
        all: async () => filterByContractHeader(() => true)
      }
    }
  };
};


// import * as A from 'fp-ts/Array';
// import * as ACL from '../src/runtime/internal/anticorruptionlayer';
// import { ContractHeader } from '../src/runtime/model/contract/header';
// import { DSL, Examples } from '@cardano-sdk/dsl';
// import { ErrorResponse, GetContractsResponse, contractsEndpoint } from '../src/runtime/internal/restAPI';
// import { FetchResult } from '../src/runtime/model/common';
// import { Internal } from '../src/runtime';
// import { matchI } from 'ts-adt';
// import { pipe } from 'fp-ts/function';
// import axios from 'axios';
// import * as ADA from '../src/common/ada'
// import { Configuration, getPrivateKeyFromHexString, SingleAddressAccount} from '../src/common/blockfrost'

// describe('@marlowe-runtime-client',  () => {
//   // const baseUrl = 'http://0.0.0.0:32777';
  

//   // describe('@marlowe-dsl-examples', () => {
//   //   it('runs the swap contract', async () => {
//   //     // const swap: DSL.Contract = Examples.swap;
//   //     const marloweRuntime = MarloweRuntimeClient(baseUrl);
//   //     const headers = await marloweRuntime.contract.header.all();
//   //     expect(headers.length).toBeGreaterThan(0);
//   //   }, 30_000);
//   // });
//   describe('Contract Headers', () => {
//     it('can all be fetched', async () => {
//       const configuration = new Configuration ('preprodrj4joQQ9n2iGp7IjBh39DoxnomNvsNRl'
//                                               ,'https://cardano-preprod.blockfrost.io/api/v0'
//                                               ,'Preprod');
//       const bank = await SingleAddressAccount.Initialise (configuration,getPrivateKeyFromHexString('5820e09f58cd4b2793ff35281c36af06760d4ab993829c7a1d3b29db2947576339b1'))
//       const ownerAccount = await SingleAddressAccount.Random(configuration);
//       const recipientAccount = await SingleAddressAccount.Random(configuration);
        
//       bank.ADABalance().then ((amount) => {
//         console.log('Bank public key:', bank.address);
//         console.log('Balance:', ADA.format(amount));
//         expect(amount).toBeGreaterThan(100_000_000)
//       });
      
//       await Promise.all([bank.provision(ownerAccount,10_000_000),bank.provision(recipientAccount,10_000_000)]);

//       ownerAccount.ADABalance().then ((amount) => {
//         console.log('Owner public key:', ownerAccount.address);
//         console.log('Balance:', ADA.format(amount));
//         expect(amount).toBeGreaterThan(10_000_000)
//       });

//       recipientAccount.ADABalance().then ((amount) => {
//         console.log('Owner public key:', ownerAccount.address);
//         console.log('Balance:', ADA.format(amount));
//         expect(amount).toBeGreaterThan(10_000_000)
//       });      
//     }); // too slow
//     // it('can be filtered (e.g : filtering not empty metadata)', async () => {
//     //   const marloweRuntime = MarloweRuntimeClient(baseUrl);
//     //   const notEmptyMetadata = (header: ContractHeader): boolean => !M.isEmpty(header.metadata);
//     //   const headersWithNotEmptyMetadata = await marloweRuntime.contract.header.filterBy(notEmptyMetadata);
//     //   headersWithNotEmptyMetadata.map((header) => {
//     //     expect(header.metadata).not.toEqual(new Map<bigint, Metadatum>());
//     //   });
//     // }, 30_000); // too slow
//     // it('can be filtered (e.g : filtering empty metadata)', async () => {
//     //   const marloweRuntime = MarloweRuntimeClient(baseUrl);
//     //   const emptyMetadata = (header: ContractHeader): boolean => M.isEmpty(header.metadata);
//     //   const headersWithEmptyMetadata = await marloweRuntime.contract.header.filterBy(emptyMetadata);
//     //   headersWithEmptyMetadata.map((header) => {
//     //     expect(header.metadata).toEqual(new Map<bigint, Metadatum>());
//     //   });
//     // }, 30_000); // too slow
//   });
// });

