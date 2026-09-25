import type { IssuedVerifiableCredential } from '../../services/oid4vc.service';

export type DashboardTab = 'offer' | 'credentials';

/** Dashboard badge/state. Only `active` (plugin VALID) may be revoked. */
export type CredentialStatus = 'active' | 'revoked' | 'suspended' | 'unknown';

export type DisplayIssuedCredential = IssuedVerifiableCredential & {
  status: CredentialStatus;
};

export function isRevocable(status: CredentialStatus): boolean {
  return status === 'active';
}
