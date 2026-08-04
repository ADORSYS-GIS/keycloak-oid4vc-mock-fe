import type { IssuedVerifiableCredential } from '../../services/oid4vc.service';
import type { UserProfile } from '../../types';
import type { CredentialStatus, DisplayIssuedCredential, StoredCredentialViewState } from './types';

const CREDENTIAL_VIEW_STATE_KEY = 'oid4vc-issued-credential-view-state';

export function buildDisplayCredentials(
  credentials: IssuedVerifiableCredential[],
  owner: string
): DisplayIssuedCredential[] {
  const viewState = readCredentialViewState(owner);
  const removedCredentialIds = new Set(viewState.removedCredentialIds);
  const revokedCredentialIds = new Set(Object.keys(viewState.revokedCredentials));
  const serverCredentialIds = new Set(
    credentials.map((credential) => credential.id).filter(Boolean)
  );

  const serverCredentials = credentials
    .filter((credential) => credential.id && !removedCredentialIds.has(credential.id))
    .map((credential) =>
      toDisplayCredential(
        credential,
        revokedCredentialIds.has(credential.id || '') ? 'revoked' : 'active'
      )
    );

  const retainedRevokedCredentials = Object.values(viewState.revokedCredentials)
    .filter(
      (credential) =>
        credential.id &&
        !removedCredentialIds.has(credential.id) &&
        !serverCredentialIds.has(credential.id)
    )
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
    removedCredentialIds: viewState.removedCredentialIds.filter(
      (credentialId) => credentialId !== credential.id
    ),
  });
}

export function rememberRemovedCredential(owner: string, credentialId: string) {
  const viewState = readCredentialViewState(owner);
  const removedCredentialIds = new Set(viewState.removedCredentialIds);
  removedCredentialIds.add(credentialId);

  const revokedCredentials = { ...viewState.revokedCredentials };
  delete revokedCredentials[credentialId];

  writeCredentialViewState(owner, {
    revokedCredentials,
    removedCredentialIds: Array.from(removedCredentialIds),
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
    removedCredentialIds: [],
  };

  if (typeof window === 'undefined') return emptyState;

  try {
    const rawState = window.localStorage.getItem(CREDENTIAL_VIEW_STATE_KEY);
    if (!rawState) return emptyState;

    const stateByOwner = JSON.parse(rawState) as Record<string, StoredCredentialViewState>;
    return {
      revokedCredentials: stateByOwner[owner]?.revokedCredentials || {},
      removedCredentialIds: stateByOwner[owner]?.removedCredentialIds || [],
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
