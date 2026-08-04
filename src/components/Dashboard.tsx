import { useCallback, useEffect, useState } from 'react';
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
  const { userProfile, logout } = useAuth();
  const credentialViewOwner = getCredentialViewOwner(userProfile);
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

  const prepareQr = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [offerLink, offerLinkVal] = await Promise.all([
        oid4vcService.getCredentialOfferDeeplink(true),
        oid4vcService.getCredentialOfferDeeplink(false),
      ]);

      setOfferDeeplink(offerLink);
      setOfferDeeplinkVal(offerLinkVal);
    } catch (error) {
      console.error('Failed to retrieve credential offer', error);
      setError('Failed to retrieve credential offer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadIssuedCredentials = useCallback(async () => {
    setCredentialsLoading(true);
    setCredentialsError(null);

    try {
      const issuedCredentials = await oid4vcService.getIssuedCredentials();
      setCredentials(buildDisplayCredentials(issuedCredentials, credentialViewOwner));
    } catch (error) {
      console.error('Failed to retrieve issued credentials', error);
      setCredentialsError('Failed to retrieve issued credentials. Please try again.');
    } finally {
      setCredentialsLoading(false);
    }
  }, [credentialViewOwner]);

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
      await oid4vcService.revokeIssuedCredential(credentialToRevoke.id, reason);
      rememberRevokedCredential(credentialViewOwner, credentialToRevoke);
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
