import type {
  IssuedCredentialStatusEntry,
  IssuedVerifiableCredential,
} from '../../services/oid4vc.service';
import type { CredentialStatus, DisplayIssuedCredential } from './types';

/**
 * localStorage key written by previous builds to remember client-side revocations.
 * Server status is now authoritative, so stale local state is removed on dashboard mount.
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
 * Builds credential rows from account metadata merged with plugin status by credential id.
 * Only credentials returned by the account endpoint are shown. Plugin status is authoritative.
 * If the status lookup failed, rows render as `unknown` with Revoke disabled.
 */
export function buildDisplayCredentials(
  credentials: IssuedVerifiableCredential[],
  statuses: IssuedCredentialStatusEntry[] = [],
  options: { statusLookupFailed?: boolean } = {}
): DisplayIssuedCredential[] {
  const statusByCredentialId = new Map(
    statuses.filter((entry) => entry.credentialId).map((entry) => [entry.credentialId, entry])
  );
  const statusLookupFailed = options.statusLookupFailed === true;

  return credentials
    .filter((credential) => credential.id)
    .map((credential) => {
      const pluginStatus = statusLookupFailed
        ? undefined
        : statusByCredentialId.get(credential.id)?.status;
      const status = mapPluginStatus(pluginStatus);
      return {
        ...credential,
        status,
      };
    });
}
