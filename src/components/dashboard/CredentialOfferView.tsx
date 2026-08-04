import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { ErrorState, LoadingState, PrimaryButton } from './States';

export function CredentialOfferView({
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
