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
 * Resolves the plugin status for a row, by priority:
 * 1. a failed status lookup wins with `undefined` (fail closed → row renders as unknown);
 * 2. a fresh status entry from the plugin response;
 * 3. the row's own `serverStatus` (admin rows embed it — see getIssuedCredentialsFor).
 */
function resolvePluginStatus(
  credential: IssuedVerifiableCredential,
  statusByCredentialId: Map<string, IssuedCredentialStatusEntry>,
  statusLookupFailed: boolean
): string | undefined {
  if (statusLookupFailed) return undefined;

  const serverEntry = statusByCredentialId.get(credential.id);
  if (serverEntry) return serverEntry.status;
  return credential.serverStatus;
}

/**
 * Builds credential rows from account metadata merged with plugin status by credential id.
 * Only credentials returned by the server are shown. Plugin status is authoritative.
 * Admin rows that already carry `serverStatus` use that when no separate status list is passed.
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
      const pluginStatus = resolvePluginStatus(
        credential,
        statusByCredentialId,
        statusLookupFailed
      );
      const status = mapPluginStatus(pluginStatus);
      return {
        ...credential,
        revoked: status === 'revoked',
        status,
      };
    });
}
