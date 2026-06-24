import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService from '../services/oid4vc.service';
import QRCode from 'react-qr-code';

type OfferQr = {
  id: 'reference' | 'value';
  title: string;
  description: string;
  deeplink: string;
};

const spinnerStyles = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';

const Dashboard = () => {
  const { userProfile, logout } = useAuth();
  const [credentialOffers, setCredentialOffers] = useState<OfferQr[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prepareQr();
  }, []);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return String(error);
  };

  const prepareQr = async () => {
    setIsLoading(true);
    setError(null);
    setCredentialOffers([]);

    try {
      const [byReference, byValue] = await Promise.allSettled([
        oid4vcService.getCredentialOfferDeeplink(true),
        oid4vcService.getCredentialOfferDeeplink(false),
      ]);

      const nextOffers: OfferQr[] = [];
      const failures: string[] = [];

      if (byReference.status === 'fulfilled') {
        nextOffers.push({
          id: 'reference',
          title: 'By reference',
          description: 'Contains a credential_offer_uri that the wallet resolves from Keycloak.',
          deeplink: byReference.value,
        });
      } else {
        failures.push('By reference: ' + getErrorMessage(byReference.reason));
      }

      if (byValue.status === 'fulfilled') {
        nextOffers.push({
          id: 'value',
          title: 'By value',
          description: 'Contains the full credential offer directly inside the wallet link.',
          deeplink: byValue.value,
        });
      } else {
        failures.push('By value: ' + getErrorMessage(byValue.reason));
      }

      setCredentialOffers(nextOffers);

      if (nextOffers.length === 0) {
        throw new Error(failures.join(' | ') || 'No credential offers were returned.');
      }

      if (failures.length > 0) {
        console.warn('Some credential offers failed:', failures);
        setError(failures.join(' | '));
      }
    } catch (error) {
      console.error('Failed to retrieve credential offer', error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const hasOffers = credentialOffers.length > 0;

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
          maxWidth: '960px',
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
            fontSize: '1.125rem',
            marginBottom: '20px',
            lineHeight: '1.6',
            color: '#6c757d',
          }}
        >
          <p style={{ margin: 0 }}>Please scan a credential offer QR code with your EUDI Wallet App.</p>
          <p style={{ margin: 0, fontSize: '1rem' }}>
            Use by reference for shorter links, or by value when the wallet expects the full offer payload.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '480px',
            gap: '24px',
          }}
        >
          {isLoading && (
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
              <p style={{ margin: 0, color: '#6c757d' }}>Renewing credential offers...</p>
            </div>
          )}

          {!isLoading && error && !hasOffers && (
            <div
              style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #f5c6cb',
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>Failed to retrieve credential offers.</p>
              <p style={{ margin: '10px 0 0', fontSize: '0.9rem', wordBreak: 'break-word' }}>{error}</p>
              <button
                onClick={prepareQr}
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
                Try Again
              </button>
            </div>
          )}

          {!isLoading && error && hasOffers && (
            <div
              style={{
                backgroundColor: '#fff3cd',
                color: '#664d03',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #ffecb5',
                textAlign: 'left',
                wordBreak: 'break-word',
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>One credential offer could not be generated.</p>
              <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>{error}</p>
            </div>
          )}

          {!isLoading && hasOffers && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
                alignItems: 'stretch',
              }}
            >
              {credentialOffers.map((offer) => showCredentialOffer(offer))}
            </div>
          )}

          {!isLoading && hasOffers && (
            <div style={{ marginTop: '4px' }}>
              <button
                onClick={prepareQr}
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
                Renew credential offers
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{spinnerStyles}</style>
    </div>
  );
};

function showCredentialOffer(offer: OfferQr) {
  return (
    <div
      key={offer.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '20px',
        minWidth: 0,
      }}
    >
      <div style={{ minHeight: '88px' }}>
        <p
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            margin: '0 0 8px',
            color: '#212529',
          }}
        >
          {offer.title}
        </p>
        <p
          style={{
            margin: 0,
            color: '#6c757d',
            fontSize: '0.95rem',
            lineHeight: 1.45,
          }}
        >
          {offer.description}
        </p>
      </div>

      <div
        style={{
          backgroundColor: '#fff',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e9ecef',
          width: 'min(100%, 300px)',
          aspectRatio: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <QRCode
          value={offer.deeplink}
          size={260}
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          viewBox="0 0 260 260"
        />
      </div>

      <div style={{ width: '100%', wordBreak: 'break-all', fontSize: '0.85rem', lineHeight: 1.45 }}>
        <a href={offer.deeplink} target="_blank" rel="noopener noreferrer">
          {offer.deeplink}
        </a>
      </div>
    </div>
  );
}

export default Dashboard;
