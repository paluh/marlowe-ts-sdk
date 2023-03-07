import * as In from '../model/common';
import * as Out from './restAPI';
import { Metadatum } from '../model/common';
import deepEqual from 'deep-equal';
import * as DSL from '../../dsl';

export const contractHeaderMapper: Convertable<In.ContractHeader,Out.ContractHeaderLinked> = {
  from (out) {
    return { contractId: out.resource.contractId
           , link: out.links
           , metadata: deepEqual(out.resource.metadata, {}) ? new Map<bigint, Metadatum>() : out.resource.metadata
           , roleTokenMintingPolicyId: out.resource.roleTokenMintingPolicyId
           }
  },
  to (inObject) {
    throw new Error("Not Implemented");
  }
}

export const contractTxMapper: Convertable<In.MarloweTx,Out.Tx> = {
  from (out) {
    return { type: out.type
           , description: out.description
           , cborHex: out.cborHex
           }
  },
  to (inObject) {
    throw new Error("Not Implemented");
  }
}


export const rolesConfigurationMapper: Convertable<In.MintRoleTokenSimpleConfiguration,Out.RolesConfig> = {
  from (out) {
    throw new Error("Not Implemented");
  },
  to (mintRoleTokenSimpleConfiguration) {
    return mintRoleTokenSimpleConfiguration;
  }
}

export type Convertable<A,B> = {
  from(value: B): A;
  to(value: A): B;
};

export function from(from: any): (a: Out.ContractHeaderLinked[]) => unknown[] {
  throw new Error('Function not implemented.');
}
