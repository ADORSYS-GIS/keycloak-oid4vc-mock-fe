import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService from '../services/oid4vc.service';
import { CredentialOfferView } from './dashboard/CredentialOfferView';
import { CredentialsView } from './dashboard/CredentialsView';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardTabs } from './dashboard/DashboardTabs';
import { RevocationDialog } from './dashboard/RevocationDialog';
import {
  buildDisplayCredentials,
  purgeLegacyCredentialViewState,
} from './dashboard/credentialViewState';
import { isRevocable, type DashboardTab, type DisplayIssuedCredential } from './dashboard/types';

const Dashboard = () => {
  const { userProfile, logout } = useAuth();
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
  const credentialsRequestId = useRef(0);

  // Previous builds persisted revoked credentials in localStorage; purge once on mount.
  useEffect(() => {
    purgeLegacyCredentialViewState();
  }, []);

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
    // Each load gets an id. Only the latest id may update the list, the error, or the loading flag.
    const requestId = ++credentialsRequestId.current;
    setCredentialsLoading(true);
    setCredentialsError(null);

    try {
      // The account call supplies the rows. The status call supplies each badge. They are merged by credential id.
      // Both run together. allSettled is used because a failed account call hides the list,
      // while a failed status call still shows the rows as Unknown.
      const [credentialsResult, statusesResult] = await Promise.allSettled([
        oid4vcService.getIssuedCredentials(),
        oid4vcService.getIssuedCredentialStatus(),
      ]);

      if (requestId !== credentialsRequestId.current) return;

      if (credentialsResult.status === 'rejected') {
        // Re-throw into the outer catch: without metadata there is nothing to render.
        throw credentialsResult.reason;
      }

      // Fail closed: do not render account metadata as Valid when status is unavailable.
      const statusLookupFailed = statusesResult.status === 'rejected';
      if (statusLookupFailed) {
        console.warn('Failed to retrieve issued credential status', statusesResult.reason);
      }
      const serverStatuses = statusLookupFailed ? [] : statusesResult.value;
      const issuedCredentials = credentialsResult.value;

      setCredentials(
        buildDisplayCredentials(issuedCredentials, serverStatuses, { statusLookupFailed })
      );
    } catch (error) {
      if (requestId !== credentialsRequestId.current) return;
      console.error('Failed to retrieve issued credentials', error);
      setCredentialsError('Failed to retrieve issued credentials. Please try again.');
    } finally {
      if (requestId === credentialsRequestId.current) {
        setCredentialsLoading(false);
      }
    }
  }, []);

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
    if (!isRevocable(credential.status)) {
      return;
    }

    setCredentialToRevoke(credential);
    setRevocationReason('');
    setRevocationReasonError(null);
    setImportantNotesExpanded(true);
  };

  const resetRevocationDialog = () => {
    setCredentialToRevoke(null);
    setRevocationReason('');
    setRevocationReasonError(null);
  };

  const closeRevocationDialog = () => {
    // Cancel must not clear dialog state while a revoke request is in flight.
    if (revokingCredentialId) return;
    resetRevocationDialog();
  };

  const confirmRevocation = async () => {
    if (!credentialToRevoke?.id) return;
    if (!isRevocable(credentialToRevoke.status)) return;

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
      // Optimistic UI: keep the row visible as Revoked without waiting for a refresh.
      setCredentials((currentCredentials) =>
        currentCredentials.map((issuedCredential) =>
          issuedCredential.id === credentialToRevoke.id
            ? { ...issuedCredential, status: 'revoked' }
            : issuedCredential
        )
      );
      resetRevocationDialog();
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
