
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
import { ContractTxBuilder, MarloweRuntimeClient } from '../src/runtime/client'
import { coerceNumber } from '../src/dsl'
import { log } from '../src/common/logging'
import { Address, RoleName, rolesConfiguration } from '../src/runtime/model/common'


describe('swap', () => {
  it('can execute the nominal case', async () => {
    log('#######################')
    log('# Swap : Nominal Case #')
    log('#######################')
    
    log('#########')
    log('# Setup #')
    log('#########')

    const configuration = new Configuration ('preprodrj4joQQ9n2iGp7IjBh39DoxnomNvsNRl'
                                            ,'https://cardano-preprod.blockfrost.io/api/v0'
                                            ,'Preprod');
    const bank = await SingleAddressAccount.Initialise (configuration,getPrivateKeyFromHexString('5820e09f58cd4b2793ff35281c36af06760d4ab993829c7a1d3b29db2947576339b1'))
    const adaProviderAccount = await SingleAddressAccount.Random(configuration);
    const expectdAmountProvisionnedforAdaProvider = 1_000_000n
    const tokenProviderAccount = await SingleAddressAccount.Random(configuration);
    const expectdAmountProvisionnedforTokenProvider = 5_000_000n
    const tokenName = "TokenA"  
    const expectedTokenAmount = 50n

    await bank.adaBalance().then ((amount) => {
      log(`Bank public key: ${bank.address}`);
      log(`Balance: ${ADA.format(amount)}`);
      expect(amount).toBeGreaterThan(100_000_000)
    });
    
    await Promise.all(
        [ bank.provision(adaProviderAccount,expectdAmountProvisionnedforAdaProvider)
        , bank.provision(tokenProviderAccount,expectdAmountProvisionnedforTokenProvider)]);

    await adaProviderAccount.adaBalance().then ((amount) => {
      log(`Ada Provider Address :', ${adaProviderAccount.address}`);
      log(`Balance:', ${ADA.format(amount)}`);
      expect(amount).toBe(expectdAmountProvisionnedforAdaProvider);
    })

    await tokenProviderAccount.adaBalance().then ((amount) => {
      log(`Token Provider Address:', ${tokenProviderAccount.address}`);
      log(`Balance: ${ADA.format(amount)}`);
      expect(amount).toBe(expectdAmountProvisionnedforTokenProvider);
    }); 
    
    const token = await tokenProviderAccount.mintTokens(tokenName,expectedTokenAmount)
    const tokenAmount = await tokenProviderAccount.tokenBalance(token)
    log(`Token Balance: ${tokenAmount}`);
    await delay(10_000)
    const tokenAmount2 = await tokenProviderAccount.tokenBalance(token)
    log(`Token Balance: ${tokenAmount2}`);
    await delay(10_000)
    expect(tokenAmount2).toBe(expectedTokenAmount);
    
    log('############')
    log('# Exercise #')
    log('############')

    const baseUrl = 'http://0.0.0.0:32815';
    const adaDepositTimeout = pipe(Date.now(),addDays(1),datetoTimeout);
    const tokenDepositTimeout = pipe(Date.now(),addDays(2),datetoTimeout);
    const amountOfADA = coerceNumber(2);
    const amountOfToken = coerceNumber(3);;
    const dslToken = DSL.Token(token.policyId,token.tokenName);
    const swap: DSL.Contract = Examples.swap(adaDepositTimeout,tokenDepositTimeout,amountOfADA,amountOfToken,dslToken);
    const txBuilder = new ContractTxBuilder(baseUrl);  
    const tx = await txBuilder.create
                          ( swap
                          , rolesConfiguration
                              ([['Ada provider',adaProviderAccount.address]
                               ,['Token provider',tokenProviderAccount.address]])
                          , adaProviderAccount.address);
    log (`contract tx ${JSON.stringify(tx)}`);

  },1000_000); 
});


function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}