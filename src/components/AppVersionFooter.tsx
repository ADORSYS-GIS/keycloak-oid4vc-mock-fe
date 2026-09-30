export function AppVersionFooter() {
  return (
    <footer
      aria-label="Application version"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 12,
        display: 'flex',
        justifyContent: 'center',
        color: 'var(--color-muted)',
        fontSize: 12,
        lineHeight: 1,
        pointerEvents: 'none',
      }}
    >
      Version <strong>{__APP_VERSION__}</strong>
    </footer>
  );
}
