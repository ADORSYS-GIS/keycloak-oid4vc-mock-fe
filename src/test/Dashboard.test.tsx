import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../components/Dashboard';
import { AuthContext } from '../context/AuthContext';
import type { IssuedVerifiableCredential } from '../services/oid4vc.service';
import type { AuthContextType } from '../types';

const getIssuedCredentialsFor = vi.fn();
const getIssuedCredentials = vi.fn();
const getRealmUsers = vi.fn();
const revokeIssuedCredential = vi.fn();
const getCredentialOfferDeeplink = vi.fn();
const getIssuedCredentialLimits = vi.fn();

vi.mock('../services/oid4vc.service', () => ({
  IS_PRE_AUTHORIZED_FLOW: false,
  DEFAULT_CREDENTIAL_CONFIGURATION_ID: 'IdentityCredential',
  default: {
    getIssuedCredentialsFor: (...args: unknown[]) => getIssuedCredentialsFor(...args),
    getIssuedCredentials: (...args: unknown[]) => getIssuedCredentials(...args),
    getIssuedCredentialLimits: (...args: unknown[]) => getIssuedCredentialLimits(...args),
    getRealmUsers: (...args: unknown[]) => getRealmUsers(...args),
    revokeIssuedCredential: (...args: unknown[]) => revokeIssuedCredential(...args),
    getCredentialOfferDeeplink: (...args: unknown[]) => getCredentialOfferDeeplink(...args),
  },
}));

const authContext = (isAdmin: boolean): AuthContextType => ({
  isAuthenticated: true,
  isLoading: false,
  userProfile: { username: 'francis', firstName: 'Francis', lastName: 'Pouatcha', id: 'u-francis' },
  login: vi.fn(),
  logout: vi.fn(),
  getToken: () => 'test-token',
  hasRole: (role: string) => isAdmin && role === 'credential-offer-create',
});

const renderDashboard = (isAdmin: boolean) =>
  render(
    <AuthContext.Provider value={authContext(isAdmin)}>
      <Dashboard />
    </AuthContext.Provider>
  );

const chidiCredential: IssuedVerifiableCredential = {
  id: 'chidi-cred-1',
  credentialType: 'IdentityCredential',
  issuedAt: 1788700000,
  serverStatus: 'VALID',
  revoked: false,
};

// The logged-in admin (francis) is absent from this list. chidi is the other user.
const otherUsers = [
  { id: 'u-alice', username: 'alice', firstName: 'Alice', lastName: 'Nkemi' },
  { id: 'u-chidi', username: 'chidi', firstName: 'Chidi', lastName: 'Okafor' },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  getCredentialOfferDeeplink.mockResolvedValue('openid-credential-offer://offer');
  getRealmUsers.mockResolvedValue(otherUsers);
  getIssuedCredentials.mockResolvedValue([]);
  getIssuedCredentialLimits.mockResolvedValue([]);
  revokeIssuedCredential.mockResolvedValue(undefined);
});

// Waits for the admin selector to be rendered AND backed by the loaded user list.
const findEnabledTargetSelector = async () => {
  const selector = await screen.findByLabelText('On behalf of user');
  await waitFor(() => expect(selector).not.toBeDisabled());
  return selector;
};

describe('admin listing and revocation', () => {
  it('lists another user’s VALID credential then revokes it by id only', async () => {
    getIssuedCredentialsFor.mockResolvedValue([chidiCredential]);
    renderDashboard(true);

    const user = userEvent.setup();
    await user.selectOptions(await findEnabledTargetSelector(), 'chidi');
    await user.click(screen.getByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('chidi-cred-1')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(getIssuedCredentialsFor).toHaveBeenCalledWith('chidi', expect.any(AbortSignal));
    expect(getIssuedCredentialsFor).toHaveBeenCalledTimes(1);
    revokeIssuedCredential.mockImplementation(async () => {
      getIssuedCredentialsFor.mockResolvedValue([
        { ...chidiCredential, serverStatus: 'INVALID', revoked: true },
      ]);
    });

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Reason for revocation/), 'compromised');
    await user.click(dialog.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('chidi-cred-1')).toBeInTheDocument();
    expect(revokeIssuedCredential).toHaveBeenCalledTimes(1);
    expect(revokeIssuedCredential).toHaveBeenCalledWith('chidi-cred-1', 'compromised');
    await waitFor(() => expect(getIssuedCredentialsFor).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });
});

