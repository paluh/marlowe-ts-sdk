import * as In from '../model/contract/header';
import * as Out from './restAPI';
import { Metadatum } from '../model/common';
import deepEqual from 'deep-equal';

export const convert = (out: Out.ContractHeaderLinked): In.ContractHeader => ({
  contractId: out.resource.contractId,
  link: out.links,
  metadata: deepEqual(out.resource.metadata, {}) ? new Map<bigint, Metadatum>() : out.resource.metadata,
  roleTokenMintingPolicyId: out.resource.roleTokenMintingPolicyId
});
