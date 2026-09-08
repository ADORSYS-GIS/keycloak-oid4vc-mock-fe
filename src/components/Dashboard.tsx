import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService from '../services/oid4vc.service';
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

const Dashboard = () => {
  const { userProfile, logout, hasRole } = useAuth();
  const credentialViewOwner = getCredentialViewOwner(userProfile);
  const isAdmin = hasRole('credential-offer-create');
  // Applied admin target ('' = current user). Only set by the admin target selector.
  const [adminTargetUser, setAdminTargetUser] = useState('');
  const [adminTargetDraft, setAdminTargetDraft] = useState('');
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
    const target = adminTargetUser.trim();
    return target || undefined;
  }, [adminTargetUser]);

  const applyAdminTarget = (target: string) => {
    const trimmed = target.trim();
    setAdminTargetUser(trimmed);
    setAdminTargetDraft(trimmed);
  };

  const handleAdminTargetSubmit = (event: FormEvent) => {
    event.preventDefault();
    applyAdminTarget(adminTargetDraft);
  };

  const prepareQr = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const targetUser = getActiveTargetUser();
      const [offerLink, offerLinkVal] = await Promise.all([
        oid4vcService.getCredentialOfferDeeplink(true, undefined, targetUser),
        oid4vcService.getCredentialOfferDeeplink(false, undefined, targetUser),
      ]);

      setOfferDeeplink(offerLink);
      setOfferDeeplinkVal(offerLinkVal);
    } catch (error) {
      console.error('Failed to retrieve credential offer', error);
      setError('Failed to retrieve credential offer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [getActiveTargetUser]);

  const loadIssuedCredentials = useCallback(async () => {
    setCredentialsLoading(true);
    setCredentialsError(null);

    try {
      const targetUser = getActiveTargetUser();
      const viewOwner = targetUser || credentialViewOwner;
      const issuedCredentials = targetUser
        ? await oid4vcService.getIssuedCredentialsFor(targetUser)
        : await oid4vcService.getIssuedCredentials();
      setCredentials(buildDisplayCredentials(issuedCredentials, viewOwner));
    } catch (error) {
      console.error('Failed to retrieve issued credentials', error);
      setCredentialsError('Failed to retrieve issued credentials. Please try again.');
    } finally {
      setCredentialsLoading(false);
    }
  }, [credentialViewOwner, getActiveTargetUser]);

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
            maxWidth: activeTab === 'credentials' ? '1000px' : '880px',
          }}
        >
          {isAdmin && (
            <form
              onSubmit={handleAdminTargetSubmit}
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
              <input
                id="admin-target-user"
                type="text"
                value={adminTargetDraft}
                onChange={(event) => setAdminTargetDraft(event.target.value)}
                placeholder="username — leave blank for your own account"
                style={{
                  flex: '1',
                  minWidth: '220px',
                  padding: '9px 12px',
                  fontSize: '0.9rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Apply
              </button>
              {adminTargetUser && (
                <button
                  type="button"
                  onClick={() => applyAdminTarget('')}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--color-muted)',
                    border: 'none',
                    padding: '9px 12px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    textDecoration: 'underline',
                  }}
                >
                  Back to my account
                </button>
              )}
              {adminTargetUser && (
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-muted)',
                  }}
                >
                  Managing credentials for <strong>{adminTargetUser}</strong>
                </span>
              )}
            </form>
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
