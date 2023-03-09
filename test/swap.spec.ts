
import * as ADA from '../src/common/ada'
import axios, { AxiosError, isAxiosError } from 'axios';
import { Circus } from '@jest/types';
import { datetoTimeout } from '../src/common/date'
import { Configuration, getPrivateKeyFromHexString, SingleAddressAccount, Asset} from '../src/common/blockfrost'
import { some, none, getOrElse, throwError } from 'fp-ts/Option'
import { constVoid, pipe } from 'fp-ts/function'
import * as DSL from '../src/dsl';
import * as Examples from '../src/examples';
import { addDays, addHours,addMinutes } from 'date-fns/fp'
import { addYears, formatWithOptions } from 'date-fns/fp'
import { eo } from 'date-fns/locale'
import { ContractTxBuilder, MarloweRuntimeClient } from '../src/runtime/client'
import { Close, coerceNumber } from '../src/dsl'
import { log } from '../src/common/logging'
import { Address, RoleName, rolesConfiguration } from '../src/runtime/model/common'
import JSONbigint from 'json-bigint'
import * as TE from 'fp-ts/TaskEither'
import * as T from 'fp-ts/Task'
import * as E from 'fp-ts/Either'
import { fromHex, C, Core, toHex } from 'lucid-cardano';
import { contractsEndpoint, PostContractsRequest, PostContractsResponse, PutContractRequest, RestClient, RestClientAPI } from '../src/runtime/internal/restAPI';
import { matchI } from 'ts-adt';
import { Blockfrost, Lucid } from 'lucid-cardano';


let describeIf = (condition:boolean, name:string, fun:Circus.BlockFn) => condition? describe(name, fun):describe.skip(name, fun);

const baseURL = process.env.MARLOWE_WEB_SERVER_URL;
const blockfrostProjectID = process.env.BLOCKFROST_PROJECT_ID;
const mnemonicPhrase = process.env.MNEMONIC_PHRASE;

