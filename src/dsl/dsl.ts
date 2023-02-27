/* eslint-disable no-use-before-define */
/* eslint-disable sort-keys-fix/sort-keys-fix */
import BigNumber from 'bignumber.js';

export type Party = { address: string } | { role_token: string };

export type SomeNumber = number | string | bigint;

const coerceNumber = function (n: SomeNumber): BigNumber {
  const isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  if (typeof n === 'string' && isNumeric.test(String(n))) {
    return new BigNumber(n);
  } else if (typeof n === 'bigint') {
    return new BigNumber(n.toString());
  } else if (typeof n === 'number') {
    if (n > Number.MAX_SAFE_INTEGER || n < -Number.MAX_SAFE_INTEGER) {
      throw new Error('Unsafe use of JavaScript numbers. For amounts this large, please use BigNumber.');
    }
    return new BigNumber(n);
  }
  throw new Error('Not a valid number');
};

export const Address = function (address: string): Party {
  return { address };
};

export const Role = function (roleToken: string): Party {
  return { role_token: roleToken };
};

export type AccountId = Party;

export type ChoiceId = { choice_name: string; choice_owner: Party };

export const ChoiceId = function (choiceName: string, choiceOwner: Party): ChoiceId {
  return { choice_name: choiceName, choice_owner: choiceOwner };
};

export type Token = { currency_symbol: string; token_name: string };

export const Token = function (currencySymbol: string, tokenName: string): Token {
  const isBase16 = /^([\da-f]{2})*$/g;
  if (isBase16.test(currencySymbol)) {
    return { currency_symbol: currencySymbol, token_name: tokenName };
  }
  throw new Error('Currency symbol must be base16');
};

export const ada: Token = { currency_symbol: '', token_name: '' };

export type ValueId = string;

export const ValueId = function (valueIdentifier: string): ValueId {
  return valueIdentifier;
};

export type Value =
  | { amount_of_token: Token; in_account: AccountId }
  | BigNumber
  | { constant_param: String }
  | { negate: Value }
  | { add: Value; and: Value }
  | { value: Value; minus: Value }
  | { multiply: Value; times: Value }
  | { divide: Value; by: Value }
  | { value_of_choice: ChoiceId }
  | 'time_interval_start'
  | 'time_interval_end'
  | { use_value: ValueId }
  | { if: Observation; then: Value; else: Value };

export type EValue = SomeNumber | Value;

const coerceValue = function (val: EValue): Value {
  if (typeof val === 'number') {
    if (val > Number.MAX_SAFE_INTEGER || val < -Number.MAX_SAFE_INTEGER) {
      throw new Error('Unsafe use of JavaScript numbers. For amounts this large, please use BigNumber.');
    }
    return new BigNumber(val);
  } else if (typeof val === 'bigint') {
    return new BigNumber(val.toString());
  } else if (typeof val === 'string' && val !== 'time_interval_start' && val !== 'time_interval_end') {
    return new BigNumber(val);
  }
  return val;
};

export const AvailableMoney = function (token: Token, accountId: AccountId): Value {
  return { amount_of_token: token, in_account: accountId };
};

export const Constant = function (number: SomeNumber): Value {
  return coerceNumber(number);
};

export const ConstantParam = function (paramName: String): Value {
  return { constant_param: paramName };
};

export const NegValue = function (value: EValue): Value {
  return { negate: coerceValue(value) };
};

export const AddValue = function (lhs: EValue, rhs: EValue): Value {
  return { add: coerceValue(lhs), and: coerceValue(rhs) };
};

export const SubValue = function (lhs: EValue, rhs: EValue): Value {
  return { value: coerceValue(lhs), minus: coerceValue(rhs) };
};

export const MulValue = function (lhs: EValue, rhs: EValue): Value {
  return { multiply: coerceValue(lhs), times: coerceValue(rhs) };
};

export const DivValue = function (lhs: EValue, rhs: EValue): Value {
  return { divide: coerceValue(lhs), by: coerceValue(rhs) };
};

export const ChoiceValue = function (choiceId: ChoiceId): Value {
  return { value_of_choice: choiceId };
};

export const TimeIntervalStart: Value = 'time_interval_start';

export const TimeIntervalEnd: Value = 'time_interval_end';

export const UseValue = function (valueId: ValueId): Value {
  return { use_value: valueId };
};

