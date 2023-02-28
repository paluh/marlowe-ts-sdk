/* eslint-disable sort-keys-fix/sort-keys-fix */
import {
  Case,
  Close,
  Constant,
  ConstantParam,
  Contract,
  Deposit,
  MulValue,
  Party,
  Pay,
  Role,
  TimeParam,
  Timeout,
  Token,
  Value,
  When,
  ada
} from '../dsl';

/**
 * Marlowe Example : Swap
 * Description :
 *      Takes Ada from one party and dollar tokens from another party, and it swaps them atomically.
 */

/* We can set explicitRefunds true to run Close refund analysis
but we get a shorter contract if we set it to false */
const explicitRefunds: Boolean = false;

const lovelacePerAda: Value = Constant(1_000_000n);
const amountOfLovelace = ( amountOfAda: Value): Value => MulValue(lovelacePerAda, amountOfAda);


interface SwapParty {
  party: Party;
  currency: Token;
  amount: Value;
};

const adaProvider = ( amountOfAda: Value): SwapParty => ({
  party: Role('Ada provider'),
  currency: ada,
  amount: amountOfLovelace (amountOfAda)
});

const tokenProvider = (amount:Value ,currency : Token) : SwapParty => ({
  party: Role('Token provider'),
  currency: currency,
  amount: amount
});

const makeDeposit = function (
  src: SwapParty,
  timeout: Timeout,
  timeoutContinuation: Contract,
  continuation: Contract
): Contract {
  return When(
    [Case(Deposit(src.party, src.party, src.currency, src.amount), continuation)],
    timeout,
    timeoutContinuation
  );
};

const refundSwapParty = function (party: SwapParty): Contract {
  if (explicitRefunds) {
    return Pay(party.party, Party(party.party), party.currency, party.amount, Close);
  }
  return Close;
};

const makePayment = function (src: SwapParty, dest: SwapParty, continuation: Contract): Contract {
  return Pay(src.party, Party(dest.party), src.currency, src.amount, continuation);
};

export const swap = (adaDepositTimeout:Timeout, tokenDepositTimeout:Timeout,amount:Value,token:Token): Contract => makeDeposit(
  adaProvider,
  adaDepositTimeout,
  Close,
  makeDeposit(
    tokenProvider(amount,token),
    tokenDepositTimeout,
    refundSwapParty(adaProvider),
    makePayment(adaProvider, tokenProvider(amount,token), makePayment(tokenProvider(amount,token), adaProvider, Close))
  )
);
