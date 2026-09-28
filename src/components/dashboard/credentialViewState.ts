import type { IssuedVerifiableCredential } from '../../services/oid4vc.service';
import type { CredentialStatus, DisplayIssuedCredential } from './types';

/**
 * localStorage key written by previous builds to remember client-side revocations.
 * Server status is now authoritative, so stale local state is removed on dashboard mount.
 *
 * TODO: remove this purge once clients that stored the old key are no longer in use.
 */
const LEGACY_VIEW_STATE_KEY = 'oid4vc-issued-credential-view-state';

export function purgeLegacyCredentialViewState(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(LEGACY_VIEW_STATE_KEY);
  } catch (error) {
    console.warn('Failed to remove legacy credential view state', error);
  }
}

/**
 * Maps a token-status plugin status onto the dashboard badge.
 * - VALID → active (Revoke enabled)
 * - INVALID → revoked
 * - SUSPENDED → suspended (Revoke disabled)
 * - UNKNOWN / missing → unknown (Revoke disabled)
 */
export function mapPluginStatus(status: string | undefined): CredentialStatus {
  switch (status) {
    case 'VALID':
      return 'active';
    case 'INVALID':
      return 'revoked';
    case 'SUSPENDED':
      return 'suspended';
    default:
      return 'unknown';
  }
}

/**
 * Builds the rows for the Credentials tab from the status-endpoint payload.
 * Each row already carries its plugin status. A missing status renders as unknown.
 */
export function buildDisplayCredentials(
  credentials: IssuedVerifiableCredential[]
): DisplayIssuedCredential[] {
  return credentials
    .filter((credential) => credential.id)
    .map((credential) => {
      const status = mapPluginStatus(credential.serverStatus);
      return {
        ...credential,
        revoked: status === 'revoked',
        status,
      };
    });
}
