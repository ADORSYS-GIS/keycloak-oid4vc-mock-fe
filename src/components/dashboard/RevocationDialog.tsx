import { AlertCircle, Loader2 } from 'lucide-react';
import type { DisplayIssuedCredential } from './types';

export function RevocationDialog({
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
