import type { IssuedVerifiableCredential } from '../../services/oid4vc.service';

export type DashboardTab = 'offer' | 'credentials';
export type CredentialStatus = 'active' | 'revoked';

export type DisplayIssuedCredential = IssuedVerifiableCredential & {
  status: CredentialStatus;
};

export type StoredCredentialViewState = {
  revokedCredentials: Record<string, IssuedVerifiableCredential>;
  removedCredentialIds: string[];
};
