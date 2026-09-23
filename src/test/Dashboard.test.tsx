import { act, render, screen, waitFor, within } from '@testing-library/react';
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
    // The plugin answers INVALID after a successful revoke. INVALID is the server's
    // word for revoked: the UI shows it as the "Revoked" badge. The reload that follows
    // the revoke reads this value instead of the stale VALID one.
    revokeIssuedCredential.mockImplementation(async () => {
      getIssuedCredentialStatus.mockResolvedValue([
        { credentialId: 'own-cred-1', status: 'INVALID' },
      ]);
    });
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
    // After revoking, the dashboard reloads the list. Count those reloads and check the
    // credential is still shown as Revoked once the reload finishes.
    await waitFor(() => expect(getIssuedCredentials).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('aborts the in-flight requests of a load that gets superseded', async () => {
    // Switching tabs starts a second load, which must cancel the first one. Record the
    // cancellation signals both loads hand to the service so we can check this.
    const observedSignals: AbortSignal[] = [];
    getIssuedCredentials.mockImplementation((signal?: AbortSignal) => {
      observedSignals.push(signal as AbortSignal);
      return new Promise(() => {}); // stay in flight until aborted
    });
    getIssuedCredentialStatus.mockImplementation((signal?: AbortSignal) => {
      observedSignals.push(signal as AbortSignal);
      return new Promise(() => {});
    });
    const user = userEvent.setup();

    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    await screen.findByText('Loading issued credentials...');

    // Starting a new load must abort the first one so its responses can never land.
    await user.click(screen.getByRole('button', { name: 'Credential Offer' }));
    await user.click(screen.getByRole('button', { name: 'Credentials' }));

    // Expect two loads, each sending one shared signal to both endpoints. Load one's
    // signal must be cancelled (aborted) once load two starts; load two's stays active.
    expect(observedSignals).toHaveLength(4);
    expect(observedSignals[0]).toBe(observedSignals[1]);
    expect(observedSignals[2]).toBe(observedSignals[3]);
    expect(observedSignals[0].aborted).toBe(true);
    expect(observedSignals[2].aborted).toBe(false);
  });

  it('does not send a revocation when the reason is only whitespace', async () => {
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
    await user.type(dialog.getByLabelText(/Reason for revocation/), '   ');

    expect(dialog.getByRole('button', { name: 'Revoke' })).toBeDisabled();
    expect(revokeIssuedCredential).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  it('keeps the credential active and the dialog open when revocation fails', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'own-cred-1', credentialType: 'IdentityCredential', issuedAt: 1788700000 },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'own-cred-1', status: 'VALID' }]);
    revokeIssuedCredential.mockRejectedValue(new Error('revoke rejected'));
    const user = userEvent.setup();

    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    await screen.findByText('own-cred-1');

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Reason for revocation/), 'compromised');
    await user.click(dialog.getByRole('button', { name: 'Revoke' }));

    expect(
      await screen.findByText('Failed to revoke issued credential. Please try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(screen.queryByText('Revoked')).not.toBeInTheDocument();
    expect(screen.getByText('own-cred-1')).toBeInTheDocument();
  });

  it('ignores a stale credential response when a newer load finishes first', async () => {
    let releaseFirstCredentials: (value: unknown) => void = () => {};
    let releaseFirstStatus: (value: unknown) => void = () => {};
    const firstCredentials = new Promise((resolve) => {
      releaseFirstCredentials = resolve;
    });
    const firstStatus = new Promise((resolve) => {
      releaseFirstStatus = resolve;
    });

    getIssuedCredentials.mockResolvedValue([
      { id: 'cred-new', credentialType: 'IdentityCredential' },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'cred-new', status: 'VALID' }]);
    getIssuedCredentials.mockImplementationOnce(() => firstCredentials);
    getIssuedCredentialStatus.mockImplementationOnce(() => firstStatus);

    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    expect(await screen.findByText('Loading issued credentials...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Credential Offer' }));
    await user.click(screen.getByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('cred-new')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();

    await act(async () => {
      releaseFirstCredentials([{ id: 'cred-old', credentialType: 'IdentityCredential' }]);
      releaseFirstStatus([{ credentialId: 'cred-old', status: 'INVALID' }]);
    });

    await waitFor(() => expect(getIssuedCredentials).toHaveBeenCalledTimes(2));
    expect(screen.getByText('cred-new')).toBeInTheDocument();
    expect(screen.queryByText('cred-old')).not.toBeInTheDocument();
    expect(screen.queryByText('Revoked')).not.toBeInTheDocument();
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
