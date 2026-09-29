import type {
  IssuedCredentialLimit,
  IssuedVerifiableCredential,
} from '../../services/oid4vc.service';
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
 * True when the plugin reported a non-SUCCESS mapping (or none). The Credentials tab
 * derives a leftover notice from this — the plugin no longer sends a `dangling` object.
 */
export function hasIncompleteStatusListMapping(credential: {
  mappingStatus?: string | null;
}): boolean {
  const status = credential.mappingStatus;
  return status === null || status === 'INIT' || status === 'FAILURE';
}

/**
 * Builds the rows for the Credentials tab from the status-endpoint payload.
 * Each row already carries its plugin status. A missing status renders as unknown.
 * `mappingStatus` / `countsTowardQuota` are passed through for leftover cards.
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

/**
 * Returns the limit entry for the credential type when its quota is exhausted
 * (`remaining` is 0 or less), or `null` when no warning should be shown.
 *
 * An absent or empty `limits` payload (unlimited credential types, or plugins
 * that do not expose limits yet) always yields `null` — the dashboard must
 * behave exactly as before in that case.
 */
export function getCredentialLimitWarning(
  limits: IssuedCredentialLimit[],
  credentialConfigurationId: string
): IssuedCredentialLimit | null {
  const limit = limits.find(
    (entry) => entry.credentialConfigurationId === credentialConfigurationId
  );

  if (!limit || !Number.isFinite(limit.max) || limit.max <= 0) {
    return null;
  }

  return limit.remaining <= 0 ? limit : null;
}

/**
 * Warning copy for a quota that is already exhausted.
 * `REJECT` fails the next issuance. `REVOKE_OLDEST` revokes the oldest valid
 * credential of this type and then continues issuance.
 */
export function formatIssuanceLimitWarning(limit: IssuedCredentialLimit): string {
  const reached = `You have reached the issuance limit for this credential type (${limit.activeCount} of ${limit.max} issued).`;
  const policy = limit.overflowPolicy?.trim().toUpperCase();

  if (policy === 'REJECT') {
    return `${reached} Issuing another credential will fail. Revoking a credential frees a slot and clears this warning.`;
  }

  if (policy === 'REVOKE_OLDEST') {
    return `${reached} Issuing another credential will automatically revoke the oldest valid credential.`;
  }

  return `${reached} Overflow policy in force: ${limit.overflowPolicy}.`;
}
