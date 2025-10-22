import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import QrContent from "./QrContent";

type ActiveTab = "mailbox" | "qr";

const Dashboard = () => {
  const { userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("mailbox");

  const handleIssueCertificates = () => {
    setActiveTab("qr");
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: "300px",
          backgroundColor: "#f8f9fa",
          padding: "20px",
          borderRight: "1px solid #dee2e6",
        }}
      >
        <div style={{ marginBottom: "40px" }}>
          <h2
            style={{
              color: "#087ca8",
              fontSize: "1.2rem",
              marginBottom: "5px",
            }}
          >
            {userProfile?.firstName} {userProfile?.lastName}
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#6c757d" }}>
            Participant No.: 5708128
          </p>
        </div>

        <nav>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li style={{ marginBottom: "10px" }}>
              <button
                onClick={() => setActiveTab("mailbox")}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor:
                    activeTab === "mailbox" ? "#fff" : "transparent",
                  color: activeTab === "mailbox" ? "#212529" : "#853047",
                  fontWeight: activeTab === "mailbox" ? 500 : 400,
                  cursor: "pointer",
                  borderTop: "1px solid #e8e8e8",
                  fontSize: "1rem",
                }}
              >
                Mailbox Management
              </button>
            </li>
            <li style={{ marginBottom: "10px" }}>
              <button
                onClick={() => setActiveTab("qr")}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: activeTab === "qr" ? "#fff" : "transparent",
                  color: activeTab === "qr" ? "#212529" : "#853047",
                  fontWeight: activeTab === "qr" ? 500 : 400,
                  cursor: "pointer",
                  borderTop: "1px solid #e8e8e8",
                  fontSize: "1rem",
                }}
              >
                Tax Advisor Identity
              </button>
            </li>
            <li>
              <button
                onClick={logout}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#853047",
                  fontWeight: 400,
                  cursor: "pointer",
                  borderTop: "1px solid #e8e8e8",
                  borderBottom: "1px solid #e8e8e8",
                  fontSize: "1rem",
                }}
              >
                Logout
              </button>
            </li>
          </ul>
        </nav>

        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            right: "20px",
            fontSize: "0.75rem",
            textAlign: "center",
            color: "#6c757d",
          }}
        >
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "40px", backgroundColor: "#fff" }}>
        {activeTab === "mailbox" && (
          <div>
            <h1
              style={{
                fontSize: "2rem",
                marginBottom: "20px",
                fontWeight: 400,
              }}
            >
              Mailbox Management
            </h1>

            <div
              style={{
                backgroundColor: "#0865f0ff",
                color: "#fff",
                padding: "20px",
                borderRadius: "4px",
                marginBottom: "30px",
              }}
            >
              <p style={{ marginBottom: "10px" }}>
                Select <strong>one to a maximum of 10 mailboxes</strong>. Then
                download the certificates.
              </p>
              <button
                style={{
                  backgroundColor: "transparent",
                  color: "#fff",
                  border: "1px solid #fff",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginTop: "10px",
                }}
              >
                Got it
              </button>
            </div>

            {/* Mock Postbox */}
            <div
              style={{
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                padding: "20px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "start",
                  marginBottom: "15px",
                }}
              >
                <input
                  type="checkbox"
                  style={{ marginRight: "12px", marginTop: "4px" }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                    {userProfile?.firstName} {userProfile?.lastName}
                  </h3>
                </div>
                <span style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                  Valid until 26.01.2025
                </span>
              </div>

              <div
                style={{
                  marginLeft: "28px",
                  fontSize: "0.9rem",
                  color: "#6c757d",
                }}
              >
                <p>
                  Safe ID:
                  DE.BStBK_Sandbox.9103746a-ee80-4d3e-a303-7ae2c26bfea1.314a
                </p>
                <p>Address: test / 12345</p>
              </div>
            </div>

            <button
              onClick={handleIssueCertificates}
              style={{
                backgroundColor: "#0865f0ff",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              Download Certificate(s)
            </button>
          </div>
        )}

        {activeTab === "qr" && (
          <QrContent onBack={() => setActiveTab("mailbox")} />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
