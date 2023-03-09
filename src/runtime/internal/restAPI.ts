/* eslint-disable sort-keys-fix/sort-keys-fix */
/* eslint-disable no-use-before-define */
import axios from 'axios';
import { AxiosInstance, AxiosResponse } from 'axios';
import { Address } from 'lucid-cardano';
import { FetchResult, Metadata, failure, success } from '../model/common';
import * as DSL from '../../dsl';
import * as TE from 'fp-ts/TaskEither'
import { flow, identity, pipe } from 'fp-ts/lib/function';
// API responses brings us back URLs so we are encouraged to not construct them manually.
// We use a opaque string to represent URLs for that.
//
// Opaque types idiom (like a hidden `newtype` constructor in Haskell)
declare const ContractsEndpoint: unique symbol;

type ContractsEndpoint = string & { _opaque: typeof ContractsEndpoint };

declare const ContractEndpoint: unique symbol;

// It seems like overengeeniring to have a root endpoint defined like this
// but we gonna extend the API and it gonna be served as a part of root response.
export const contractsEndpoint = '/contracts' as ContractsEndpoint;

export type ContractEndpoint = string & { _opaque: typeof ContractEndpoint };

// We are cheating in here a bit by hardcoding URLs ;-)
export const contractEndpoint = (contractId: string) => `/contracts/${contractId}` as ContractEndpoint;

declare const TransactionsEndpoint: unique symbol;

type TransactionsEndpoint = string & { _opaque: typeof TransactionsEndpoint };

export const transactionsEndpoint = (contractId: string) =>
  `/contracts/${contractId}/transactions` as TransactionsEndpoint;

declare const TransactionEndpoint: unique symbol;

type TransactionEndpoint = string & { _opaque: typeof TransactionEndpoint };

export const transactionEndpoint = (contractId: string, transactionId: string) =>
  `/contracts/${contractId}/transactions/${transactionId}` as TransactionEndpoint;

type Bech32 = string;

export type Version = 'v1';

// Just a stub for Marlowe Contract and State
type State = any;
type Input = 'input_notify';

export interface ErrorResponse {
  details: string;
  errorCode:string;
  message: string;
}

// Cardano
type PolicyId = string;
type TxStatus = 'unsigned' | 'submitted' | 'confirmed';

interface BlockHeader {
  slotNo: number; // These should be BigInts
  blockNo: number;
  blockHeaderHash: string;
}
// Contracts
type TxOutRef = string;
type ContractId = TxOutRef;

export interface ContractHeaderLinked {
  resource: ContractHeader;
  links: { contract: ContractEndpoint };
}
export interface ContractHeader {
  contractId: TxOutRef;
  roleTokenMintingPolicyId: PolicyId;
  version: Version;
  metadata: Metadata;
  status: TxStatus;
  blockHeader?: BlockHeader;
}
export interface ContractState extends ContractHeader {
  initialContract: DSL.Contract;
  currentContract?: DSL.Contract;
  state?: State;
  utxo?: ContractId;
  txBody?: Tx;
}

declare const ContractsRange: unique symbol;

type ContractsRange = string & { _opaque: typeof ContractsRange };

// Pagination

interface PaginatedResponse<Item, Range> {
  nextRange?: Range;
  prevRange?: Range;
  itemsWithinCurrentRange: Item[];
}

// Rest Model

export type GetContractsResponse = PaginatedResponse<ContractHeaderLinked, ContractsRange>;

export interface PostContractsRequest {
  contract: DSL.Contract;
  roles?: RolesConfig; 
  version: Version;
  metadata: Metadata;
  minUTxODeposit: number;
  changeAddress: Bech32;
  addresses?: Bech32[]; // When skipped we use `[changeAddress]`
  collateralUTxOs?: Bech32[];
}

export interface PutContractRequest extends Envelope {
  type: "ShelleyTxWitness BabbageEra" | "Tx BabbageEra"
}


export type RolesConfig 
    = Map<RoleName,RoleTokenConfig> //Mint

export type RoleName = string

export type RoleTokenConfig
  = Address // RoleTokenSimple
  // | { address : Address, metadata : TokenMetadata } // RoleTokenSimple

export type TokenMetadata 
  = { name : string
    , image : string
    , mediaType?: string
    , description?:string
    , files?:TokenMetadataFile[]
  } 

export type TokenMetadataFile
  = { name : string
    , src : string
    , mediaType : string
    };

export interface PostContractsResponse {
  contractId: TxOutRef;
  endpoint: ContractEndpoint;
  tx: Tx;
}

export interface Envelope {
  type: string;
  description?: string;
  cborHex: string;
};

// FIXME: Drop this envelope layer from the API layer
export type Tx = Envelope;

