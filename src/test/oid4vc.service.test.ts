import { beforeEach, describe, expect, it, vi } from 'vitest';
import oid4vcService from '../services/oid4vc.service';

// Runs before module evaluation: IS_PRE_AUTHORIZED_FLOW is a module-load constant,
// so the env pin must be in place before the service is imported.
vi.hoisted(() => {
  import.meta.env.VITE_OID4VC_PRE_AUTHORIZED = 'true';
});

// The auth boundary (Keycloak adapter) cannot run in jsdom, so it is replaced with a
// signed-in test identity; everything under test is the real service logic.
vi.mock('../config/keycloak.config', () => ({
  default: {
    token: 'test-token',
    tokenParsed: { preferred_username: 'francis' },
    updateToken: vi.fn().mockResolvedValue(true),
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  import.meta.env.VITE_KEYCLOAK_URL = 'https://kc.test';
  import.meta.env.VITE_KEYCLOAK_REALM = 'test-realm';
  fetchMock.mockReset();
});

describe('target_user propagation', () => {
  it('sends target_user on the credential offer request for another user', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ credential_offer_uri: 'https://issuer/offer' }));

    await oid4vcService.getCredentialOfferUri('IdentityCredential', 'chidi');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      'https://kc.test/realms/test-realm/protocol/oid4vc/create-credential-offer' +
        '?credential_configuration_id=IdentityCredential' +
        '&target_user=chidi&pre_authorized=true'
    );
  });

  it('keeps the authenticated user as the offer target when none is passed', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ credential_offer_uri: 'https://issuer/offer' }));

    await oid4vcService.getCredentialOfferUri('IdentityCredential');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('target_user=francis');
  });

  it('sends target_user in the revocation body for another user', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await oid4vcService.revokeIssuedCredential('cred-1', 'compromised', 'chidi');

    // The plugin path must stay distinct from Keycloak's standard OAuth token-revocation endpoint.
    expect(fetchMock.mock.calls[0][0]).toBe('https://kc.test/realms/test-realm/status-list/revoke');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(body.get('mode')).toBe('issued_credential_revocation');
    expect(body.get('credential_id')).toBe('cred-1');
    expect(body.get('reason')).toBe('compromised');
    expect(body.get('target_user')).toBe('chidi');
  });

  it('omits target_user when revoking own credentials (backward compatible request)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await oid4vcService.revokeIssuedCredential('cred-1', 'compromised', 'francis');

    expect(fetchMock.mock.calls[0][0]).toBe('https://kc.test/realms/test-realm/status-list/revoke');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(body.get('target_user')).toBeNull();
  });
});

describe('admin credential listing', () => {
  it('maps plugin INVALID status to revoked for the target user list', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        credentials: [
          {
            credentialId: 'chidi-cred-1',
            issuedAt: 1788700000,
            clientId: 'wallet',
            revision: '1',
            status: 'INVALID',
          },
        ],
      })
    );

    const credentials = await oid4vcService.getIssuedCredentialsFor('chidi');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://kc.test/realms/test-realm/status-list/issued-credential-status?target_user=chidi'
    );
    expect(credentials).toHaveLength(1);
    expect(credentials[0].id).toBe('chidi-cred-1');
    expect(credentials[0].revoked).toBe(true);
  });

  it('maps plugin VALID status to not revoked', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        credentials: [{ credentialId: 'chidi-cred-2', issuedAt: 1788700000, status: 'VALID' }],
      })
    );

    const credentials = await oid4vcService.getIssuedCredentialsFor('chidi');

    expect(credentials[0].revoked).toBe(false);
  });

  it('loads the self-service list from the account endpoint without a target param', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'own-cred-1' }]));

    const credentials = await oid4vcService.getIssuedCredentials();

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://kc.test/realms/test-realm/account/issued-verifiable-credentials'
    );
    expect(credentials[0].id).toBe('own-cred-1');
  });

  it('reads self-service live status from the plugin without target_user', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        credentials: [{ credentialId: 'own-cred-1', status: 'INVALID' }],
      })
    );

    const statuses = await oid4vcService.getIssuedCredentialStatus();

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://kc.test/realms/test-realm/status-list/issued-credential-status'
    );
    expect(statuses[0].status).toBe('INVALID');
  });

  it('lists every realm user, sizing the request from the count endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(2)); // /users/count
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 'u1', username: 'chidi', firstName: 'Chidi' }])
    );

    const users = await oid4vcService.getRealmUsers();

    expect(fetchMock.mock.calls[0][0]).toBe('https://kc.test/admin/realms/test-realm/users/count');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://kc.test/admin/realms/test-realm/users?briefRepresentation=true&max=2'
    );
    expect(users[0].username).toBe('chidi');
  });

  it('skips the list request when the realm has no users', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(0)); // /users/count

    const users = await oid4vcService.getRealmUsers();

    expect(users).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
