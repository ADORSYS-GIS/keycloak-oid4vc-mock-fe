import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService, { type IssuedVerifiableCredential } from '../services/oid4vc.service';
import QRCode from 'react-qr-code';
import {
  AlertCircle,
  Ban,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  QrCode as QrCodeIcon,
  RefreshCw,
  Trash2,
} from 'lucide-react';

type DashboardTab = 'offer' | 'credentials';
type CredentialStatus = 'active' | 'revoked';
type DisplayIssuedCredential = IssuedVerifiableCredential & {
  status: CredentialStatus;
};
type StoredCredentialViewState = {
  revokedCredentials: Record<string, IssuedVerifiableCredential>;
  removedCredentialIds: string[];
};

const CREDENTIAL_VIEW_STATE_KEY = 'oid4vc-issued-credential-view-state';

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

  const removeIssuedCredential = (credential: DisplayIssuedCredential) => {
    if (!credential.id) return;

    rememberRemovedCredential(credentialViewOwner, credential.id);
    setCredentials((currentCredentials) =>
      currentCredentials.filter((issuedCredential) => issuedCredential.id !== credential.id)
    );
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
      <header
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#e7f1ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}
          >
            <QrCodeIcon size={20} aria-hidden="true" />
          </div>
          <h1
            style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)' }}
          >
            Credential Portal
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <p
              style={{
                margin: 0,
                fontWeight: 500,
                color: 'var(--color-text)',
                fontSize: '0.95rem',
              }}
            >
              {userProfile?.firstName} {userProfile?.lastName}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              {userProfile?.email}
            </p>
          </div>
          <button
            onClick={logout}
            style={{
              backgroundColor: 'var(--color-danger)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: 500,
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--color-danger-dark)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger)')}
          >
            Logout
          </button>
        </div>
      </header>

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
          <div
            style={{
              display: 'inline-flex',
              marginBottom: '28px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <TabButton active={activeTab === 'offer'} first onClick={() => setActiveTab('offer')}>
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
              onRevoke={openRevocationDialog}
              onRemove={removeIssuedCredential}
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

function TabButton({
  active,
  first,
  onClick,
  children,
}: {
  active: boolean;
  first?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        borderRight: first ? '1px solid var(--color-border)' : 'none',
        padding: '11px 22px',
        backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
        color: active ? '#fff' : 'var(--color-text)',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: 500,
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {children}
    </button>
  );
}

function buildDisplayCredentials(
  credentials: IssuedVerifiableCredential[],
  owner: string
): DisplayIssuedCredential[] {
  const viewState = readCredentialViewState(owner);
  const removedCredentialIds = new Set(viewState.removedCredentialIds);
  const revokedCredentialIds = new Set(Object.keys(viewState.revokedCredentials));
  const serverCredentialIds = new Set(
    credentials.map((credential) => credential.id).filter(Boolean)
  );

  const serverCredentials = credentials
    .filter((credential) => credential.id && !removedCredentialIds.has(credential.id))
    .map((credential) =>
      toDisplayCredential(
        credential,
        revokedCredentialIds.has(credential.id || '') ? 'revoked' : 'active'
      )
    );

  const retainedRevokedCredentials = Object.values(viewState.revokedCredentials)
    .filter(
      (credential) =>
        credential.id &&
        !removedCredentialIds.has(credential.id) &&
        !serverCredentialIds.has(credential.id)
    )
    .map((credential) => toDisplayCredential(credential, 'revoked'));

  return [...serverCredentials, ...retainedRevokedCredentials];
}

function toDisplayCredential(
  credential: IssuedVerifiableCredential,
  status: CredentialStatus
): DisplayIssuedCredential {
  return {
    ...credential,
    status,
  };
}

function getCredentialViewOwner(
  userProfile: { id?: string; username?: string; email?: string } | null
): string {
  return userProfile?.id || userProfile?.username || userProfile?.email || 'anonymous';
}

function readCredentialViewState(owner: string): StoredCredentialViewState {
  const emptyState: StoredCredentialViewState = {
    revokedCredentials: {},
    removedCredentialIds: [],
  };

  if (typeof window === 'undefined') return emptyState;

  try {
    const rawState = window.localStorage.getItem(CREDENTIAL_VIEW_STATE_KEY);
    if (!rawState) return emptyState;

    const stateByOwner = JSON.parse(rawState) as Record<string, StoredCredentialViewState>;
    return {
      revokedCredentials: stateByOwner[owner]?.revokedCredentials || {},
      removedCredentialIds: stateByOwner[owner]?.removedCredentialIds || [],
    };
  } catch (error) {
    console.warn('Failed to read credential view state', error);
    return emptyState;
  }
}

function writeCredentialViewState(owner: string, state: StoredCredentialViewState) {
  if (typeof window === 'undefined') return;

  try {
    const rawState = window.localStorage.getItem(CREDENTIAL_VIEW_STATE_KEY);
    const stateByOwner = rawState
      ? (JSON.parse(rawState) as Record<string, StoredCredentialViewState>)
      : {};

    stateByOwner[owner] = state;
    window.localStorage.setItem(CREDENTIAL_VIEW_STATE_KEY, JSON.stringify(stateByOwner));
  } catch (error) {
    console.warn('Failed to write credential view state', error);
  }
}

function rememberRevokedCredential(owner: string, credential: IssuedVerifiableCredential) {
  if (!credential.id) return;

  const viewState = readCredentialViewState(owner);
  writeCredentialViewState(owner, {
    revokedCredentials: {
      ...viewState.revokedCredentials,
      [credential.id]: credential,
    },
    removedCredentialIds: viewState.removedCredentialIds.filter(
      (credentialId) => credentialId !== credential.id
    ),
  });
}

function rememberRemovedCredential(owner: string, credentialId: string) {
  const viewState = readCredentialViewState(owner);
  const removedCredentialIds = new Set(viewState.removedCredentialIds);
  removedCredentialIds.add(credentialId);

  const revokedCredentials = { ...viewState.revokedCredentials };
  delete revokedCredentials[credentialId];

  writeCredentialViewState(owner, {
    revokedCredentials,
    removedCredentialIds: Array.from(removedCredentialIds),
  });
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
    <div>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: '28px',
          }}
        >
          <h2
            style={{
              margin: '0 0 10px',
              fontSize: '1.4rem',
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            Credential Offer
          </h2>
          <p style={{ margin: 0, color: 'var(--color-muted)', lineHeight: 1.6 }}>
            Scan the QR code with your EUDI Wallet App or use the offer link to open it directly.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            minHeight: '420px',
          }}
        >
          {isLoading && <LoadingState label="Renewing credential offer..." />}

          {!isLoading && error && (
            <ErrorState message={error} actionLabel="Try Again" onAction={onRetry} />
          )}

          {!isLoading && !error && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
                width: '100%',
                alignItems: 'start',
              }}
            >
              {offerDeeplinkVal && (
                <OfferCard
                  title="By value"
                  description="Full offer embedded in the link."
                  link={offerDeeplinkVal}
                />
              )}
              {offerDeeplink && (
                <OfferCard
                  title="By reference"
                  description="Offer retrieved from the issuer endpoint."
                  link={offerDeeplink}
                />
              )}
            </div>
          )}
        </div>

        {!isLoading && !error && (
          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <PrimaryButton onClick={onRetry} icon={<RefreshCw size={18} />}>
              Renew credential offer
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

function OfferCard({
  title,
  description,
  link,
}: {
  title: string;
  description: string;
  link: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: 'var(--color-text)' }}>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)' }}>{description}</p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: '16px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-sm)',
          maxWidth: '280px',
          width: '100%',
        }}
      >
        <QRCode
          value={link}
          size={240}
          style={{ height: 'auto', maxWidth: '100%', width: '100%', display: 'block' }}
          viewBox={`0 0 240 240`}
        />
      </div>

      <CopyLinkField link={link} />
    </div>
  );
}

