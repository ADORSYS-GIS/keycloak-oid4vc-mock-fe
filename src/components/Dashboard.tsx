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
  // Out-of-order protection for the credentials list. Every load is numbered, and only
  // the newest number may update what is on screen. Each load's requests also share an
  // AbortController, so an older load is cancelled the moment a newer one starts — for
  // example, a load that started before a revocation must not finish afterwards and
  // mark the just-revoked credential Valid again.
  const credentialsRequestId = useRef(0);
  const credentialsAbortRef = useRef<AbortController | null>(null);

  // Older versions of this app saved revoked credentials in localStorage; delete that
  // leftover data once when the dashboard loads.
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

  // Cancels any credential load that is still running, then hands out the number and
  // cancellation signal the next load will use. The signal is passed to the fetch calls
  // so they can be cancelled while still running.
  const beginCredentialsLoad = useCallback((): { requestId: number; signal: AbortSignal } => {
    credentialsAbortRef.current?.abort();
    const abortController = new AbortController();
    credentialsAbortRef.current = abortController;
    return { requestId: ++credentialsRequestId.current, signal: abortController.signal };
  }, []);

  const loadIssuedCredentials = useCallback(async () => {
    // Cancel any load still running, then number this one. From here on, only this
    // newest load is allowed to update the list, the error message, or the spinner.
    const { requestId, signal } = beginCredentialsLoad();
    setCredentialsLoading(true);
    setCredentialsError(null);

    try {
      // Two requests run together: the account endpoint returns the credentials (the
      // rows) and the status endpoint returns each credential's status (the badge).
      // If the account request fails there is nothing to show, so the tab shows an
      // error. If only the status request fails, the rows still show, but every badge
      // reads Unknown and Revoke is disabled — guessing a status could display a
      // revoked credential as Valid.
      const [credentialsResult, statusesResult] = await Promise.allSettled([
        oid4vcService.getIssuedCredentials(signal),
        oid4vcService.getIssuedCredentialStatus(signal),
      ]);

      // A newer load has started while this one was waiting. Its results are the
      // current ones, so drop everything this older load received.
      if (requestId !== credentialsRequestId.current) return;

      if (credentialsResult.status === 'rejected') {
        // No credentials means nothing to show, so treat this like a failed load.
        throw credentialsResult.reason;
      }

      // The status request failed, so the real status is unknown. Show Unknown instead
      // of Valid to be safe; Unknown keeps the Revoke button disabled.
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
  }, [beginCredentialsLoad]);

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
      // Show the credential as Revoked right away, without waiting for the reload below.
      setCredentials((currentCredentials) =>
        currentCredentials.map((issuedCredential) =>
          issuedCredential.id === credentialToRevoke.id
            ? { ...issuedCredential, status: 'revoked' }
            : issuedCredential
        )
      );
      resetRevocationDialog();
      // Then reload the list from the server. The reload replaces the temporary Revoked
      // badge with what the server now says, and cancels any older load still running so
      // it cannot mark the credential Valid again. If the reload itself fails, the usual
      // list error banner appears.
      void loadIssuedCredentials();
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
