import type {
  IssuedCredentialStatusEntry,
  IssuedVerifiableCredential,
} from '../../services/oid4vc.service';
import type { UserProfile } from '../../types';
import type { CredentialStatus, DisplayIssuedCredential, StoredCredentialViewState } from './types';

const CREDENTIAL_VIEW_STATE_KEY = 'oid4vc-issued-credential-view-state';

/**
 * Maps a token-status plugin status string onto the dashboard badge.
 * - VALID → active (Revoke enabled)
 * - INVALID → revoked
 * - SUSPENDED → suspended (Revoke disabled)
 * - UNKNOWN / missing → unknown (Revoke disabled; no status-list mapping yet)
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
 * Builds the credential rows shown in the Credentials tab.
 *
 * - Plugin status drives the badge (via {@link mapPluginStatus} / `serverStatus`).
 * - If the status endpoint failed (`statusLookupFailed`), rows render as `unknown`
 *   with Revoke disabled — never as Valid from account metadata alone.
 * - localStorage may still pin a row as revoked after a successful revoke in this
 *   browser; removing that browser state is a separate follow-up, not part of the
 *   admin-revocation review fixes.
 */
export function buildDisplayCredentials(
  credentials: IssuedVerifiableCredential[],
  owner: string,
  serverStatuses: IssuedCredentialStatusEntry[] = [],
  options: { statusLookupFailed?: boolean } = {}
): DisplayIssuedCredential[] {
  const viewState = readCredentialViewState(owner);
  const revokedCredentialIds = new Set(Object.keys(viewState.revokedCredentials));
  const serverCredentialIds = new Set(
    credentials.map((credential) => credential.id).filter(Boolean)
  );
  const statusByCredentialId = new Map(
    serverStatuses.filter((entry) => entry.credentialId).map((entry) => [entry.credentialId, entry])
  );
  const statusLookupFailed = options.statusLookupFailed === true;

  const serverCredentials = credentials
    .filter((credential) => credential.id)
    .map((credential) => {
      const pluginStatus = resolvePluginStatus(
        credential,
        statusByCredentialId,
        statusLookupFailed
      );
      let status = mapPluginStatus(pluginStatus);

      // Still honor a revoke remembered in this browser (localStorage). That keeps the
      // row looking Revoked after a successful revoke even if a later status poll is
      // briefly VALID/UNKNOWN. Do not treat this as the long-term source of truth.
      if (revokedCredentialIds.has(credential.id || '') || credential.revoked === true) {
        if (status === 'active' || status === 'unknown') {
          status = 'revoked';
        }
      }

      return toDisplayCredential(credential, status);
    });

  const retainedRevokedCredentials = Object.values(viewState.revokedCredentials)
    .filter((credential) => credential.id && !serverCredentialIds.has(credential.id))
    .map((credential) => toDisplayCredential(credential, 'revoked'));

  return [...serverCredentials, ...retainedRevokedCredentials];
}

export function getCredentialViewOwner(userProfile: UserProfile | null): string {
  return userProfile?.id || userProfile?.username || userProfile?.email || 'anonymous';
}

export function rememberRevokedCredential(owner: string, credential: IssuedVerifiableCredential) {
  if (!credential.id) return;

  const viewState = readCredentialViewState(owner);
  writeCredentialViewState(owner, {
    revokedCredentials: {
      ...viewState.revokedCredentials,
      [credential.id]: credential,
    },
  });
}

function toDisplayCredential(
  credential: IssuedVerifiableCredential,
  status: CredentialStatus
): DisplayIssuedCredential {
  return {
    ...credential,
    revoked: status === 'revoked',
    status,
  };
}

function readCredentialViewState(owner: string): StoredCredentialViewState {
  const emptyState: StoredCredentialViewState = {
    revokedCredentials: {},
  };

  if (typeof window === 'undefined') return emptyState;

  try {
    const rawState = window.localStorage.getItem(CREDENTIAL_VIEW_STATE_KEY);
    if (!rawState) return emptyState;

    const stateByOwner = JSON.parse(rawState) as Record<string, StoredCredentialViewState>;
    return {
      revokedCredentials: stateByOwner[owner]?.revokedCredentials || {},
    };
  } catch (error) {
    console.warn('Failed to read credential view state', error);
    return emptyState;
  }
}

function writeCredentialViewState(owner: string, state: StoredCredentialViewState) {
  if (typeof window === 'undefined') return;

  try {
    const rawState = window.localStorage.getItem(CREDENTIAL_VIEW_STATE_KEY);
    const stateByOwner = rawState
      ? (JSON.parse(rawState) as Record<string, StoredCredentialViewState>)
      : {};

    stateByOwner[owner] = state;
    window.localStorage.setItem(CREDENTIAL_VIEW_STATE_KEY, JSON.stringify(stateByOwner));
  } catch (error) {
    console.warn('Failed to write credential view state', error);
  }
}
