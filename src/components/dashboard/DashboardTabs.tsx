import type { DashboardTab } from './types';

export function DashboardTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}) {
  return (
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
      <TabButton active={activeTab === 'offer'} first onClick={() => onTabChange('offer')}>
        Credential Offer
      </TabButton>
      <TabButton active={activeTab === 'credentials'} onClick={() => onTabChange('credentials')}>
        Credentials
      </TabButton>
    </div>
  );
}

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
