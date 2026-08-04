import type { ReactNode } from 'react';
import { Ban, QrCode as QrCodeIcon, RefreshCw, Trash2 } from 'lucide-react';
import { ErrorState, LoadingState, PrimaryButton } from './States';
import type { CredentialStatus, DisplayIssuedCredential } from './types';
import { formatTimestamp } from './format';

export function CredentialsView({
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
