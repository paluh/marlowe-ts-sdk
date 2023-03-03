import * as In from '../model/common';
import * as Out from './restAPI';
import { Metadatum } from '../model/common';
import deepEqual from 'deep-equal';

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

export const postContractsRequestMapper: Convertable<[In.RolesConfiguration],Out.PostContractsRequest> = {
  from (out) {
    throw new Error("Not Implemented");
  },
  to (inObject) {
    throw new Error("Not Implemented");
  }

}

export type Convertable<A,B> = {
  from(value: B): A;
  to<A,B>(value: A): B;
};

export function from(from: any): (a: Out.ContractHeaderLinked[]) => unknown[] {
  throw new Error('Function not implemented.');
}
