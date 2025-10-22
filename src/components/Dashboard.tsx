import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import oid4vcService from "../services/oid4vc.service";

const Dashboard = () => {
  const { userProfile, logout } = useAuth();
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
      // Try to get server-generated QR code (PNG)
      const dataUrl = await oid4vcService.getCredentialOfferQrDataUrl();
      setQrImageSrc(dataUrl);
      setOfferDeeplink(null);
    } catch (qrError) {
      console.error(
        "Failed to get QR code image, trying deeplink fallback:",
        qrError,
      );

      // Fallback to deeplink
      try {
        const deeplink = await oid4vcService.getCredentialOfferDeeplink();
        setOfferDeeplink(deeplink);
        setQrImageSrc(null);
      } catch (deeplinkError) {
        console.error("Failed to get deeplink:", deeplinkError);
        setError("Failed to generate credential offer. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "40px",
        backgroundColor: "#f8f9fa",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header with user info and logout */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontWeight: 500, color: "#087ca8" }}>
            {userProfile?.firstName} {userProfile?.lastName}
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#6c757d" }}>
            {userProfile?.email}
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            backgroundColor: "#dc3545",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: 500,
          }}
        >
          Logout
        </button>
      </div>

      {/* Main content */}
      <div
        style={{
          maxWidth: "600px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            marginBottom: "20px",
            fontWeight: 400,
            color: "#212529",
          }}
        >
          Tax Advisor Identity
        </h1>

        <p
          style={{
            fontSize: "1.125rem",
            marginBottom: "40px",
            lineHeight: "1.6",
            color: "#6c757d",
          }}
        >
          Please scan the displayed QR code with your EUDI Wallet App and
          confirm saving your credential in your digital wallet.
        </p>

        {/* Loading state */}
        {isLoading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              marginTop: "40px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                border: "4px solid #e9ecef",
                borderTop: "4px solid #0865f0",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ margin: 0, color: "#6c757d" }}>
              Generating QR code...
            </p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div
            style={{
              backgroundColor: "#f8d7da",
              color: "#721c24",
              padding: "20px",
              borderRadius: "8px",
              marginTop: "20px",
              border: "1px solid #f5c6cb",
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
            <button
              onClick={prepareQr}
              style={{
                marginTop: "15px",
                backgroundColor: "#721c24",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* QR Code Image */}
        {!isLoading && !error && qrImageSrc && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                padding: "30px",
                borderRadius: "12px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <img
                src={qrImageSrc}
                alt="Credential Offer QR Code"
                style={{
                  width: "360px",
                  height: "360px",
                  display: "block",
                }}
              />
            </div>
            <button
              onClick={prepareQr}
              style={{
                backgroundColor: "#0865f0",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              Refresh QR Code
            </button>
          </div>
        )}

        {/* Deeplink Fallback */}
        {!isLoading && !error && !qrImageSrc && offerDeeplink && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <p
              style={{
                fontWeight: 600,
                marginBottom: "15px",
                color: "#212529",
              }}
            >
              Credential Offer Link:
            </p>
            <textarea
              readOnly
              value={offerDeeplink}
              style={{
                width: "100%",
                height: "120px",
                padding: "15px",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                resize: "vertical",
                backgroundColor: "#f8f9fa",
              }}
            />
            <button
              onClick={prepareQr}
              style={{
                marginTop: "20px",
                backgroundColor: "#0865f0",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              Refresh
            </button>
          </div>
        )}
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

export default Dashboard;