function CopyLinkField({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn('Failed to copy to clipboard', error);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '320px' }}>
      <label
        style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: 'var(--color-muted)',
        }}
      >
        Offer link
      </label>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'stretch',
        }}
      >
        <input
          type="text"
          readOnly
          value={link}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 12px',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        />
        <button
          onClick={handleCopy}
          title="Copy offer link"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-muted)',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease, color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f3f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
          }}
        >
          {copied ? <Check size={18} color="#198754" /> : <Copy size={18} />}
          <span className="sr-only">{copied ? 'Copied' : 'Copy offer link'}</span>
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          title="Open offer link"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-primary)',
            textDecoration: 'none',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e7f1ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
          }}
        >
          <ExternalLink size={18} />
          <span className="sr-only">Open offer link</span>
        </a>
      </div>
    </div>
  );
}

function CredentialsView({
  credentials,
  credentialsLoading,
  credentialsError,
  revokingCredentialId,
  onRefresh,
  onRevoke,
  onRemove,
}: {
  credentials: DisplayIssuedCredential[];
  credentialsLoading: boolean;
  credentialsError: string | null;
  revokingCredentialId: string | null;
  onRefresh: () => void;
  onRevoke: (credential: DisplayIssuedCredential) => void;
  onRemove: (credential: DisplayIssuedCredential) => void;
}) {
  return (
    <div>
      {credentialsLoading && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '48px 24px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <LoadingState label="Loading issued credentials..." />
        </div>
      )}

      {!credentialsLoading && credentialsError && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <ErrorState message={credentialsError} actionLabel="Refresh" onAction={onRefresh} />
        </div>
      )}

      {!credentialsLoading && !credentialsError && credentials.length === 0 && (
        <EmptyCredentialsState />
      )}

      {!credentialsLoading && !credentialsError && credentials.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {credentials.map((credential) => (
              <CredentialCard
                key={credential.id}
                credential={credential}
                revoking={revokingCredentialId === credential.id}
                onRevoke={onRevoke}
                onRemove={onRemove}
              />
            ))}
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <PrimaryButton onClick={onRefresh} icon={<RefreshCw size={18} />}>
              Refresh credentials
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyCredentialsState() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px 32px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          borderRadius: '50%',
          backgroundColor: '#e7f1ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary)',
        }}
      >
        <QrCodeIcon size={28} aria-hidden="true" />
      </div>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '1.15rem',
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      >
        No issued credentials found
      </h3>
      <p style={{ margin: 0, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        Once a credential is issued to your account, it will appear here.
      </p>
    </div>
  );
}

