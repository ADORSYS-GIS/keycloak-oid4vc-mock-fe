import { beforeEach, describe, expect, it, vi } from 'vitest';
import oid4vcService from '../services/oid4vc.service';

// The keycloak config instantiates a real adapter at import time; replace it with the
// minimal surface the service uses (token freshness + parsed username).
vi.mock('../config/keycloak.config', () => ({
  default: {
    updateToken: vi.fn().mockResolvedValue(true),
    token: 'test-token',
    tokenParsed: { preferred_username: 'francis' },
  },
}));

const fetchMock = vi.fn();

const jsonResponse = (body: unknown, ok = true, statusText = 'OK') => ({
  ok,
  statusText,
  json: async () => body,
});

describe('getIssuedCredentialStatus', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_KEYCLOAK_URL', 'http://keycloak.local');
    vi.stubEnv('VITE_KEYCLOAK_REALM', 'test-realm');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('unwraps the credentials envelope returned by the plugin', async () => {
    const entry = { credentialId: 'cred-1', status: 'VALID', clientName: 'wallet-app' };
    fetchMock.mockResolvedValue(jsonResponse({ credentials: [entry] }));

    await expect(oid4vcService.getIssuedCredentialStatus()).resolves.toEqual([entry]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://keycloak.local/realms/test-realm/status-list/issued-credential-status'
    );
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('surfaces the server-provided error message when the plugin responds with an error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error_description: 'status list unavailable' }, false, 'Service Unavailable')
    );

    await expect(oid4vcService.getIssuedCredentialStatus()).rejects.toThrow(
      'Issued credential status lookup failed: status list unavailable'
    );
  });

  it('falls back to the HTTP status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable',
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(oid4vcService.getIssuedCredentialStatus()).rejects.toThrow(
      'Issued credential status lookup failed: Service Unavailable'
    );
  });
});

describe('revokeIssuedCredential', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_KEYCLOAK_URL', 'http://keycloak.local');
    vi.stubEnv('VITE_KEYCLOAK_REALM', 'test-realm');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
  });

  it('posts the revocation as a form body with the plugin-required fields', async () => {
    await oid4vcService.revokeIssuedCredential('cred-1', 'compromised');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://keycloak.local/realms/test-realm/status-list/revoke');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    );
    const body = init.body as URLSearchParams;
    expect(body.get('mode')).toBe('issued_credential_revocation');
    expect(body.get('credential_id')).toBe('cred-1');
    expect(body.get('reason')).toBe('compromised');
  });

  it('throws with the server-provided message when the revocation is rejected', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'already revoked' }, false, 'Conflict'));

    await expect(oid4vcService.revokeIssuedCredential('cred-1', 'reason')).rejects.toThrow(
      'Issued credential revocation failed: already revoked'
    );
  });
});
