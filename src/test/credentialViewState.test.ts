import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDisplayCredentials,
  rememberRevokedCredential,
} from '../components/dashboard/credentialViewState';
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

describe('buildDisplayCredentials server status hydration', () => {
  it('marks a credential revoked when the plugin reports INVALID (admin revocation reflected for holder)', () => {
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

  it('leaves locally remembered revocation untouched when the plugin reports UNKNOWN', () => {
    rememberRevokedCredential('francis', credential());
    const display = buildDisplayCredentials([credential()], 'francis', [
      { credentialId: 'cred-1', status: 'UNKNOWN' },
    ]);

    expect(display[0].status).toBe('revoked');
  });

  it('keeps the locally remembered revocation when the plugin reports VALID again', () => {
    // A locally remembered revocation is never un-revoked client-side: revoked
    // credentials stay auditable, and the plugin endpoint does not report why a
    // status changed. The dashboard therefore keeps the revocation pinned.
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

    // Server is authoritative even if this browser never saw the revocation.
    expect(display[0].status).toBe('revoked');
  });

  it('keeps locally revoked credentials visible when absent from the server list', () => {
    rememberRevokedCredential('francis', credential({ id: 'locally-revoked' }));
    const display = buildDisplayCredentials([credential({ id: 'cred-2' })], 'francis', []);

    const statuses = display.map((entry) => entry.status);
    expect(statuses).toContain('revoked');
    expect(display).toHaveLength(2);
  });
});