export const Cond = function (obs: Observation, contThen: EValue, contElse: EValue): Value {
  return { if: obs, then: coerceValue(contThen), else: coerceValue(contElse) };
};

export type Observation =
  | { both: Observation; and: Observation }
  | { either: Observation; or: Observation }
  | { not: Observation }
  | { chose_something_for: ChoiceId }
  | { value: Value; ge_than: Value }
  | { value: Value; gt: Value }
  | { value: Value; lt: Value }
  | { value: Value; le_than: Value }
  | { value: Value; equal_to: Value }
  | boolean;

export const AndObs = function (lhs: Observation, rhs: Observation): Observation {
  return { both: lhs, and: rhs };
};

export const OrObs = function (lhs: Observation, rhs: Observation): Observation {
  return { either: lhs, or: rhs };
};

export const NotObs = function (obs: Observation): Observation {
  return { not: obs };
};

export const ChoseSomething = function (choiceId: ChoiceId): Observation {
  return { chose_something_for: choiceId };
};

export const ValueGE = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), ge_than: coerceValue(rhs) };
};

export const ValueGT = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), gt: coerceValue(rhs) };
};

export const ValueLT = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), lt: coerceValue(rhs) };
};

export const ValueLE = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), le_than: coerceValue(rhs) };
};

export const ValueEQ = function (lhs: EValue, rhs: EValue): Observation {
  return { value: coerceValue(lhs), equal_to: coerceValue(rhs) };
};

export const TrueObs: Observation = true;

export const FalseObs: Observation = false;

export type Bound = { from: BigNumber; to: BigNumber };

export const Bound = function (boundMin: SomeNumber, boundMax: SomeNumber): Bound {
  return { from: coerceNumber(boundMin), to: coerceNumber(boundMax) };
};

export type Action =
  | { party: Party; deposits: Value; of_token: Token; into_account: AccountId }
  | { choose_between: Bound[]; for_choice: ChoiceId }
  | { notify_if: Observation };

export const Deposit = function (accId: AccountId, party: Party, token: Token, value: EValue): Action {
  return {
    deposits: coerceValue(value),
    into_account: accId,
    of_token: token,
    party
  };
};

export const Choice = function (choiceId: ChoiceId, bounds: Bound[]): Action {
  return { choose_between: bounds, for_choice: choiceId };
};

export const Notify = function (obs: Observation): Action {
  return { notify_if: obs };
};

export type Payee = { account: AccountId } | { party: Party };

export const Account = function (party: Party): Payee {
  return { account: party };
};

export const Party = function (party: Party): Payee {
  return { party };
};

export type Case = { case: Action; then: Contract };

export const Case = function (caseAction: Action, continuation: Contract): Case {
  return { case: caseAction, then: continuation };
};

export type Timeout = { time_param: String } | BigNumber;

export type ETimeout = SomeNumber | Timeout;

export const TimeParam = function (paramName: String): Timeout {
  return { time_param: paramName };
};

export type Contract =
  | 'close'
  | {
      pay: Value;
      token: Token;
      from_account: AccountId;
      to: Payee;
      then: Contract;
    }
  | { if: Observation; then: Contract; else: Contract }
  | { when: Case[]; timeout: Timeout; timeout_continuation: Contract }
  | { let: ValueId; be: Value; then: Contract }
  | { assert: Observation; then: Contract };

export const Close: Contract = 'close';

export const Pay = function (
  accId: AccountId,
  payee: Payee,
  token: Token,
  value: EValue,
  continuation: Contract
): Contract {
  return {
    pay: coerceValue(value),
    token,
    from_account: accId,
    to: payee,
    then: continuation
  };
};

export const If = function (obs: Observation, contThen: Contract, contElse: Contract): Contract {
  return { if: obs, then: contThen, else: contElse };
};

export const When = function (cases: Case[], timeout: ETimeout, timeoutCont: Contract): Contract {
  const coercedTimeout: Timeout = typeof timeout === 'object' ? timeout : coerceNumber(timeout);
  return {
    when: cases,
    timeout: coercedTimeout,
    timeout_continuation: timeoutCont
  };
};

export const Let = function (valueId: ValueId, value: Value, cont: Contract): Contract {
  return { let: valueId, be: value, then: cont };
};

export const Assert = function (obs: Observation, cont: Contract): Contract {
  return { assert: obs, then: cont };
};
