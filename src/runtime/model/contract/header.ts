import { ContractEndpoint } from '../../internal/restAPI';
import { ContractId, Metadata, PolicyId } from '../common';

export interface ContractHeader {
  contractId: ContractId;
  roleTokenMintingPolicyId: PolicyId;
  metadata: Metadata;
  link: { contract: ContractEndpoint };
}
