import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService, { type IssuedVerifiableCredential } from '../services/oid4vc.service';
import QRCode from 'react-qr-code';

type DashboardTab = 'offer' | 'credentials';

const Dashboard = () => {
  const { userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('offer');
  const [offerDeeplink, setOfferDeeplink] = useState<string | null>(null);
  const [offerDeeplinkVal, setOfferDeeplinkVal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<IssuedVerifiableCredential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [revokingCredentialId, setRevokingCredentialId] = useState<string | null>(null);

  useEffect(() => {
    prepareQr();
  }, []);

  useEffect(() => {
    if (activeTab === 'credentials') {
      loadIssuedCredentials();
    }
  }, [activeTab]);

  const prepareQr = async () => {
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
  };

  const loadIssuedCredentials = async () => {
    setCredentialsLoading(true);
    setCredentialsError(null);

    try {
      const issuedCredentials = await oid4vcService.getIssuedCredentials();
      setCredentials(issuedCredentials);
    } catch (error) {
      console.error('Failed to retrieve issued credentials', error);
      setCredentialsError('Failed to retrieve issued credentials. Please try again.');
    } finally {
      setCredentialsLoading(false);
    }
  };

  const revokeIssuedCredential = async (credential: IssuedVerifiableCredential) => {
    if (!credential.id) {
      setCredentialsError(
        'This credential cannot be revoked because it has no issued credential id.'
      );
      return;
    }

    const credentialName = credential.credentialType || credential.id;
    const confirmed = window.confirm(`Revoke issued credential "${credentialName}"?`);
    if (!confirmed) return;

    setRevokingCredentialId(credential.id);
    setCredentialsError(null);

    try {
      await oid4vcService.revokeIssuedCredential(credential.id);
      setCredentials((currentCredentials) =>
        currentCredentials.filter((issuedCredential) => issuedCredential.id !== credential.id)
      );
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 160px)',
        padding: '80px 40px',
        backgroundColor: '#f8f9fa',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: 500, color: '#087ca8' }}>
            {userProfile?.firstName} {userProfile?.lastName}
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>{userProfile?.email}</p>
        </div>
        <button
          onClick={logout}
          style={{
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          maxWidth: activeTab === 'credentials' ? '960px' : '600px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '2.5rem',
            marginBottom: '20px',
            fontWeight: 400,
            color: '#212529',
          }}
        >
          You are logged in
        </h1>

        <div
          style={{
            display: 'inline-flex',
            marginBottom: '28px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#fff',
          }}
        >
          <TabButton active={activeTab === 'offer'} onClick={() => setActiveTab('offer')}>
            Credential Offer
          </TabButton>
          <TabButton
            active={activeTab === 'credentials'}
            onClick={() => setActiveTab('credentials')}
          >
            Credentials
          </TabButton>
        </div>

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
            onRevoke={revokeIssuedCredential}
          />
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        borderRight: children === 'Credential Offer' ? '1px solid #dee2e6' : 'none',
        padding: '11px 18px',
        backgroundColor: active ? '#0865f0' : '#fff',
        color: active ? '#fff' : '#212529',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function CredentialOfferView({
  isLoading,
  error,
  offerDeeplink,
  offerDeeplinkVal,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  offerDeeplink: string | null;
  offerDeeplinkVal: string | null;
  onRetry: () => void;
}) {
  return (
    <>
      <div
        style={{
          fontSize: '1.125rem',
          marginBottom: '20px',
          lineHeight: '1.6',
          color: '#6c757d',
        }}
      >
        <p style={{ margin: 0 }}>Please scan the displayed QR code with your EUDI Wallet App.</p>
        <p style={{ margin: 0, fontSize: '1rem' }}>
          Alternatively, click on the offer link to open it directly in your wallet.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '480px',
          gap: '30px',
        }}
      >
        {isLoading && <LoadingState label="Renewing credential offer..." />}

        {!isLoading && error && (
          <ErrorState message={error} actionLabel="Try Again" onAction={onRetry} />
        )}

        {!isLoading &&
          !error &&
          offerDeeplinkVal &&
          showCredentialOffer(offerDeeplinkVal, 'By value')}

        {!isLoading &&
          !error &&
          offerDeeplink &&
          showCredentialOffer(offerDeeplink, 'By reference')}

        {!isLoading && !error && (
          <div style={{ marginTop: '20px' }}>
            <PrimaryButton onClick={onRetry}>Renew credential offer</PrimaryButton>
          </div>
        )}
      </div>
    </>
  );
}

