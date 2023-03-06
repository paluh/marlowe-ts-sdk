
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
import JSONbigint from 'json-bigint'

describe('swap', () => {
  it('can execute the nominal case', async () => {
    log('#######################')
    log('# Swap : Nominal Case #')
    log('#######################')
    
    log('#########')
    log('# Setup #')
    log('#########')

    const configuration = new Configuration ('previewcz3TyjIzynbADHOoV3K9i9yK1zIvMVzP'
                                            ,'https://cardano-preview.blockfrost.io/api/v0'
                                            ,'Preview');
    const bank = await SingleAddressAccount.Initialise (configuration,getPrivateKeyFromHexString('5820e09f58cd4b2793ff35281c36af06760d4ab993829c7a1d3b29db2947576339b1'))
    const adaProviderAccount = await SingleAddressAccount.Random(configuration);
    const expectdAmountProvisionnedforAdaProvider = 10_000_000n
    const tokenProviderAccount = await SingleAddressAccount.Random(configuration);
    const expectdAmountProvisionnedforTokenProvider = 10_000_000n
    const tokenName = "TokenA"  
    const expectedTokenAmount = 50n

    await bank.adaBalance().then ((amount) => {
      log(`Bank public key: ${bank.address}`);
      log(`Balance: ${ADA.format(amount)}`);
      expect(amount).toBeGreaterThan(100_000_000)
    });
    
    await bank.provision(new Map<SingleAddressAccount,BigInt> ([[adaProviderAccount,expectdAmountProvisionnedforAdaProvider],
                                                                [tokenProviderAccount,expectdAmountProvisionnedforTokenProvider]]));

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
    expect(tokenAmount2).toBe(expectedTokenAmount);
    
    log('############')
    log('# Exercise #')
    log('############')

    const baseUrl = 'http://0.0.0.0:32834';
    const adaDepositTimeout = pipe(Date.now(),addDays(1),datetoTimeout);
    const tokenDepositTimeout = pipe(Date.now(),addDays(2),datetoTimeout);
    const amountOfADA = coerceNumber(2);
    const amountOfToken = coerceNumber(3);;
    log (`tx ${JSONbigint.stringify(amountOfToken)}`);
    const dslToken = DSL.Token(token.policyId,token.tokenName);
    const swap: DSL.Contract = Examples.swap(adaDepositTimeout,tokenDepositTimeout,amountOfADA,amountOfToken,dslToken);
    log (`tx ${JSONbigint.stringify(swap)}`);
    const txBuilder = new ContractTxBuilder(baseUrl);  
    const tx = await txBuilder.create
                          ( swap
                          , rolesConfiguration
                              ([['Ada provider', adaProviderAccount.address] //'addr_test1vpmkc3724wnmpnufmpgyqq3xkctr9ha6nawrpws979n6e6sqpxkxl']
                               ,['Token provider', tokenProviderAccount.address]]) //'addr_test1vp4d000h7jp23506z363hq480v04g7hwnytgl0r3ucdj26sj70qs5' ]]) 
                          , adaProviderAccount.address); //'addr_test1vpmkc3724wnmpnufmpgyqq3xkctr9ha6nawrpws979n6e6sqpxkxl');//adaProviderAccount.address);
    log (`contract tx ${JSONbigint.stringify(tx)}`);

  },1000_000); 
});


function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}