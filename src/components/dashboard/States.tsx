import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingState({ label }: { label: string }) {
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

export function ErrorState({
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

export function PrimaryButton({
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
