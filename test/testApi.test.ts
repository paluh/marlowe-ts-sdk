
import * as ADA from '../src/common/ada'
import { datetoTimeout } from '../src/common/date'
import { Configuration, getPrivateKeyFromHexString, SingleAddressAccount} from '../src/common/blockfrost'
import { some, none, getOrElse } from 'fp-ts/Option'
import { pipe } from 'fp-ts/function'
import * as DSL from '../src/dsl';
import * as Examples from '../src/examples';
import { addDays, addHours,addMinutes } from 'date-fns/fp'
import { addYears, formatWithOptions } from 'date-fns/fp'
import { eo } from 'date-fns/locale'
import { MarloweRuntimeClient } from '../src/runtime/client'
import { coerceNumber } from '../src/dsl'


describe('@marlowe examples',  () => {

  describe('swap', () => {
    it('can execute the nominal case', async () => {
      // Setup
      const configuration = new Configuration ('preprodrj4joQQ9n2iGp7IjBh39DoxnomNvsNRl'
                                              ,'https://cardano-preprod.blockfrost.io/api/v0'
                                              ,'Preprod');
      const bank = await SingleAddressAccount.Initialise (configuration,getPrivateKeyFromHexString('5820e09f58cd4b2793ff35281c36af06760d4ab993829c7a1d3b29db2947576339b1'))
      const adaProviderAccount = await SingleAddressAccount.Random(configuration);
      const expectdAmountProvisionnedforAdaProvider = 1_000_000n
      const tokenProvderAccount = await SingleAddressAccount.Random(configuration);
      const expectdAmountProvisionnedforTokenProvider = 1_000_000n
      const tokenName = "TokenA"  
      const expectedTokenAmount = 50n

      await bank.adaBalance().then ((amount) => {
        console.log('Bank public key:', bank.address);
        console.log('Balance:', ADA.format(amount));
        expect(amount).toBeGreaterThan(100_000_000)
      });
      
      await Promise.all(
          [ bank.provision(adaProviderAccount,expectdAmountProvisionnedforAdaProvider)
          , bank.provision(tokenProvderAccount,expectdAmountProvisionnedforTokenProvider)]);

      await adaProviderAccount.adaBalance().then ((amount) => {
        console.log('Owner public key:', adaProviderAccount.address);
        console.log('Balance:', ADA.format(amount));
        expect(amount).toBe(expectdAmountProvisionnedforAdaProvider);
      })

      await tokenProvderAccount.adaBalance().then ((amount) => {
        console.log('Owner public key:', tokenProvderAccount.address);
        console.log('Balance:', ADA.format(amount));
        expect(amount).toBe(expectdAmountProvisionnedforTokenProvider);
      }); 
      
      const token = await tokenProvderAccount.mintTokens(tokenName,expectedTokenAmount)
      const tokenAmount = await tokenProvderAccount.tokenBalance(token)
      console.log('Token Balance:', tokenAmount);
      expect(tokenAmount).toBe(expectedTokenAmount);
      // Exercise

      const baseUrl = 'http://0.0.0.0:32777';
      const adaDepositTimeout = pipe(Date.now(),addDays(1),datetoTimeout);
      const tokenDepositTimeout = pipe(Date.now(),addDays(2),datetoTimeout);
      const amountOfADA = coerceNumber(2);
      const amountOfToken = coerceNumber(3);;
      const dslToken = DSL.Token(token.policyId,token.tokenName);
      const swap: DSL.Contract = Examples.swap(adaDepositTimeout,tokenDepositTimeout,amountOfADA,amountOfToken,dslToken);
      const marloweRuntime = MarloweRuntimeClient(baseUrl);          
    },1000_000); 
  });
});


