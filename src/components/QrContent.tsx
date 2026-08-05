import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService from '../services/oid4vc.service';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface QrContentProps {
  onBack: () => void;
}

const QrContent = ({ onBack }: QrContentProps) => {
  const { logout } = useAuth();
  const [qrImageSrc, setQrImageSrc] = useState<string | null>(null);
  const [offerDeeplink, setOfferDeeplink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prepareQr();
  }, []);

  const prepareQr = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dataUrl = await oid4vcService.getCredentialOfferQrDataUrl();
      setQrImageSrc(dataUrl);
      setOfferDeeplink(null);
    } catch (qrError) {
      console.error('Failed to get QR code image, trying deeplink fallback:', qrError);

      try {
        const deeplink = await oid4vcService.getCredentialOfferDeeplink();
        setOfferDeeplink(deeplink);
        setQrImageSrc(null);
      } catch (deeplinkError) {
        console.error('Failed to get deeplink:', deeplinkError);
        setError('Failed to generate credential offer. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '36px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          You are logged in
        </h1>

        <p
          style={{
            margin: '0 0 28px',
            lineHeight: 1.6,
            color: 'var(--color-muted)',
          }}
        >
          Please scan the displayed QR code with your EUDI Wallet App.
        </p>

        {isLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '40px 0',
            }}
          >
            <Loader2
              size={48}
              color="var(--color-primary)"
              style={{ animation: 'spin 1s linear infinite' }}
              aria-hidden="true"
            />
            <p style={{ margin: 0, color: 'var(--color-muted)' }}>Generating QR code...</p>
          </div>
        )}

        {!isLoading && error && (
          <div
            style={{
              backgroundColor: '#f8d7da',
              color: '#721c24',
              padding: '20px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
            <button
              onClick={prepareQr}
              style={{
                marginTop: '12px',
                backgroundColor: '#721c24',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && qrImageSrc && (
          <div
            style={{
              marginBottom: '28px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <img
              src={qrImageSrc}
              alt="Credential Offer QR Code"
              style={{
                width: '320px',
                height: '320px',
                maxWidth: '100%',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>
        )}

        {!isLoading && !error && !qrImageSrc && offerDeeplink && (
          <div
            style={{
              marginBottom: '28px',
              textAlign: 'left',
            }}
          >
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--color-muted)',
              }}
            >
              Deeplink (Fallback)
            </label>
            <textarea
              readOnly
              value={offerDeeplink}
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                resize: 'vertical',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fff',
              color: '#495057',
              border: '1px solid #ced4da',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Back
          </button>
          <button
            onClick={logout}
            style={{
              backgroundColor: 'var(--color-danger)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '1rem',
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
      </div>
    </div>
  );
};

export default QrContent;
