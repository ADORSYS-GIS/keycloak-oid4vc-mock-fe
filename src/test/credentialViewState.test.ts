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

describe('buildDisplayCredentials', () => {
  it('uses the plugin status carried on each row', () => {
    const display = buildDisplayCredentials([
      credential({ serverStatus: 'VALID' }),
      credential({
        id: 'cred-2',
        credentialType: 'DatevCompanyCredential',
        serverStatus: 'INVALID',
      }),
    ]);

    expect(display).toHaveLength(2);
    expect(display[0]).toMatchObject({ id: 'cred-1', status: 'active' });
    expect(display[1]).toMatchObject({
      id: 'cred-2',
      credentialType: 'DatevCompanyCredential',
      status: 'revoked',
    });
  });

  it('renders nothing for an empty server response', () => {
    expect(buildDisplayCredentials([])).toEqual([]);
  });

  it('treats a missing plugin status as unknown rather than valid', () => {
    const display = buildDisplayCredentials([credential()]);

    expect(display[0].status).toBe('unknown');
    expect(isRevocable(display[0].status)).toBe(false);
  });

  it('shows UNKNOWN and SUSPENDED as non-revocable', () => {
    const display = buildDisplayCredentials([
      credential({ serverStatus: 'UNKNOWN' }),
      credential({ id: 'cred-2', serverStatus: 'SUSPENDED' }),
    ]);

    expect(display.map((row) => row.status)).toEqual(['unknown', 'suspended']);
    expect(display.every((row) => !isRevocable(row.status))).toBe(true);
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
