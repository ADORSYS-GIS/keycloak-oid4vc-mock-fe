import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import oid4vcService from '../services/oid4vc.service';
import QRCode from 'react-qr-code';

const Dashboard = () => {
  const { userProfile, logout } = useAuth();
  const [offerDeeplink, setOfferDeeplink] = useState<string | null>(null);
  const [offerDeeplinkVal, setOfferDeeplinkVal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prepareQr();
  }, []);

  const prepareQr = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Retrieve credential offer links
      const [offerLink, offerLinkVal] = await Promise.all([
        oid4vcService.getCredentialOfferDeeplink(),
        oid4vcService.getCredentialOfferDeeplink(false),
      ]);

      // Update state with retrieved data
      setOfferDeeplink(offerLink);
      setOfferDeeplinkVal(offerLinkVal);
    } catch (error) {
      console.error('Failed to retrieve credential offer', error);
      setError('Failed to retrieve credential offer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
      {/* Header with user info and logout */}
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

      {/* Main content */}
      <div
        style={{
          maxWidth: '600px',
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
          <p style={{ margin: 0 }}>Please scan the displayed QR code with your EUDI Wallet App.</p>
          <p style={{ margin: 0, fontSize: '1rem' }}>
            Alternatively, click on the offer link to open it directly in your wallet.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '480px',
            gap: '30px',
          }}
        >
          {/* Loading state */}
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
              <p style={{ margin: 0, color: '#6c757d' }}>Renewing credential offer...</p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div
              style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #f5c6cb',
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
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

          {/* Credential offer loaded (by value) */}
          {!isLoading &&
            !error &&
            offerDeeplinkVal &&
            showCredentialOffer(offerDeeplinkVal, 'By value')}

          {/* Credential offer loaded (by reference) */}
          {!isLoading &&
            !error &&
            offerDeeplink &&
            showCredentialOffer(offerDeeplink, 'By reference')}

          {/* Renew button */}
          {!isLoading && !error && (
            <div style={{ marginTop: '20px' }}>
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
                Renew credential offer
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

function showCredentialOffer(offerLink: string, title: string) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      <div>
        <p
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '15px',
            color: '#212529',
            fontStyle: 'italic',
          }}
        >
          {title}
        </p>
        <div style={{ maxWidth: '800px', wordBreak: 'break-all' }}>
          <a href={offerLink} target="_blank" rel="noopener noreferrer">
            {offerLink}
          </a>
        </div>
      </div>
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <QRCode
          value={offerLink}
          size={300}
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          viewBox={`0 0 300 300`}
        />
      </div>
    </div>
  );
}

export default Dashboard;
