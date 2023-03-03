import { describe, expect, test } from '@jest/globals';
import { contractsEndpoint, RestClient, RestClientAPI } from '../src/runtime/internal/restAPI';
import { FetchResult } from '../src/runtime/model/common';
import { Global, Circus } from '@jest/types';
import { matchI } from 'ts-adt';
import axios from 'axios';

let testIf = (condition:boolean, name:string, fun:Global.TestFn, timeout?: number) => condition? test(name, fun, timeout):test.skip(name, fun, timeout);
let describeIf = (condition:boolean, name:string, fun:Circus.BlockFn) => condition? describe(name, fun):describe.skip(name, fun);

const baseURL = process.env.MARLOWE_WEB_SERVER_URL;

const expectSuccess = (result: FetchResult<any, any>): any => {
  return matchI(result)({
    success: (a) => a,
    failure: (err) => { throw new Error(err.details); }
  });
}


describeIf(typeof baseURL != "undefined", '@marlowe restClientAPI',  () => {
    const axiosRequest = axios.create({
        baseURL,
        headers: { ContentType: 'application/json', Accept: 'application/json' }
    });
    const client : RestClientAPI = RestClient(axiosRequest);

    test("runs", async () => {
      let response = await client.contracts.get(contractsEndpoint);

      return matchI(response)({
        success: (a) => {
          expect(a.data.itemsWithinCurrentRange.length).toBeGreaterThan(0);
        },
        failure: (_) => { throw new Error("Contracts endpoint failed:" ); }
      });
    })
  });
//   // Just a temporary quick and dirty tests of the client
// 
//   const client = MarloweRuntimeClient(axiosRequest);
// 
//   // Ugly fetcher for all the contracts
//   const foldContracts = async (filterItem: ((item: ContractHeaderItem) => boolean)) => {
//     let result:ContractHeaderItem[] = [];
//     let step = async function(response: GetContractsResponse | ErrorResponse) {
//       if(typeof response === "number") {
//         console.log("Error: ", response);
//       } else {
//         result.push(...response.items.filter(filterItem))
//         if (response.nextRange) {
//           await step(await client.contracts.get(contractsEndpoint, response.nextRange ));
//         }
//       }
//     }
//     let response = await client.contracts.get(contractsEndpoint)
//     await step(response)
//     return result;
//   }
// 
//   foldContracts(() => true).then(contracts => console.log(contracts.length));
// 
//   let address = "addr_test1qz4y0hs2kwmlpvwc6xtyq6m27xcd3rx5v95vf89q24a57ux5hr7g3tkp68p0g099tpuf3kyd5g80wwtyhr8klrcgmhasu26qcn";
// 
//   client.contracts.post(
//     contractsEndpoint,
//     { contract: "close"
//     , minUTxODeposit: 2000000
//     , changeAddress: address
//     }
//   ).then(function(response) {
//     console.log(response);
//     if(typeof response === "number") {
//       console.log("Error: ", response);
//     } else {
//       client.contract.get(response.endpoint).then(function(response) {
//         console.log(response);
//       });
//     }
//   });