describeIf(typeof baseURL != "undefined" && typeof blockfrostProjectID != "undefined" && typeof mnemonicPhrase != "undefined", 'internal/restClientAPI',  () => {
  const axiosRequest = axios.create({
      baseURL,
      headers: { ContentType: 'application/json', Accept: 'application/json' }
  });
  const client : RestClientAPI = RestClient(axiosRequest);

  test("contracts.get fetches non empty page", async () => {
    let response = await client.contracts.get(contractsEndpoint);
    return matchI(response)({
      success: (a) => {
        expect(a.data.itemsWithinCurrentRange.length).toBeGreaterThan(0);
      },
      failure: (_) => { throw new Error("Contracts endpoint failed:" ); }
    });
  });

  test("constracts.post returns correct transaction cborHex", async () => {
    let request : PostContractsRequest = {
      contract: Close,
      minUTxODeposit: 2000000,
      changeAddress: "addr_test1vq0acgkfkgeeuezdy2fn2y5mxhn9zcvrjesxxen4k2d2t2qdwp3ce",
      version: 'v1',
      metadata: new Map([[1985n , "test"]])
    };
    let result = await (pipe(
        client.contracts.post(contractsEndpoint, request)
        , TE.map((postContractsResponse) => {
            // This throws if cbor is invalid
            C.Transaction.from_bytes(fromHex(postContractsResponse.tx.cborHex));
        }))());
    pipe(result, E.match(
      (e) => { console.log(e); },
      (res) => { console.log(res); }
    ));
  });

  test("contracts.put accepts witness set", async () => {
    let blockfrostProvider = new Blockfrost("https://cardano-preview.blockfrost.io/api/v0", blockfrostProjectID)
    let lucid = await Lucid.new(blockfrostProvider, "Preview");
    lucid.selectWalletFromSeed(mnemonicPhrase as string);

    let address = await lucid.wallet.address();

    let request : PostContractsRequest = {
      contract: Close,
      minUTxODeposit: 2000000,
      changeAddress: address,
      version: 'v1',
      //metadata: new Map(),
      metadata: new Map([[1985n , "test"]])
    };
    let result = await (pipe(
        client.contracts.post(contractsEndpoint, request)
        , TE.chain((postContractsResponse) => {
            // This throws if cbor is invalid
            let tx = C.Transaction.from_bytes(fromHex(postContractsResponse.tx.cborHex));
            let txWitness = lucid.wallet.signTx(tx);
            return TE.tryCatch(() => txWitness.then((w) => {
              // We can free allocated tx after we have witness set
              tx.free();
              return { witnessSet: w, endpoint: postContractsResponse.endpoint};
            }), E.toError);
        })
        , TE.chain(({ witnessSet, endpoint }) => {
          let witnessSetCborHex = toHex(witnessSet.to_bytes());
          witnessSet.free();

          let envelope: PutContractRequest = {
            "type": "ShelleyTxWitness BabbageEra",
            "description": "",
            "cborHex": witnessSetCborHex
          };
          return client.contract.put(endpoint, envelope);
        })
    )());
    pipe(result, E.match(
      (e: Error | AxiosError) => {
        if(isAxiosError(e)) {
          throw new Error("API failure: status = " + e.response?.status + ", message = " + JSON.stringify(e.response?.data));
        } else {
          throw new Error("API failure: message = " + e.message);
        }
      },
      (_) => { }
    ));
  });

  test("contracts.put accepts transaction", async () => {
    let blockfrostProvider = new Blockfrost("https://cardano-preview.blockfrost.io/api/v0", blockfrostProjectID)
    let lucid = await Lucid.new(blockfrostProvider, "Preview");
    lucid.selectWalletFromSeed(mnemonicPhrase as string);

    let address = await lucid.wallet.address();

    let request : PostContractsRequest = {
      contract: Close,
      minUTxODeposit: 2000000,
      changeAddress: address,
      version: 'v1',
      //metadata: new Map(),
      metadata: new Map([[1985n , "test"]])
    };
    let result = await (pipe(
        client.contracts.post(contractsEndpoint, request)
        , TE.chain((postContractsResponse) => {
            // This throws if cbor is invalid
            let tx = C.Transaction.from_bytes(fromHex(postContractsResponse.tx.cborHex));
            let mkWitnessSet = lucid.wallet.signTx(tx);

            return TE.tryCatch(() => mkWitnessSet.then((newWitnessSet) => { return { newWitnessSet, tx, endpoint: postContractsResponse.endpoint };}), E.toError);
        })
        , TE.chain(({ newWitnessSet, endpoint, tx }) => {
          let txWitnessSetBuilder = C.TransactionWitnessSetBuilder.new();
          let oldWitnessSet = tx.witness_set();
          txWitnessSetBuilder.add_existing(oldWitnessSet);
          txWitnessSetBuilder.add_existing(newWitnessSet);

          let fullWitnessSet = txWitnessSetBuilder.build();
          let txBody = tx.body();
          let auxiliaryData = tx.auxiliary_data();
          let signedTransaction = C.Transaction.new(txBody, fullWitnessSet, auxiliaryData);
          let txCborHex = toHex(signedTransaction.to_bytes());
          let envelope: PutContractRequest = {
            "type": "Tx BabbageEra",
            "description": "",
            "cborHex": txCborHex
          };

          newWitnessSet.free();
          oldWitnessSet.free();
          txWitnessSetBuilder.free();
          fullWitnessSet.free();
          txBody.free();
          auxiliaryData?.free();
          signedTransaction.free();

          return client.contract.put(endpoint, envelope);
        })
    )());
    pipe(result, E.match(
      (e: Error | AxiosError) => {
        if(isAxiosError(e)) {
          throw new Error("API failure: status = " + e.response?.status + ", message = " + JSON.stringify(e.response?.data));
        } else {
          throw new Error("API failure: message = " + e.message);
        }
      },
      (_) => { }
    ));
  });

});


