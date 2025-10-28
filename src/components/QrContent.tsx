import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import oid4vcService from "../services/oid4vc.service";

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
    <div>
      <h1 style={{ fontSize: "2rem", marginBottom: "20px", fontWeight: 400 }}>
        You are logged in
      </h1>

      <p
        style={{
          fontSize: "1.125rem",
          marginBottom: "30px",
          lineHeight: "1.6",
          color: "#333",
        }}
      >
        Please scan the displayed QR code with your EUDI Wallet App.
      </p>

      {isLoading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            marginTop: "30px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #0865f0ff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ margin: 0 }}>Generating QR code...</p>
        </div>
      )}

      {!isLoading && error && (
        <div
          style={{
            backgroundColor: "#f8d7da",
            color: "#721c24",
            padding: "20px",
            borderRadius: "4px",
            marginTop: "20px",
          }}
        >
          {error}
        </div>
      )}

      {!isLoading && !error && qrImageSrc && (
        <div style={{ marginTop: "30px", marginBottom: "40px" }}>
          <img
            src={qrImageSrc}
            alt="Credential Offer QR Code"
            style={{
              width: "360px",
              height: "360px",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
            }}
          />
        </div>
      )}

      {!isLoading && !error && !qrImageSrc && offerDeeplink && (
        <div style={{ marginTop: "30px", marginBottom: "40px" }}>
          <p style={{ fontWeight: 600, marginBottom: "10px" }}>
            Deeplink (Fallback):
          </p>
          <textarea
            readOnly
            value={offerDeeplink}
            style={{
              width: "100%",
              maxWidth: "600px",
              height: "80px",
              padding: "10px",
              fontFamily: "monospace",
              fontSize: "0.9rem",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
              resize: "vertical",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: "15px", marginTop: "30px" }}>
        <button
          onClick={onBack}
          style={{
            backgroundColor: "#6c757d",
            color: "#fff",
            border: "none",
            padding: "12px 24px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        >
          Back
        </button>
        <button
          onClick={logout}
          style={{
            backgroundColor: "#dc3545",
            color: "#fff",
            border: "none",
            padding: "12px 24px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        >
          Logout
        </button>
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

export default QrContent;
