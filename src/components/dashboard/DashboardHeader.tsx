import { QrCode as QrCodeIcon } from 'lucide-react';
import type { UserProfile } from '../../types';

export function DashboardHeader({
  userProfile,
  onLogout,
}: {
  userProfile: UserProfile | null;
  onLogout: () => void;
}) {
  return (
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
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)' }}>
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
          onClick={onLogout}
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger-dark)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger)')}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