// describe('swap', () => {
//   it('can execute the nominal case', async () => {
//     log('#######################')
//     log('# Swap : Nominal Case #')
//     log('#######################')
//     
//     log('#########')
//     log('# Setup #')
//     log('#########')
// 
//     const configuration = new Configuration ('previewcz3TyjIzynbADHOoV3K9i9yK1zIvMVzP'
//                                             ,'https://cardano-preview.blockfrost.io/api/v0'
//                                             ,'Preview');
//     const bank = await SingleAddressAccount.Initialise (configuration,getPrivateKeyFromHexString('5820e09f58cd4b2793ff35281c36af06760d4ab993829c7a1d3b29db2947576339b1'))
//     const adaProviderAccount = await SingleAddressAccount.Random(configuration);
//     const expectdAmountProvisionnedforAdaProvider = 10_000_000n
//     const tokenProviderAccount = await SingleAddressAccount.Random(configuration);
//     const expectdAmountProvisionnedforTokenProvider = 10_000_000n
//     const tokenName = "TokenA"  
//     const expectedTokenAmount = 50n
// 
//     await bank.adaBalance().then ((amount) => {
//       log(`Bank public key: ${bank.address}`);
//       log(`Balance: ${ADA.format(amount)}`);
//       expect(amount).toBeGreaterThan(100_000_000)
//     });
//     
//     await bank.provision(new Map<SingleAddressAccount,BigInt> ([[adaProviderAccount,expectdAmountProvisionnedforAdaProvider],
//                                                                 [tokenProviderAccount,expectdAmountProvisionnedforTokenProvider]])) ();
// 
//     await adaProviderAccount.adaBalance().then ((amount) => {
//       log(`Ada Provider Address : ${adaProviderAccount.address}`);
//       log(`Balance: ${ADA.format(amount)}`);
//       expect(amount).toBe(expectdAmountProvisionnedforAdaProvider);
//     })
// 
//     await tokenProviderAccount.adaBalance().then ((amount) => {
//       log(`Token Provider Address: ${tokenProviderAccount.address}`);
//       log(`Balance: ${ADA.format(amount)}`);
//       expect(amount).toBe(expectdAmountProvisionnedforTokenProvider);
//     }); 
//     const policyRefs = tokenProviderAccount.randomPolicyId ();
//     const asset = new Asset (policyRefs[1],tokenName)
//     await (tokenProviderAccount.mintTokens(policyRefs,tokenName,expectedTokenAmount)) ()
//     const tokenAmount = await awaitTillTrue (pipe(tokenProviderAccount.tokenBalance(asset),TE.getOrElse ( () => T.of(0n))), (a) => a == expectedTokenAmount,3000) ()
//     log(`Token Balance: ${tokenAmount}`);
//     expect(tokenAmount).toBe(expectedTokenAmount);
//     
//     log('############')
//     log('# Exercise #')
//     log('############')
// 
//     const baseUrl = 'http://0.0.0.0:32856';
//     const adaDepositTimeout = pipe(Date.now(),addDays(1),datetoTimeout);
//     const tokenDepositTimeout = pipe(Date.now(),addDays(2),datetoTimeout);
//     const amountOfADA = coerceNumber(2);
//     const amountOfToken = coerceNumber(3);;
//     log (`tx ${JSONbigint.stringify(amountOfToken)}`);
//     const dslToken = DSL.Token(asset.policyId,asset.tokenName);
//     const swap: DSL.Contract = Examples.swap(adaDepositTimeout,tokenDepositTimeout,amountOfADA,amountOfToken,dslToken);
//     log (`tx ${JSONbigint.stringify(swap)}`);
//     const txBuilder = new ContractTxBuilder(baseUrl);  
//     const createTx = txBuilder.create
//                               ( swap
//                               , rolesConfiguration
//                                   ([['Ada provider', adaProviderAccount.address]  
//                                   ,['Token provider', tokenProviderAccount.address]]) 
//                               , adaProviderAccount.address)
//     const result = await (pipe (createTx 
//                                    , TE.chain(([contractId,txBody]) => pipe ( adaProviderAccount.fromTxBodyCBOR(txBody.cborHex)
//                                                                         , adaProviderAccount.signTxBody
//                                                                         , TE.map((txSigned) => [contractId,txSigned.toString()])))
//                                    , TE.chain(([contractId,txSigned]) => txBuilder.submit(contractId,txSigned) )))()
//                     
//     log (`contract id submitted ${JSONbigint.stringify(result)}`);
//     
//   },1000_000); 
// });
// 
// function delay(ms: number) {
//   return new Promise( resolve => setTimeout(resolve, ms) );
// }
// 
// const awaitTillTrue: <A> (f : T.Task<A>, predicate : (a:A) => boolean,  checkInterval :number) => T.Task<A> 
//   = (f,predicate,checkInterval) =>
//        () => new Promise((res) => {
//               const confirmation = setInterval(async () => {
//                 const result =  await f()
//                 if (predicate(result)) {
//                   clearInterval(confirmation);
//                   res(result);
//                   return;
//                 }                   
//               }, checkInterval);
//             })
//       
//   
// 
