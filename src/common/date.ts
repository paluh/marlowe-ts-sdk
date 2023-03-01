import BigNumber from 'bignumber.js'
import getTime from 'date-fns/getTime'
import getUnixTime from 'date-fns/getUnixTime'
import { coerceNumber, Timeout } from '../dsl'
import { pipe } from 'fp-ts/function'

export const datetoTimeout = (date:Date):Timeout => pipe(date,getUnixTime,coerceNumber)
