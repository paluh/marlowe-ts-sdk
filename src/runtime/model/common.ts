/* eslint-disable no-use-before-define */
import { ContractEndpoint } from 'runtime/internal/restAPI';
import { ADT } from 'ts-adt';

type TxOutRef = string;
export type Address = string;
export type Collateral = string;
export type RoleName = string;
export type PolicyId = string;
export type ContractId = TxOutRef;
export type MetadatumMap = Map<Metadatum, Metadatum>;
export type Metadatum = bigint | MetadatumMap | string | Uint8Array | Metadatum[];
export type Metadata = Map<bigint, Metadatum>;

export type FetchResult<Error, Data> = ADT<{
  success: { data: Data };
  failure: { details: Error };
}>;

export const success: <Error, Data>(d: Data) => FetchResult<Error, Data> = (d) => ({ _type: 'success', data: d });
export const failure: <Error, Data>(e: Error) => FetchResult<Error, Data> = (e) => ({ _type: 'failure', details: e });

export interface ContractHeader {
  contractId: ContractId;
  roleTokenMintingPolicyId: PolicyId;
  metadata: Metadata;
  link: { contract: ContractEndpoint };
}

export type MintRoleTokenSimpleConfiguration = Map<RoleName,Address>;

export const rolesConfiguration: (entries:[RoleName,Address][]) => MintRoleTokenSimpleConfiguration = (e) => new Map<RoleName,Address>(e)

export interface MarloweTx {
  type: string;
  description?: string;
  cborHex: string;
}