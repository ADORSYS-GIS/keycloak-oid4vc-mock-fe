import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../components/Dashboard';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextType } from '../types';

vi.mock('../config/keycloak.config', () => ({
  default: {
    updateToken: vi.fn().mockResolvedValue(true),
    token: 'test-token',
    tokenParsed: { preferred_username: 'francis' },
  },
}));

const fetchMock = vi.fn();

// Remembers whether the revoke request already succeeded. The status endpoint then
// answers INVALID — the server's word for revoked — so the reload that follows the
// revoke sees the credential as revoked, exactly like the real plugin would answer.
let revocationCompleted = false;

const jsonResponse = (body: unknown, ok = true, statusText = 'OK') => ({
  ok,
  statusText,
  json: async () => body,
});

const authContext: AuthContextType = {
  isAuthenticated: true,
  isLoading: false,
  userProfile: { username: 'francis', firstName: 'Francis', lastName: 'Pouatcha', id: 'u-francis' },
  login: vi.fn(),
  logout: vi.fn(),
  getToken: () => 'test-token',
  hasRole: () => false,
};

describe('issued credential flow through the real service', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_KEYCLOAK_URL', 'http://keycloak.local');
    vi.stubEnv('VITE_KEYCLOAK_REALM', 'test-realm');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    revocationCompleted = false;
    window.localStorage.clear();

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const href = String(url);

      if (href.includes('/protocol/oid4vc/create-credential-offer')) {
        return jsonResponse({
          credential_offer_uri: 'https://issuer.example/offers/nonce-1',
        });
      }

      if (href.startsWith('https://issuer.example/offers/')) {
        return jsonResponse({
          credential_issuer: 'http://keycloak.local/realms/test-realm',
          credential_configuration_ids: ['DatevCompanyCredential'],
        });
      }

      if (href.includes('/account/issued-verifiable-credentials')) {
        return jsonResponse([
          {
            id: 'own-cred-1',
            credentialType: 'DatevCompanyCredential',
            issuedAt: 1788700000,
            clientName: 'wallet-app',
          },
        ]);
      }

      if (href.includes('/status-list/issued-credential-status')) {
        return jsonResponse({
          credentials: [
            { credentialId: 'own-cred-1', status: revocationCompleted ? 'INVALID' : 'VALID' },
          ],
        });
      }

      if (href.includes('/status-list/revoke')) {
        revocationCompleted = true;
        return jsonResponse({ success: true });
      }

      throw new Error(`Unexpected fetch ${init?.method ?? 'GET'} ${href}`);
    });
  });

  it('merges account metadata with plugin status and revokes through the status-list endpoint', async () => {
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={authContext}>
        <Dashboard />
      </AuthContext.Provider>
    );

    await user.click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('own-cred-1')).toBeInTheDocument();
    expect(screen.getByText('DatevCompanyCredential')).toBeInTheDocument();
    expect(screen.getByText('wallet-app')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Reason for revocation/), 'compromised');
    await user.click(dialog.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('own-cred-1')).toBeInTheDocument();

    const revokeCall = fetchMock.mock.calls.find(([url, init]) => {
      return String(url).includes('/status-list/revoke') && init?.method === 'POST';
    });
    expect(revokeCall).toBeDefined();
    const [, init] = revokeCall as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded'
    );
    const body = init.body as URLSearchParams;
    expect(body.get('mode')).toBe('issued_credential_revocation');
    expect(body.get('credential_id')).toBe('own-cred-1');
    expect(body.get('reason')).toBe('compromised');

    // After revoking, the dashboard reloads the list. The status endpoint must be asked
    // again, and the row must still show as Revoked based on the server's answer.
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).includes('/status-list/issued-credential-status')
        )
      ).toHaveLength(2);
    });
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });
});
