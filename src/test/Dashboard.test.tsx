import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../components/Dashboard';
import { AuthContext } from '../context/AuthContext';
import type { IssuedVerifiableCredential } from '../services/oid4vc.service';
import type { AuthContextType } from '../types';

const getIssuedCredentialsFor = vi.fn();
const getIssuedCredentials = vi.fn();
const getIssuedCredentialStatus = vi.fn();
const getRealmUsers = vi.fn();
const revokeIssuedCredential = vi.fn();
const getCredentialOfferDeeplink = vi.fn();

vi.mock('../services/oid4vc.service', () => ({
  IS_PRE_AUTHORIZED_FLOW: false,
  default: {
    getIssuedCredentialsFor: (...args: unknown[]) => getIssuedCredentialsFor(...args),
    getIssuedCredentials: (...args: unknown[]) => getIssuedCredentials(...args),
    getIssuedCredentialStatus: (...args: unknown[]) => getIssuedCredentialStatus(...args),
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

// The logged-in admin (francis) is intentionally absent from the target list; the
// race tests therefore use alice (slow) and chidi (fast) as targets.
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
  getIssuedCredentialStatus.mockResolvedValue([]);
  revokeIssuedCredential.mockResolvedValue(undefined);
});

// Waits for the admin selector to be rendered AND backed by the loaded user list.
const findEnabledTargetSelector = async () => {
  const selector = await screen.findByLabelText('On behalf of user');
  await waitFor(() => expect(selector).not.toBeDisabled());
  return selector;
};

describe('admin versus holder access', () => {
  it('shows the admin target selector to role holders only', async () => {
    renderDashboard(true);

    expect(await screen.findByLabelText('On behalf of user')).toBeInTheDocument();
  });

  it('fail-closes user loading when the token has credential-offer-create but not view-users', async () => {
    getRealmUsers.mockRejectedValue(new Error('Realm users count failed: Forbidden'));
    renderDashboard(true);

    expect(
      await screen.findByText('Failed to load users. Please check your permissions and refresh.')
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('On behalf of user')).toBeDisabled();
  });

  it('does not render the admin selector for users without the role', async () => {
    renderDashboard(false);

    await waitFor(() => {
      expect(getCredentialOfferDeeplink).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText('On behalf of user')).not.toBeInTheDocument();
    expect(getRealmUsers).not.toHaveBeenCalled();
  });

  it('excludes the logged-in admin from the target list to avoid a duplicate entry', async () => {
    renderDashboard(true);

    const selector = await findEnabledTargetSelector();
    // The self entry is the valueless first option; the admin's username must not
    // appear as any other selectable entry.
    const labels = Array.from(selector.querySelectorAll('option')).map(
      (option) => option.textContent ?? ''
    );
    expect(labels.filter((label) => label.includes('(francis)'))).toHaveLength(1);
    expect(labels.some((label) => label.includes('(alice)'))).toBe(true);
    expect(labels.some((label) => label.includes('(chidi)'))).toBe(true);
  });
});

describe('admin listing and revocation', () => {
  it('lists another user’s VALID credential then revokes it by id only', async () => {
    getIssuedCredentialsFor.mockResolvedValue([chidiCredential]);
    renderDashboard(true);

    const user = userEvent.setup();
    await user.selectOptions(await findEnabledTargetSelector(), 'chidi');
    await user.click(screen.getByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('chidi-cred-1')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(getIssuedCredentialsFor).toHaveBeenCalledWith('chidi');
    expect(getIssuedCredentialsFor).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/Reason for revocation/), 'compromised');
    await user.click(dialog.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('chidi-cred-1')).toBeInTheDocument();
    expect(revokeIssuedCredential).toHaveBeenCalledTimes(1);
    expect(revokeIssuedCredential).toHaveBeenCalledWith('chidi-cred-1', 'compromised');
  });

  it('shows an error when the admin credential list request fails', async () => {
    getIssuedCredentialsFor.mockRejectedValue(new Error('plugin down'));
    renderDashboard(true);

    const user = userEvent.setup();
    await user.selectOptions(await findEnabledTargetSelector(), 'chidi');
    await user.click(screen.getByRole('button', { name: 'Credentials' }));

    expect(
      await screen.findByText('Failed to retrieve issued credentials. Please try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Valid')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });
});

describe('credential list rendering from server responses', () => {
  it('fail-closes to Unknown and disables revoke when the plugin status lookup fails', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'own-cred-1', credentialType: 'IdentityCredential' },
    ]);
    getIssuedCredentialStatus.mockRejectedValue(new Error('plugin down'));

    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('own-cred-1')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('Valid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled();
  });

  it('shows UNKNOWN and SUSPENDED distinctly and keeps revoke disabled', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'unknown-1', credentialType: 'IdentityCredential' },
      { id: 'suspended-1', credentialType: 'IdentityCredential' },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([
      { credentialId: 'unknown-1', status: 'UNKNOWN' },
      { credentialId: 'suspended-1', status: 'SUSPENDED' },
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
});

describe('stale responses when changing targets quickly', () => {
  it('ignores a slow credential list for the previous target once a newer one is selected', async () => {
    let resolveAliceList!: (credentials: IssuedVerifiableCredential[]) => void;
    getIssuedCredentialsFor.mockImplementation((target: string) => {
      if (target === 'alice') {
        return new Promise<IssuedVerifiableCredential[]>((resolve) => {
          resolveAliceList = resolve;
        });
      }
      return Promise.resolve([chidiCredential]);
    });

    renderDashboard(true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Credentials' }));
    await screen.findByText(/No issued credentials found/); // self list loaded

    await user.selectOptions(await findEnabledTargetSelector(), 'alice'); // hangs
    await user.selectOptions(await findEnabledTargetSelector(), 'chidi'); // resolves
    await screen.findByText('chidi-cred-1');

    // The slow alice response lands after chidi's — it must NOT replace her list.
    // The waitFor yields to the event loop so a stale update would have flushed
    // here if the guard were broken; then the list must still be chidi's.
    resolveAliceList([{ id: 'alice-cred-old', credentialType: 'IdentityCredential' }]);
    await waitFor(() => {
      expect(screen.getByText('chidi-cred-1')).toBeInTheDocument();
    });
    expect(screen.queryByText('alice-cred-old')).not.toBeInTheDocument();
  });

  it('ignores a slow offer response for the previous target once a newer one resolves', async () => {
    // prepareQr fires two parallel calls per target (by-reference and by-value).
    // BOTH alice calls must share one pending promise so that Promise.all settles
    // when the stale response lands — otherwise the stale-success path is never
    // reached and the test passes vacuously regardless of the race guard.
    let resolveAliceOffer!: (value: string) => void;
    const alicePending = new Promise<string>((resolve) => {
      resolveAliceOffer = resolve;
    });
    getCredentialOfferDeeplink.mockImplementation(
      (byReference: boolean, _type: string, target?: string) => {
        if (target === 'alice') return alicePending;
        const mode = byReference ? 'ref' : 'val';
        return Promise.resolve(`openid-credential-offer://offer-for-${target ?? 'me'}-${mode}`);
      }
    );
    renderDashboard(true);
    const user = userEvent.setup();
    await screen.findByDisplayValue(/offer-for-me-ref/); // initial self offer rendered

    await user.selectOptions(await findEnabledTargetSelector(), 'alice'); // hangs
    await user.selectOptions(await findEnabledTargetSelector(), 'chidi'); // resolves
    await screen.findByDisplayValue(/offer-for-chidi-ref/);

    // The slow alice offer lands after chidi's — it must NOT replace his QR link.
    resolveAliceOffer('openid-credential-offer://offer-for-alice');
    await waitFor(() => {
      expect(screen.getByDisplayValue(/offer-for-chidi-ref/)).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue(/offer-for-alice/)).not.toBeInTheDocument();
  });
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

    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('own-cred-1')).toBeInTheDocument();
    expect(screen.getByText('DatevCompanyCredential')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  it('shows an error when the account metadata list fails', async () => {
    getIssuedCredentials.mockRejectedValue(new Error('account endpoint down'));

    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(
      await screen.findByText('Failed to retrieve issued credentials. Please try again.')
    ).toBeInTheDocument();
  });

  it('marks the credential revoked immediately after revoking, keeping it visible', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'own-cred-1', credentialType: 'IdentityCredential', issuedAt: 1788700000 },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'own-cred-1', status: 'VALID' }]);
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
    expect(window.localStorage.length).toBe(0);
  });

  it('does not send a revocation when the reason is only whitespace', async () => {
    getIssuedCredentials.mockResolvedValue([
      { id: 'own-cred-1', credentialType: 'IdentityCredential', issuedAt: 1788700000 },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'own-cred-1', status: 'VALID' }]);
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
      { id: 'own-cred-1', credentialType: 'IdentityCredential', issuedAt: 1788700000 },
    ]);
    getIssuedCredentialStatus.mockResolvedValue([{ credentialId: 'own-cred-1', status: 'VALID' }]);
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
    renderDashboard(false);
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

    renderDashboard(false);
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
    renderDashboard(false);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Credentials' }));

    expect(await screen.findByText('No issued credentials found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  it('purges the legacy localStorage key on mount', async () => {
    window.localStorage.setItem(
      'oid4vc-issued-credential-view-state',
      JSON.stringify({ francis: { revokedCredentials: { 'own-cred-1': { id: 'own-cred-1' } } } })
    );

    renderDashboard(false);

    await waitFor(() => {
      expect(window.localStorage.getItem('oid4vc-issued-credential-view-state')).toBeNull();
    });
  });
});
