import type {
  IssuedCredentialStatusEntry,
  IssuedVerifiableCredential,
} from '../../services/oid4vc.service';
import type { UserProfile } from '../../types';
import type { CredentialStatus, DisplayIssuedCredential, StoredCredentialViewState } from './types';

const CREDENTIAL_VIEW_STATE_KEY = 'oid4vc-issued-credential-view-state';

/**
 * Overrides a credential's locally remembered status with the server-backed status of the
 * token status plugin. Revocations from any portal (self or admin) mark the token `INVALID`
 * on the server, so the plugin view is authoritative and keeps both portals consistent.
 */
function applyServerStatuses(
  credentials: IssuedVerifiableCredential[],
  statuses: IssuedCredentialStatusEntry[]
): IssuedVerifiableCredential[] {
  const statusByCredentialId = new Map(statuses.map((entry) => [entry.credentialId, entry]));

  return credentials.map((credential) => {
    const serverStatus = statusByCredentialId.get(credential.id);
    if (!serverStatus || serverStatus.status === 'UNKNOWN') return credential;

    return { ...credential, revoked: serverStatus.status === 'INVALID' };
  });
}

export function buildDisplayCredentials(
  credentials: IssuedVerifiableCredential[],
  owner: string,
  serverStatuses: IssuedCredentialStatusEntry[] = []
): DisplayIssuedCredential[] {
  const viewState = readCredentialViewState(owner);
  const revokedCredentialIds = new Set(Object.keys(viewState.revokedCredentials));
  const serverCredentialIds = new Set(
    credentials.map((credential) => credential.id).filter(Boolean)
  );

  const serverCredentials = applyServerStatuses(credentials, serverStatuses)
    .filter((credential) => credential.id)
    .map((credential) =>
      toDisplayCredential(
        credential,
        revokedCredentialIds.has(credential.id || '') || credential.revoked === true
          ? 'revoked'
          : 'active'
      )
    );

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
