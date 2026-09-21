import { describe, expect, it } from 'vitest';
import {
  buildDisplayCredentials,
  mapPluginStatus,
  purgeLegacyCredentialViewState,
} from '../components/dashboard/credentialViewState';
import { isRevocable } from '../components/dashboard/types';
import type { IssuedVerifiableCredential } from '../services/oid4vc.service';

const credential = (
  overrides: Partial<IssuedVerifiableCredential> = {}
): IssuedVerifiableCredential => ({
  id: 'cred-1',
  credentialType: 'IdentityCredential',
  issuedAt: 1788700000,
  revision: '1',
  clientName: 'wallet-app',
  ...overrides,
});

describe('mapPluginStatus', () => {
  it('maps each plugin status; only VALID is revocable', () => {
    expect(mapPluginStatus('VALID')).toBe('active');
    expect(mapPluginStatus('INVALID')).toBe('revoked');
    expect(mapPluginStatus('SUSPENDED')).toBe('suspended');
    expect(mapPluginStatus('UNKNOWN')).toBe('unknown');
    expect(mapPluginStatus(undefined)).toBe('unknown');
    expect(isRevocable('active')).toBe(true);
    expect(isRevocable('revoked')).toBe(false);
    expect(isRevocable('suspended')).toBe(false);
    expect(isRevocable('unknown')).toBe(false);
  });
});

describe('buildDisplayCredentials response merging', () => {
  it('merges metadata and status by issued credential id', () => {
    const display = buildDisplayCredentials(
      [credential(), credential({ id: 'cred-2', credentialType: 'DatevCompanyCredential' })],
      [
        { credentialId: 'cred-1', status: 'VALID' },
        { credentialId: 'cred-2', status: 'INVALID' },
      ]
    );

    expect(display).toHaveLength(2);
    expect(display[0]).toMatchObject({
      id: 'cred-1',
      credentialType: 'IdentityCredential',
      clientName: 'wallet-app',
      status: 'active',
    });
    expect(display[1]).toMatchObject({
      id: 'cred-2',
      credentialType: 'DatevCompanyCredential',
      status: 'revoked',
    });
  });

  it('shows a server-reported revoked credential as revoked and keeps it visible', () => {
    const display = buildDisplayCredentials(
      [credential()],
      [{ credentialId: 'cred-1', status: 'INVALID' }]
    );

    expect(display).toHaveLength(1);
    expect(display[0].status).toBe('revoked');
  });

  it('renders nothing for an empty server response', () => {
    expect(buildDisplayCredentials([], [])).toEqual([]);
  });

  it('does not display credentials missing from the account response', () => {
    const display = buildDisplayCredentials(
      [credential({ id: 'cred-2' })],
      [
        { credentialId: 'cred-1', status: 'INVALID' },
        { credentialId: 'cred-2', status: 'VALID' },
      ]
    );

    expect(display.map((entry) => entry.id)).toEqual(['cred-2']);
  });

  it('treats a missing plugin entry as unknown rather than valid', () => {
    const display = buildDisplayCredentials(
      [credential()],
      [{ credentialId: 'other-cred', status: 'VALID' }]
    );

    expect(display[0].status).toBe('unknown');
  });
});

describe('fail-closed behaviour when the status endpoint is unreachable', () => {
  it('renders metadata as unknown so revoke stays disabled', () => {
    const display = buildDisplayCredentials([credential()], [], { statusLookupFailed: true });

    expect(display).toHaveLength(1);
    expect(display[0].status).toBe('unknown');
    expect(isRevocable(display[0].status)).toBe(false);
  });
});

describe('purgeLegacyCredentialViewState', () => {
  it('removes the legacy localStorage key from previous builds', () => {
    window.localStorage.setItem(
      'oid4vc-issued-credential-view-state',
      JSON.stringify({ francis: { revokedCredentials: { 'cred-1': { id: 'cred-1' } } } })
    );

    purgeLegacyCredentialViewState();

    expect(window.localStorage.getItem('oid4vc-issued-credential-view-state')).toBeNull();
  });
});
