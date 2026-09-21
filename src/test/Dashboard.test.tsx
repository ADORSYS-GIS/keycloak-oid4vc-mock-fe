import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../components/Dashboard';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextType } from '../types';

const getIssuedCredentials = vi.fn();
const getIssuedCredentialStatus = vi.fn();
const revokeIssuedCredential = vi.fn();
const getCredentialOfferDeeplink = vi.fn();

vi.mock('../services/oid4vc.service', () => ({
  IS_PRE_AUTHORIZED_FLOW: false,
  default: {
    getIssuedCredentials: (...args: unknown[]) => getIssuedCredentials(...args),
    getIssuedCredentialStatus: (...args: unknown[]) => getIssuedCredentialStatus(...args),
    revokeIssuedCredential: (...args: unknown[]) => revokeIssuedCredential(...args),
    getCredentialOfferDeeplink: (...args: unknown[]) => getCredentialOfferDeeplink(...args),
  },
}));

const authContext: AuthContextType = {
  isAuthenticated: true,
  isLoading: false,
  userProfile: { username: 'francis', firstName: 'Francis', lastName: 'Pouatcha', id: 'u-francis' },
  login: vi.fn(),
  logout: vi.fn(),
  getToken: () => 'test-token',
  hasRole: () => false,
};

const renderDashboard = () =>
  render(
    <AuthContext.Provider value={authContext}>
      <Dashboard />
    </AuthContext.Provider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  getCredentialOfferDeeplink.mockResolvedValue('openid-credential-offer://offer');
  getIssuedCredentials.mockResolvedValue([]);
  getIssuedCredentialStatus.mockResolvedValue([]);
  revokeIssuedCredential.mockResolvedValue(undefined);
});

describe('server-authoritative credential list', () => {
  it('merges account metadata with plugin status', async () => {
    getIssuedCredentials.mockResolvedValue([
      {
        id: 'own-cred-1',
        credentialType: 'DatevCompanyCredential',
        issuedAt: 1788700000,
        clientName: 'wallet-app',
      },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'own-cred-1', status: 'VALID' }]);

    renderDashboard();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('own-cred-1')).toBeInTheDocument();
    expect(screen.getByText('DatevCompanyCredential')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  it('shows an error when the account metadata list fails', async () => {
    getIssuedCredentials.mockRejectedValue(new Error('account endpoint down'));

    renderDashboard();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(
      await screen.findByText('Failed to retrieve issued credentials. Please try again.')
    ).toBeInTheDocument();
  });

  it('fail-closes to Unknown and disables revoke when status lookup fails', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'own-cred-1', credentialType: 'IdentityCredential' },
    ]);
    getIssuedCredentialStatus.mockRejectedValue(new Error('plugin down'));

    renderDashboard();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('own-cred-1')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled();
  });

  it('marks the credential revoked immediately after revoking, keeping it visible', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'own-cred-1', credentialType: 'IdentityCredential', issuedAt: 1788700000 },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'own-cred-1', status: 'VALID' }]);
    const user = userEvent.setup();

    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    await screen.findByText('own-cred-1');

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Reason for revocation/), 'compromised');
    await user.click(dialog.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('own-cred-1')).toBeInTheDocument();
    expect(revokeIssuedCredential).toHaveBeenCalledWith('own-cred-1', 'compromised');
    expect(window.localStorage.length).toBe(0);
  });

  it('reflects a revocation performed in another client after refreshing the list', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'own-cred-1', credentialType: 'IdentityCredential', issuedAt: 1788700000 },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'own-cred-1', status: 'VALID' }]);
    const user = userEvent.setup();

    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    await screen.findByText('Valid');

    getIssuedCredentialStatus.mockResolvedValue([
      { credentialId: 'own-cred-1', status: 'INVALID' },
    ]);
    await user.click(screen.getByRole('button', { name: 'Refresh credentials' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('own-cred-1')).toBeInTheDocument();
  });

  it('shows the empty state when the server returns no credentials', async () => {
    renderDashboard();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('No issued credentials found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  it('purges the legacy localStorage key on mount', async () => {
    window.localStorage.setItem(
      'oid4vc-issued-credential-view-state',
      JSON.stringify({ francis: { revokedCredentials: { 'own-cred-1': { id: 'own-cred-1' } } } })
    );

    renderDashboard();

    await waitFor(() => {
      expect(window.localStorage.getItem('oid4vc-issued-credential-view-state')).toBeNull();
    });
  });
});
