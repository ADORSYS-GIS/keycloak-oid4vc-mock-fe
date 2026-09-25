import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDisplayCredentials,
  mapPluginStatus,
  rememberRevokedCredential,
} from '../components/dashboard/credentialViewState';
import { isRevocable } from '../components/dashboard/types';
import type { IssuedVerifiableCredential } from '../services/oid4vc.service';

const credential = (
  overrides: Partial<IssuedVerifiableCredential> = {}
): IssuedVerifiableCredential => ({
  id: 'cred-1',
  credentialType: 'IdentityCredential',
  issuedAt: 1788700000,
  ...overrides,
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('mapPluginStatus', () => {
  it('maps each plugin status onto a distinct UI state; only VALID is revocable', () => {
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

describe('buildDisplayCredentials server status hydration', () => {
  it('marks a credential revoked when the plugin reports INVALID', () => {
    const display = buildDisplayCredentials([credential()], 'francis', [
      { credentialId: 'cred-1', status: 'INVALID' },
    ]);

    expect(display[0].status).toBe('revoked');
  });

  it('keeps a credential active when the plugin reports VALID', () => {
    const display = buildDisplayCredentials([credential()], 'francis', [
      { credentialId: 'cred-1', status: 'VALID' },
    ]);

    expect(display[0].status).toBe('active');
  });

  it('shows UNKNOWN and SUSPENDED as non-revocable, including admin lists that only send serverStatus', () => {
    const fromOverlay = buildDisplayCredentials(
      [credential(), credential({ id: 'cred-2' })],
      'francis',
      [
        { credentialId: 'cred-1', status: 'UNKNOWN' },
        { credentialId: 'cred-2', status: 'SUSPENDED' },
      ]
    );
    const fromAdminList = buildDisplayCredentials(
      [
        credential({ serverStatus: 'UNKNOWN' }),
        credential({ id: 'cred-2', serverStatus: 'SUSPENDED' }),
      ],
      'francis'
    );

    expect(fromOverlay.map((row) => row.status)).toEqual(['unknown', 'suspended']);
    expect(fromAdminList.map((row) => row.status)).toEqual(['unknown', 'suspended']);
  });

  it('keeps a locally remembered revocation when the plugin reports UNKNOWN', () => {
    rememberRevokedCredential('francis', credential());
    const display = buildDisplayCredentials([credential()], 'francis', [
      { credentialId: 'cred-1', status: 'UNKNOWN' },
    ]);

    expect(display[0].status).toBe('revoked');
  });

  it('keeps the locally remembered revocation when the plugin reports VALID again', () => {
    rememberRevokedCredential('francis', credential());
    const display = buildDisplayCredentials([credential()], 'francis', [
      { credentialId: 'cred-1', status: 'VALID' },
    ]);

    expect(display[0].status).toBe('revoked');
  });

  it('pins the server INVALID verdict over a locally remembered active state', () => {
    const display = buildDisplayCredentials([credential()], 'francis', [
      { credentialId: 'cred-1', status: 'INVALID' },
    ]);

    expect(display[0].status).toBe('revoked');
  });

  it('keeps locally revoked credentials visible when absent from the server list', () => {
    rememberRevokedCredential('francis', credential({ id: 'locally-revoked' }));
    const display = buildDisplayCredentials([credential({ id: 'cred-2' })], 'francis', []);

    expect(display).toHaveLength(2);
    expect(display.map((entry) => entry.status)).toContain('revoked');
  });
});

describe('fail-closed behaviour when the status endpoint is unreachable', () => {
  it('renders metadata as unknown so revoke stays disabled', () => {
    const display = buildDisplayCredentials([credential()], 'francis', [], {
      statusLookupFailed: true,
    });

    expect(display).toHaveLength(1);
    expect(display[0].status).toBe('unknown');
  });
});
