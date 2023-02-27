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
const amountOfAda: Value = ConstantParam('Amount of Ada');
const amountOfLovelace: Value = MulValue(lovelacePerAda, amountOfAda);
const amountOfDollars: Value = ConstantParam('Amount of dollars');

const adaDepositTimeout: Timeout = TimeParam('Timeout for Ada deposit');
const dollarDepositTimeout: Timeout = TimeParam('Timeout for dollar deposit');

const dollars: Token = Token('85bb65', 'dollar');

type SwapParty = {
  party: Party;
  currency: Token;
  amount: Value;
};

const adaProvider: SwapParty = {
  party: Role('Ada provider'),
  currency: ada,
  amount: amountOfLovelace
};

const dollarProvider: SwapParty = {
  party: Role('Dollar provider'),
  currency: dollars,
  amount: amountOfDollars
};

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

export const swap: Contract = makeDeposit(
  adaProvider,
  adaDepositTimeout,
  Close,
  makeDeposit(
    dollarProvider,
    dollarDepositTimeout,
    refundSwapParty(adaProvider),
    makePayment(adaProvider, dollarProvider, makePayment(dollarProvider, adaProvider, Close))
  )
);
