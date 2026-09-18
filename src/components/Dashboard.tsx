import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService, { type IssuedCredentialStatusEntry } from '../services/oid4vc.service';
import { CredentialOfferView } from './dashboard/CredentialOfferView';
import { CredentialsView } from './dashboard/CredentialsView';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardTabs } from './dashboard/DashboardTabs';
import { RevocationDialog } from './dashboard/RevocationDialog';
import {
  buildDisplayCredentials,
  getCredentialViewOwner,
  rememberRevokedCredential,
} from './dashboard/credentialViewState';
import type { DashboardTab, DisplayIssuedCredential } from './dashboard/types';
import type { UserProfile } from '../types';

// Dropdown labels read "First Last (username)"; users without a stored name fall
// back to their bare username.
const formatUserLabel = (user: UserProfile): string => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name ? `${name} (${user.username})` : `${user.username}`;
};

const Dashboard = () => {
  const { userProfile, logout, hasRole } = useAuth();
  const credentialViewOwner = getCredentialViewOwner(userProfile);
  const isAdmin = hasRole('credential-offer-create');
  // Applied admin target ('' = current user). Only set by the admin target selector.
  const [adminTargetUser, setAdminTargetUser] = useState('');
  const [realmUsers, setRealmUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('offer');
  const [offerDeeplink, setOfferDeeplink] = useState<string | null>(null);
  const [offerDeeplinkVal, setOfferDeeplinkVal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<DisplayIssuedCredential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [revokingCredentialId, setRevokingCredentialId] = useState<string | null>(null);
  const [credentialToRevoke, setCredentialToRevoke] = useState<DisplayIssuedCredential | null>(
    null
  );
  const [revocationReason, setRevocationReason] = useState('');
  const [revocationReasonError, setRevocationReasonError] = useState<string | null>(null);
  const [importantNotesExpanded, setImportantNotesExpanded] = useState(true);

  const getActiveTargetUser = useCallback((): string | undefined => {
    // applyAdminTarget trims on write, so the stored value needs no re-trim here.
    return adminTargetUser || undefined;
  }, [adminTargetUser]);

  const applyAdminTarget = (target: string) => {
    setAdminTargetUser(target.trim());
  };

  // Only admins need the realm user list; it backs the target-user dropdown.
  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);

    oid4vcService
      .getRealmUsers()
      .then((users) => {
        if (!cancelled) setRealmUsers(users);
      })
      .catch((error) => {
        console.error('Failed to retrieve realm users', error);
        if (!cancelled) {
          setUsersError('Failed to load users. Please check your permissions and refresh.');
        }
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Guards against out-of-order responses when the admin target changes while a
  // request is still in flight: only the latest request may update state.
  const offerRequestIdRef = useRef(0);
  const credentialsRequestIdRef = useRef(0);

  const prepareQr = useCallback(async () => {
    const requestId = ++offerRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const targetUser = getActiveTargetUser();
      const [offerLink, offerLinkVal] = await Promise.all([
        oid4vcService.getCredentialOfferDeeplink(true, undefined, targetUser),
        oid4vcService.getCredentialOfferDeeplink(false, undefined, targetUser),
      ]);

      if (requestId !== offerRequestIdRef.current) return; // stale: a newer request owns the offer state
      setOfferDeeplink(offerLink);
      setOfferDeeplinkVal(offerLinkVal);
    } catch (error) {
      if (requestId !== offerRequestIdRef.current) return;
      console.error('Failed to retrieve credential offer', error);
      setError('Failed to retrieve credential offer. Please try again.');
    } finally {
      if (requestId === offerRequestIdRef.current) setIsLoading(false);
    }
  }, [getActiveTargetUser]);

  // Status hydration must not break the list itself: if the token status plugin is
  // unreachable, the self-service list still renders with its local view state.
  const loadServerStatuses = useCallback(async (): Promise<IssuedCredentialStatusEntry[]> => {
    try {
      return await oid4vcService.getIssuedCredentialStatus();
    } catch (error) {
      console.warn('Failed to retrieve issued credential status', error);
      return [];
    }
  }, []);

  const loadIssuedCredentials = useCallback(async () => {
    const requestId = ++credentialsRequestIdRef.current;
    setCredentialsLoading(true);
    setCredentialsError(null);

    try {
      const targetUser = getActiveTargetUser();
      const viewOwner = targetUser || credentialViewOwner;
      // List and status lookups are independent — run them in parallel to halve the
      // latency; loadServerStatuses never rejects (it falls back to [] itself), and
      // the admin branch resolves its status slot to [] directly.
      const [issuedCredentials, serverStatuses] = await Promise.all([
        targetUser
          ? oid4vcService.getIssuedCredentialsFor(targetUser)
          : oid4vcService.getIssuedCredentials(),
        targetUser ? Promise.resolve<IssuedCredentialStatusEntry[]>([]) : loadServerStatuses(),
      ]);
      // A slow response for a previously selected user must never replace the list of
      // the currently selected one (mixed identities would corrupt revocation calls).
      if (requestId !== credentialsRequestIdRef.current) return;
      setCredentials(buildDisplayCredentials(issuedCredentials, viewOwner, serverStatuses));
    } catch (error) {
      if (requestId !== credentialsRequestIdRef.current) return;
      console.error('Failed to retrieve issued credentials', error);
      setCredentialsError('Failed to retrieve issued credentials. Please try again.');
    } finally {
      if (requestId === credentialsRequestIdRef.current) setCredentialsLoading(false);
    }
  }, [credentialViewOwner, getActiveTargetUser, loadServerStatuses]);

  useEffect(() => {
    prepareQr();
  }, [prepareQr]);

  useEffect(() => {
    if (activeTab === 'credentials') {
      loadIssuedCredentials();
    }
  }, [activeTab, loadIssuedCredentials]);

  const openRevocationDialog = (credential: DisplayIssuedCredential) => {
    if (!credential.id) {
      setCredentialsError(
        'This credential cannot be revoked because it has no issued credential id.'
      );
      return;
    }

    setCredentialToRevoke(credential);
    setRevocationReason('');
    setRevocationReasonError(null);
    setImportantNotesExpanded(true);
  };

  const closeRevocationDialog = () => {
    if (revokingCredentialId) return;

    setCredentialToRevoke(null);
    setRevocationReason('');
    setRevocationReasonError(null);
  };

  const confirmRevocation = async () => {
    if (!credentialToRevoke?.id) return;

    const reason = revocationReason.trim();
    if (!reason) {
      setRevocationReasonError('Reason for revocation is required.');
      return;
    }

    setRevokingCredentialId(credentialToRevoke.id);
    setCredentialsError(null);
    setRevocationReasonError(null);

    try {
      const targetUser = getActiveTargetUser();
      const viewOwner = targetUser || credentialViewOwner;
      await oid4vcService.revokeIssuedCredential(credentialToRevoke.id, reason, targetUser);
      rememberRevokedCredential(viewOwner, credentialToRevoke);
      setCredentials((currentCredentials) =>
        currentCredentials.map((issuedCredential) =>
          issuedCredential.id === credentialToRevoke.id
            ? { ...issuedCredential, status: 'revoked' }
            : issuedCredential
        )
      );
      closeRevocationDialog();
    } catch (error) {
      console.error('Failed to revoke issued credential', error);
      setCredentialsError('Failed to revoke issued credential. Please try again.');
    } finally {
      setRevokingCredentialId(null);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DashboardHeader userProfile={userProfile} onLogout={logout} />

      <main
        style={{
          flex: 1,
          padding: '32px 24px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '880px',
          }}
        >
          {isAdmin && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: '16px',
                padding: '14px 16px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <label
                htmlFor="admin-target-user"
                style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}
              >
                On behalf of user
              </label>
              <select
                id="admin-target-user"
                value={adminTargetUser}
                disabled={usersLoading || realmUsers.length === 0}
                onChange={(event) => applyAdminTarget(event.target.value)}
                style={{
                  flex: '1',
                  minWidth: '220px',
                  padding: '9px 12px',
                  fontSize: '0.9rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  cursor: usersLoading ? 'wait' : 'pointer',
                }}
              >
                <option value="">{userProfile ? formatUserLabel(userProfile) : 'me'}</option>
                {/* The first option is the logged-in user themselves, so they are not
                    rendered again as a second entry in the list. */}
                {realmUsers
                  .filter(
                    (user) => user.username?.toLowerCase() !== userProfile?.username?.toLowerCase()
                  )
                  .map((user) => (
                    <option key={user.id ?? user.username} value={user.username}>
                      {formatUserLabel(user)}
                    </option>
                  ))}
              </select>
              {usersError && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-danger)' }}>
                  {usersError}
                </span>
              )}
              {adminTargetUser && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                  Managing credentials for <strong>{adminTargetUser}</strong>
                </span>
              )}
            </div>
          )}

          <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'offer' ? (
            <CredentialOfferView
              isLoading={isLoading}
              error={error}
              offerDeeplink={offerDeeplink}
              offerDeeplinkVal={offerDeeplinkVal}
              onRetry={prepareQr}
            />
          ) : (
            <CredentialsView
              credentials={credentials}
              credentialsLoading={credentialsLoading}
              credentialsError={credentialsError}
              revokingCredentialId={revokingCredentialId}
              forUser={getActiveTargetUser()}
              onRefresh={loadIssuedCredentials}
              onRevoke={openRevocationDialog}
            />
          )}
        </div>
      </main>

      {credentialToRevoke && (
        <RevocationDialog
          credential={credentialToRevoke}
          reason={revocationReason}
          reasonError={revocationReasonError}
          importantNotesExpanded={importantNotesExpanded}
          isRevoking={revokingCredentialId === credentialToRevoke.id}
          onReasonChange={(value) => {
            setRevocationReason(value);
            if (value.trim()) setRevocationReasonError(null);
          }}
          onToggleImportantNotes={() => setImportantNotesExpanded((expanded) => !expanded)}
          onCancel={closeRevocationDialog}
          onConfirm={confirmRevocation}
        />
      )}
    </div>
  );
};

export default Dashboard;