function CredentialsView({
  credentials,
  credentialsLoading,
  credentialsError,
  revokingCredentialId,
  onRefresh,
  onRevoke,
}: {
  credentials: IssuedVerifiableCredential[];
  credentialsLoading: boolean;
  credentialsError: string | null;
  revokingCredentialId: string | null;
  onRefresh: () => void;
  onRevoke: (credential: IssuedVerifiableCredential) => void;
}) {
  return (
    <div style={{ minHeight: '480px' }}>
      {credentialsLoading && <LoadingState label="Loading issued credentials..." />}

      {!credentialsLoading && credentialsError && (
        <ErrorState message={credentialsError} actionLabel="Refresh" onAction={onRefresh} />
      )}

      {!credentialsLoading && !credentialsError && credentials.length === 0 && (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '28px',
            color: '#6c757d',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500, color: '#212529' }}>
            No issued credentials found.
          </p>
        </div>
      )}

      {!credentialsLoading && !credentialsError && credentials.length > 0 && (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            overflowX: 'auto',
            textAlign: 'left',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f3f5' }}>
                <HeaderCell>Credential</HeaderCell>
                <HeaderCell>Issued</HeaderCell>
                <HeaderCell>Revision</HeaderCell>
                <HeaderCell>Wallet client</HeaderCell>
                <HeaderCell>Action</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {credentials.map((credential) => (
                <tr key={credential.id} style={{ borderTop: '1px solid #dee2e6' }}>
                  <BodyCell>
                    <div style={{ fontWeight: 600, color: '#212529' }}>
                      {credential.credentialType || 'Issued credential'}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#6c757d' }}>
                      {credential.id}
                    </div>
                  </BodyCell>
                  <BodyCell>{formatTimestamp(credential.issuedAt)}</BodyCell>
                  <BodyCell>{credential.revision || '-'}</BodyCell>
                  <BodyCell>{credential.clientName || credential.clientId || '-'}</BodyCell>
                  <BodyCell>
                    <button
                      onClick={() => onRevoke(credential)}
                      disabled={revokingCredentialId === credential.id}
                      style={{
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        padding: '9px 16px',
                        borderRadius: '4px',
                        cursor: revokingCredentialId === credential.id ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        opacity: revokingCredentialId === credential.id ? 0.72 : 1,
                      }}
                    >
                      {revokingCredentialId === credential.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '22px' }}>
        <PrimaryButton onClick={onRefresh}>Refresh credentials</PrimaryButton>
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children: string }) {
  return (
    <th
      style={{
        padding: '14px 16px',
        color: '#495057',
        fontSize: '0.9rem',
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  );
}

function BodyCell({ children }: { children: ReactNode }) {
  return (
    <td style={{ padding: '14px 16px', color: '#495057', verticalAlign: 'middle' }}>{children}</td>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      <div
        style={{
          width: '60px',
          height: '60px',
          border: '4px solid #e9ecef',
          borderTop: '4px solid #0865f0',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{ margin: 0, color: '#6c757d' }}>{label}</p>
    </div>
  );
}

function ErrorState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: '#f8d7da',
        color: '#721c24',
        padding: '20px',
        borderRadius: '4px',
        border: '1px solid #f5c6cb',
      }}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>{message}</p>
      <button
        onClick={onAction}
        style={{
          marginTop: '15px',
          backgroundColor: '#721c24',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.95rem',
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: '#0865f0',
        color: '#fff',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function formatTimestamp(value?: number): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function showCredentialOffer(offerLink: string, title: string) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      <div>
        <p
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '15px',
            color: '#212529',
            fontStyle: 'italic',
          }}
        >
          {title}
        </p>
        <div style={{ maxWidth: '800px', wordBreak: 'break-all' }}>
          <a href={offerLink} target="_blank" rel="noopener noreferrer">
            {offerLink}
          </a>
        </div>
      </div>
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <QRCode
          value={offerLink}
          size={300}
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          viewBox={`0 0 300 300`}
        />
      </div>
    </div>
  );
}

export default Dashboard;
