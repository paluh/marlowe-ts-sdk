
import * as ADA from '../src/common/ada'
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
import { coerceNumber } from '../src/dsl'
import { log } from '../src/common/logging'
import { Address, RoleName, rolesConfiguration } from '../src/runtime/model/common'
import JSONbigint from 'json-bigint'
import * as TE from 'fp-ts/TaskEither'
import * as T from 'fp-ts/Task'
import * as E from 'fp-ts/Either'


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
                                                                [tokenProviderAccount,expectdAmountProvisionnedforTokenProvider]])) ();

    await adaProviderAccount.adaBalance().then ((amount) => {
      log(`Ada Provider Address : ${adaProviderAccount.address}`);
      log(`Balance: ${ADA.format(amount)}`);
      expect(amount).toBe(expectdAmountProvisionnedforAdaProvider);
    })

    await tokenProviderAccount.adaBalance().then ((amount) => {
      log(`Token Provider Address: ${tokenProviderAccount.address}`);
      log(`Balance: ${ADA.format(amount)}`);
      expect(amount).toBe(expectdAmountProvisionnedforTokenProvider);
    }); 
    const policyRefs = tokenProviderAccount.randomPolicyId ();
    const asset = new Asset (policyRefs[1],tokenName)
    await (tokenProviderAccount.mintTokens(policyRefs,tokenName,expectedTokenAmount)) ()
    const tokenAmount = await awaitTillTrue (pipe(tokenProviderAccount.tokenBalance(asset),TE.getOrElse ( () => T.of(0n))), (a) => a == expectedTokenAmount,3000) ()
    log(`Token Balance: ${tokenAmount}`);
    expect(tokenAmount).toBe(expectedTokenAmount);
    
    log('############')
    log('# Exercise #')
    log('############')

    const baseUrl = 'http://0.0.0.0:32856';
    const adaDepositTimeout = pipe(Date.now(),addDays(1),datetoTimeout);
    const tokenDepositTimeout = pipe(Date.now(),addDays(2),datetoTimeout);
    const amountOfADA = coerceNumber(2);
    const amountOfToken = coerceNumber(3);;
    log (`tx ${JSONbigint.stringify(amountOfToken)}`);
    const dslToken = DSL.Token(asset.policyId,asset.tokenName);
    const swap: DSL.Contract = Examples.swap(adaDepositTimeout,tokenDepositTimeout,amountOfADA,amountOfToken,dslToken);
    log (`tx ${JSONbigint.stringify(swap)}`);
    const txBuilder = new ContractTxBuilder(baseUrl);  
    const createTx = txBuilder.create
                              ( swap
                              , rolesConfiguration
                                  ([['Ada provider', adaProviderAccount.address]  
                                  ,['Token provider', tokenProviderAccount.address]]) 
                              , adaProviderAccount.address)
    const result = await (pipe (createTx 
                                   , TE.chain(([contractId,txBody]) => pipe ( adaProviderAccount.fromTxBodyCBOR(txBody.cborHex)
                                                                        , adaProviderAccount.signTxBody
                                                                        , TE.map((txSigned) => [contractId,txSigned.toString()])))
                                   , TE.chain(([contractId,txSigned]) => txBuilder.submit(contractId,txSigned) )))()
                    
    log (`contract id submitted ${JSONbigint.stringify(result)}`);
    
  },1000_000); 
});

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

const awaitTillTrue: <A> (f : T.Task<A>, predicate : (a:A) => boolean,  checkInterval :number) => T.Task<A> 
  = (f,predicate,checkInterval) =>
       () => new Promise((res) => {
              const confirmation = setInterval(async () => {
                const result =  await f()
                if (predicate(result)) {
                  clearInterval(confirmation);
                  res(result);
                  return;
                }                   
              }, checkInterval);
            })
      
  