function CredentialCard({
  credential,
  revoking,
  onRevoke,
  onRemove,
}: {
  credential: DisplayIssuedCredential;
  revoking: boolean;
  onRevoke: (credential: DisplayIssuedCredential) => void;
  onRemove: (credential: DisplayIssuedCredential) => void;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '22px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--color-text)',
              wordBreak: 'break-word',
            }}
          >
            {credential.credentialType || 'Issued credential'}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--color-muted)',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {credential.id}
          </p>
        </div>
        <StatusBadge status={credential.status} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
        }}
      >
        <DetailItem label="Issued" value={formatTimestamp(credential.issuedAt)} />
        <DetailItem label="Revision" value={credential.revision || '-'} />
        <DetailItem
          label="Wallet client"
          value={credential.clientName || credential.clientId || '-'}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => onRevoke(credential)}
          disabled={revoking || credential.status === 'revoked'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--color-danger)',
            color: '#fff',
            border: 'none',
            padding: '9px 16px',
            borderRadius: 'var(--radius-sm)',
            cursor: revoking || credential.status === 'revoked' ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            opacity: revoking || credential.status === 'revoked' ? 0.7 : 1,
            transition: 'background-color 0.2s ease',
          }}
        >
          <Ban size={16} aria-hidden="true" />
          {revoking ? 'Revoking...' : 'Revoke'}
        </button>
        <button
          onClick={() => onRemove(credential)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--color-surface)',
            color: '#495057',
            border: '1px solid #ced4da',
            padding: '9px 16px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f3f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          Remove
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p
        style={{
          margin: '0 0 4px',
          fontSize: '0.8rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          color: 'var(--color-muted)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: '0.95rem',
          color: 'var(--color-text)',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function RevocationDialog({
  credential,
  reason,
  reasonError,
  importantNotesExpanded,
  isRevoking,
  onReasonChange,
  onToggleImportantNotes,
  onCancel,
  onConfirm,
}: {
  credential: DisplayIssuedCredential;
  reason: string;
  reasonError: string | null;
  importantNotesExpanded: boolean;
  isRevoking: boolean;
  onReasonChange: (value: string) => void;
  onToggleImportantNotes: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const credentialName = credential.credentialType || 'Issued Credential';
  const canSubmit = reason.trim().length > 0 && !isRevoking;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revocation-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(33, 37, 41, 0.48)',
      }}
    >
      <div
        style={{
          width: 'min(640px, 100%)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '32px',
          color: 'var(--color-text)',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#f8d7da',
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={22} aria-hidden="true" />
          </div>
          <h2
            id="revocation-dialog-title"
            style={{
              margin: 0,
              color: 'var(--color-danger)',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            Revoke {credentialName}
          </h2>
        </div>

        <p style={{ margin: '0 0 24px', lineHeight: 1.6, color: 'var(--color-muted)' }}>
          You are about to permanently revoke <strong>{credentialName}</strong>. This action cannot
          be undone.
        </p>

        <div style={{ marginBottom: '24px' }}>
          <label
            htmlFor="revocation-reason"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            Reason for revocation <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <textarea
            id="revocation-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            disabled={isRevoking}
            rows={4}
            placeholder="Explain why this credential is being revoked..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              border: `1px solid ${reasonError ? 'var(--color-danger)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              font: 'inherit',
              backgroundColor: isRevoking ? '#e9ecef' : 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          />
          {reasonError && (
            <p style={{ margin: '8px 0 0', color: 'var(--color-danger)', fontSize: '0.9rem' }}>
              {reasonError}
            </p>
          )}
        </div>

        <div
          style={{
            border: '1px solid #f5c2c7',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <button
            type="button"
            onClick={onToggleImportantNotes}
            disabled={isRevoking}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              border: 'none',
              padding: '16px',
              backgroundColor: '#f8d7da',
              color: 'var(--color-danger)',
              cursor: isRevoking ? 'not-allowed' : 'pointer',
              font: 'inherit',
              fontWeight: 700,
              textAlign: 'left',
            }}
          >
            <span>Important Notes</span>
            <span
              aria-hidden="true"
              style={{
                fontSize: '0.9rem',
                lineHeight: 1,
                transition: 'transform 0.2s ease',
                transform: importantNotesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </span>
          </button>

          {importantNotesExpanded && (
            <ul
              style={{
                margin: 0,
                padding: '14px 22px 16px 34px',
                color: 'var(--color-danger)',
                lineHeight: 1.8,
              }}
            >
              <li>Revocation is permanent and cannot be undone.</li>
              <li>The credential will no longer be valid for any purpose.</li>
              <li>You will need to request a new credential from the issuing organization.</li>
              <li>This action will be recorded and may be auditable.</li>
            </ul>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '26px',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isRevoking}
            style={{
              backgroundColor: 'var(--color-surface)',
              color: '#495057',
              border: '1px solid #ced4da',
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              cursor: isRevoking ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              fontWeight: 500,
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f3f5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface)')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-danger)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontSize: '0.95rem',
              fontWeight: 700,
              opacity: canSubmit ? 1 : 0.7,
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) =>
              canSubmit && (e.currentTarget.style.backgroundColor = 'var(--color-danger-dark)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger)')}
          >
            {isRevoking && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {isRevoking ? 'Revoking...' : 'Revoke'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CredentialStatus }) {
  const isRevoked = status === 'revoked';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '999px',
        backgroundColor: isRevoked ? '#f8d7da' : '#d1e7dd',
        color: isRevoked ? '#842029' : '#0f5132',
        fontSize: '0.82rem',
        fontWeight: 700,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isRevoked ? '#842029' : '#0f5132',
        }}
      />
      {status}
    </span>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <Loader2
        size={48}
        color="var(--color-primary)"
        style={{ animation: 'spin 1s linear infinite' }}
        aria-hidden="true"
      />
      <p style={{ margin: 0, color: 'var(--color-muted)' }}>{label}</p>
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
        borderRadius: 'var(--radius-sm)',
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
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: 500,
          transition: 'background-color 0.2s ease',
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  icon,
}: {
  children: string;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        padding: '12px 24px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 500,
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
    >
      {icon}
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

export default Dashboard;