describe('credential list rendering from server responses', () => {
  it('shows an error when the credential list request fails', async () => {
    getIssuedCredentials.mockRejectedValue(new Error('plugin down'));

    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(
      await screen.findByText('Failed to retrieve issued credentials. Please try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('own-cred-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.queryByText(/no successful status-list mapping/i)).not.toBeInTheDocument();
  });

  it('shows UNKNOWN and SUSPENDED distinctly and keeps revoke disabled', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'unknown-1', credentialType: 'IdentityCredential', serverStatus: 'UNKNOWN' },
      { id: 'suspended-1', credentialType: 'IdentityCredential', serverStatus: 'SUSPENDED' },
    ]);

    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('unknown-1')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' });
    expect(revokeButtons).toHaveLength(2);
    expect(revokeButtons[0]).toBeDisabled();
    expect(revokeButtons[1]).toBeDisabled();
  });

  it('lists leftovers with mapping and quota fields instead of a dangling banner', async () => {
    getIssuedCredentials.mockResolvedValue([
      {
        id: 'leftover-1',
        credentialType: 'IdentityCredential',
        serverStatus: 'UNKNOWN',
        mappingStatus: null,
        countsTowardQuota: true,
      },
    ]);

    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('leftover-1')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText(/no successful status-list mapping/i)).toBeInTheDocument();
    expect(screen.queryByText(/issuance record/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled();
  });

  it('lists admin leftovers with mapping fields and the leftover notice', async () => {
    getIssuedCredentialsFor.mockResolvedValue([
      {
        id: 'admin-leftover-1',
        credentialType: 'IdentityCredential',
        serverStatus: 'UNKNOWN',
        mappingStatus: null,
        countsTowardQuota: true,
      },
    ]);
    renderDashboard(true);

    const user = userEvent.setup();
    await user.selectOptions(await findEnabledTargetSelector(), 'chidi');
    await user.click(screen.getByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('admin-leftover-1')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText(/no successful status-list mapping/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled();
  });

  it('hides the leftover notice when credentials have no incomplete mapping', async () => {
    getIssuedCredentials.mockResolvedValue([
      {
        id: 'own-cred-1',
        credentialType: 'IdentityCredential',
        serverStatus: 'UNKNOWN',
        mappingStatus: 'SUCCESS',
      },
    ]);

    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('own-cred-1')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText(/no successful status-list mapping/i)).not.toBeInTheDocument();
  });
});

describe('server-authoritative credential list', () => {
  it('marks the credential revoked immediately after revoking, keeping it visible', async () => {
    getIssuedCredentials.mockResolvedValue([
      {
        id: 'own-cred-1',
        credentialType: 'IdentityCredential',
        issuedAt: 1788700000,
        serverStatus: 'VALID',
      },
    ]);
    revokeIssuedCredential.mockImplementation(async () => {
      getIssuedCredentials.mockResolvedValue([
        {
          id: 'own-cred-1',
          credentialType: 'IdentityCredential',
          issuedAt: 1788700000,
          serverStatus: 'INVALID',
        },
      ]);
    });
    const user = userEvent.setup();

    renderDashboard(false);
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    await screen.findByText('own-cred-1');

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Reason for revocation/), 'compromised');
    await user.click(dialog.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('own-cred-1')).toBeInTheDocument();
    expect(revokeIssuedCredential).toHaveBeenCalledWith('own-cred-1', 'compromised');
    await waitFor(() => expect(getIssuedCredentials).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('aborts a superseded load and ignores its late response', async () => {
    let releaseFirstCredentials: (value: unknown) => void = () => {};
    let firstSignal: AbortSignal | undefined;
    const firstCredentials = new Promise((resolve) => {
      releaseFirstCredentials = resolve;
    });

    getIssuedCredentials.mockResolvedValue([
      { id: 'cred-new', credentialType: 'IdentityCredential', serverStatus: 'VALID' },
    ]);
    getIssuedCredentials.mockImplementationOnce((signal?: AbortSignal) => {
      firstSignal = signal;
      return firstCredentials;
    });

    const user = userEvent.setup();
    renderDashboard(false);
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    expect(await screen.findByText('Loading issued credentials...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Credential Offer' }));
    await user.click(screen.getByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('cred-new')).toBeInTheDocument();
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      releaseFirstCredentials([
        { id: 'cred-old', credentialType: 'IdentityCredential', serverStatus: 'INVALID' },
      ]);
    });

    await waitFor(() => expect(getIssuedCredentials).toHaveBeenCalledTimes(2));
    expect(screen.getByText('cred-new')).toBeInTheDocument();
    expect(screen.queryByText('cred-old')).not.toBeInTheDocument();
    expect(screen.queryByText('Revoked')).not.toBeInTheDocument();
  });

  it('does not send a revocation when the reason is only whitespace', async () => {
    getIssuedCredentials.mockResolvedValue([
      {
        id: 'own-cred-1',
        credentialType: 'IdentityCredential',
        issuedAt: 1788700000,
        serverStatus: 'VALID',
      },
    ]);
    const user = userEvent.setup();

    renderDashboard(false);
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
      {
        id: 'own-cred-1',
        credentialType: 'IdentityCredential',
        issuedAt: 1788700000,
        serverStatus: 'VALID',
      },
    ]);
    revokeIssuedCredential.mockRejectedValue(new Error('revoke rejected'));
    const user = userEvent.setup();

    renderDashboard(false);
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

  it('reflects a revocation performed in another client after refreshing the list', async () => {
    getIssuedCredentials.mockResolvedValue([
      {
        id: 'own-cred-1',
        credentialType: 'IdentityCredential',
        issuedAt: 1788700000,
        serverStatus: 'VALID',
      },
    ]);
    const user = userEvent.setup();

    renderDashboard(false);
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    await screen.findByText('Valid');

    getIssuedCredentials.mockResolvedValue([
      {
        id: 'own-cred-1',
        credentialType: 'IdentityCredential',
        issuedAt: 1788700000,
        serverStatus: 'INVALID',
      },
    ]);
    await user.click(screen.getByRole('button', { name: 'Refresh credentials' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('own-cred-1')).toBeInTheDocument();
  });

  it('shows the empty state when the server returns no credentials', async () => {
    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('No issued credentials found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });
});