type ISO8601 = string;

export interface PostTransactionsRequest {
  inpts: Input[];
  invalidBefore: ISO8601;
  invalidHereafter: ISO8601;
  metadata?: Metadata;
  changeAddress: Bech32;
  addresses?: Bech32[]; // When skipped we use `[changeAddress]`
  collateralUTxOs?: Bech32[];
}

type TxId = string;

export interface TxHeader {
  contractId: TxOutRef;
  transactionId: TxId;
  status: TxStatus;
  block?: BlockHeader;
  utxo?: TxOutRef;
}

interface TxHeaderLinked {
  header: TxHeader;
  links: { contract: TransactionEndpoint };
}

export interface GetTransactionsRequestOptions {
  range?: string;
}

declare const TransactionsRange: unique symbol;

type TransactionsRange = string & { _opaque: typeof TransactionsRange };

export type GetTransactionsResponse = PaginatedResponse<TxHeaderLinked, TransactionsRange>;

export interface RestClientAPI {
  contracts: {
    get: (
      route: ContractsEndpoint,
      range?: ContractsRange
    ) => Promise<FetchResult<ErrorResponse, GetContractsResponse>>;
    post: (route: ContractsEndpoint, input: PostContractsRequest) => TE.TaskEither<Error,PostContractsResponse>;
  };
  contract: {
    get: (route: ContractEndpoint) => Promise<FetchResult<ErrorResponse, ContractState>>;
    put: (route: ContractEndpoint, input: PutContractRequest) => TE.TaskEither<Error,PostContractsResponse>;
  };
  transactions: {
    get: (route: TransactionsEndpoint) => Promise<GetTransactionsResponse | ErrorResponse>;
  };
}

export const RestClient = function (request: AxiosInstance): RestClientAPI {
  return {
    contract: {
      get: async (route: ContractEndpoint): Promise<FetchResult<ErrorResponse, ContractState>> =>
        request
          .get(route as string)
          .then((response) => success<ErrorResponse, ContractState>(response.data.resource))
          .catch((error) => failure(error)),
      put: (route: ContractEndpoint, input: PutContractRequest): TE.TaskEither<Error,any> =>
          pipe(httpPut(request)
          ( route
          , input
          , { headers: { 'Content-Type':'application/json' }}
          ))
    },
    contracts: {
      get: async (
        route: ContractsEndpoint,
        range?: ContractsRange
      ): Promise<FetchResult<ErrorResponse, GetContractsResponse>> => {
        const config = range ? { headers: { Range: range as string } } : {};

        return request
          .get(route as string, config)
          .then((response) =>
            success<ErrorResponse, GetContractsResponse>({
              itemsWithinCurrentRange: response.data.results,
              nextRange: response.headers['next-range'] as ContractsRange,
              prevRange: response.headers['prev-range'] as ContractsRange
            })
          )
          .catch((error) => failure(error));
      },
      post: (
        route: ContractsEndpoint,
        input: PostContractsRequest
      ): TE.TaskEither<Error,PostContractsResponse> => 
        pipe(httpPost(request)
              ( (route as string)
              , { contract: input.contract
                  , metadata: input.metadata
                  , minUTxODeposit: input.minUTxODeposit
                  , roles: input.roles
                  , version: input.version
                  }
              , { headers: {
                'Accept': 'application/vendor.iog.marlowe-runtime.contract-tx-json',
                'Content-Type':'application/json',
                'X-Address': (input.addresses ?? [input.changeAddress]).join(','),
                'X-Change-Address': input.changeAddress,
                ...(input.collateralUTxOs && { 'X-Collateral-UTxOs': input.collateralUTxOs })}})
            ,TE.map((response) => ({ contractId: response.resource.contractId,
                                 endpoint: response.links.contract,
                                 tx: response.resource.tx
                                 })))
    },
    transactions: {
      get: async (
        route: TransactionsEndpoint,
        range?: TransactionsRange
      ): Promise<GetTransactionsResponse | ErrorResponse> => {
        const config = range ? { headers: { Range: range as string } } : {};

        return request
          .get(route as string, config)
          .then((response) => ({
            items: response.data.results,
            nextRange: response.headers['next-range'],
            prevRange: response.headers['prev-range']
          }))
          .catch((error) => (error.response.data));
      }
    }
  };
};

const makeReq = TE.bimap(
  (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
  (v: AxiosResponse): any => v.data,
);

export const httpGet = flow(TE.tryCatchK(axios.get, identity), makeReq);

export const httpPost  = (request: AxiosInstance) => flow(TE.tryCatchK(request.post, identity), makeReq);

export const httpPut  = (request: AxiosInstance) => flow(TE.tryCatchK(request.put, identity), makeReq);
