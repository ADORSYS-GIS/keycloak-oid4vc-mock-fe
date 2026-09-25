import type {
  IssuedCredentialStatusEntry,
  IssuedVerifiableCredential,
} from '../../services/oid4vc.service';
import type { UserProfile } from '../../types';
import type { CredentialStatus, DisplayIssuedCredential, StoredCredentialViewState } from './types';

const CREDENTIAL_VIEW_STATE_KEY = 'oid4vc-issued-credential-view-state';

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
 * Builds Credentials-tab rows.
 * - Plugin status drives the badge when listing succeeded.
 * - `omitUnlisted` hides account rows whose ids are not in plugin `credentials`.
 * - A failed status lookup (`statusLookupFailed`) renders rows as unknown and does not omit them.
 */
export function buildDisplayCredentials(
  credentials: IssuedVerifiableCredential[],
  owner: string,
  serverStatuses: IssuedCredentialStatusEntry[] = [],
  options: { statusLookupFailed?: boolean; omitUnlisted?: boolean } = {}
): DisplayIssuedCredential[] {
  const viewState = readCredentialViewState(owner);
  const revokedCredentialIds = new Set(Object.keys(viewState.revokedCredentials));
  const statusByCredentialId = new Map(
    serverStatuses.filter((entry) => entry.credentialId).map((entry) => [entry.credentialId, entry])
  );
  const statusLookupFailed = options.statusLookupFailed === true;
  const listedCredentials =
    options.omitUnlisted === true && !statusLookupFailed
      ? credentials.filter((credential) => credential.id && statusByCredentialId.has(credential.id))
      : credentials;
  const serverCredentialIds = new Set(
    listedCredentials.map((credential) => credential.id).filter(Boolean)
  );

  const serverCredentials = listedCredentials
    .filter((credential) => credential.id)
    .map((credential) => {
      let status: CredentialStatus = 'active';
      if (statusLookupFailed) {
        status = 'unknown';
      } else {
        const pluginStatus = statusByCredentialId.get(credential.id)?.status;
        status = mapPluginStatus(pluginStatus ?? credential.serverStatus);
      }
      if (
        revokedCredentialIds.has(credential.id || '') &&
        (status === 'active' || status === 'unknown')
      ) {
        status = 'revoked';
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
