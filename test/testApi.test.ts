/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable sort-keys-fix/sort-keys-fix */
/* eslint-disable promise/no-nesting */
/* eslint-disable promise/catch-or-return */
/* eslint-disable promise/always-return */
/* eslint-disable no-console */
/* eslint-disable no-use-before-define */

import * as A from 'fp-ts/Array';
import * as ACL from '../src/client/internal/anticorruptionlayer';
import * as M from 'fp-ts/Map';
import { Blockfrost, Lucid, C } from 'lucid-cardano';
import { ContractHeader } from '../src/client/model/contract/header';
// import { DSL, Examples } from '@cardano-sdk/dsl';
import { ErrorResponse, GetContractsResponse, contractsEndpoint } from '../src/client/internal/restAPI';
import { FetchResult, Metadatum } from '../src/client/model/common';
import { Internal } from '../src/client/';
import { matchI } from 'ts-adt';
import { pipe } from 'fp-ts/function';
import axios from 'axios';
import * as ADA from '../src/common/ada'
import { e2eAPI} from '../src/common/blockfrost'

describe('@marlowe-runtime-client',  () => {
  const baseUrl = 'http://0.0.0.0:32777';
  

  // describe('@marlowe-dsl-examples', () => {
  //   it('runs the swap contract', async () => {
  //     // const swap: DSL.Contract = Examples.swap;
  //     const marloweRuntime = MarloweRuntimeClient(baseUrl);
  //     const headers = await marloweRuntime.contract.header.all();
  //     expect(headers.length).toBeGreaterThan(0);
  //   }, 30_000);
  // });
  describe('Contract Headers', () => {
    it('can all be fetched', async () => {
      
      const api = await e2eAPI.Init
        ('preprodrj4joQQ9n2iGp7IjBh39DoxnomNvsNRl'
        ,'https://cardano-preprod.blockfrost.io/api/v0'
        ,'Preprod'
        ,'5820e09f58cd4b2793ff35281c36af06760d4ab993829c7a1d3b29db2947576339b1');
       
      api.bankADATreasuryAmount().then (([address, adaAmount]) => {
        console.log('Bank public key: ', address);
        console.log('Money in the Bank :', ADA.format(adaAmount));
        expect(adaAmount).toBeGreaterThan(100_000_000)
      });
      
      
    }, 30_000); // too slow
    it('can be filtered (e.g : filtering not empty metadata)', async () => {
      const marloweRuntime = MarloweRuntimeClient(baseUrl);
      const notEmptyMetadata = (header: ContractHeader): boolean => !M.isEmpty(header.metadata);
      const headersWithNotEmptyMetadata = await marloweRuntime.contract.header.filterBy(notEmptyMetadata);
      headersWithNotEmptyMetadata.map((header) => {
        expect(header.metadata).not.toEqual(new Map<bigint, Metadatum>());
      });
    }, 30_000); // too slow
    it('can be filtered (e.g : filtering empty metadata)', async () => {
      const marloweRuntime = MarloweRuntimeClient(baseUrl);
      const emptyMetadata = (header: ContractHeader): boolean => M.isEmpty(header.metadata);
      const headersWithEmptyMetadata = await marloweRuntime.contract.header.filterBy(emptyMetadata);
      headersWithEmptyMetadata.map((header) => {
        expect(header.metadata).toEqual(new Map<bigint, Metadatum>());
      });
    }, 30_000); // too slow
  });
});

type FilterByContractHeader = (header: ContractHeader) => boolean;

export interface MarloweRuntimeAPI {
  contract: {
    // txBuilder: {
    //   creation: (input: PostContractsRequest) => Promise<PostContractsResponse | ErrorResponse>;
    // };
    header: {
      filterBy: (predicate: FilterByContractHeader) => Promise<ContractHeader[]>;
      all: () => Promise<ContractHeader[]>;
    };
  };
}

const MarloweRuntimeClient = function (baseURL: string): MarloweRuntimeAPI {
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
          headers.push(...pipe(data.itemsWithinCurrentRange, A.map(ACL.convert), A.filter(predicate)));
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
