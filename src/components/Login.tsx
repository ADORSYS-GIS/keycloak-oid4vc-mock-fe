import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { IssuanceFlow } from '../issuanceFlow';

const flowCards: Array<{
  flow: IssuanceFlow;
  title: string;
  summary: string;
  button: string;
}> = [
  {
    flow: 'pre-authorized',
    title: 'Pre-authorized code flow',
    summary: 'Create a credential offer that already contains a pre-authorized grant for the logged-in user.',
    button: 'Start pre-auth issuance',
  },
  {
    flow: 'authorization-code',
    title: 'Authorization code flow',
    summary: 'Create a credential offer with issuer_state; the wallet completes the normal Keycloak authorization step.',
    button: 'Start auth-code issuance',
  },
];

const Login = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '40px 20px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '900px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 12px', fontWeight: 500, color: '#212529' }}>Choose issuance flow</h1>
        <p style={{ margin: '0 0 28px', color: '#6c757d', fontSize: '1rem' }}>
          Select how the wallet should receive the credential offer, then continue with Keycloak.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
            marginBottom: '28px',
          }}
        >
          {flowCards.map((card) => (
            <section
              key={card.flow}
              style={{
                backgroundColor: '#fff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div>
                <h2 style={{ margin: '0 0 10px', fontSize: '1.25rem', color: '#212529' }}>{card.title}</h2>
                <p style={{ margin: 0, color: '#6c757d', lineHeight: 1.5 }}>{card.summary}</p>
              </div>
              <button
                onClick={() => login(card.flow)}
                style={{
                  padding: '12px 18px',
                  fontSize: '15px',
                  backgroundColor: card.flow === 'authorization-code' ? '#087ca8' : '#0865f0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  marginTop: 'auto',
                }}
              >
                {card.button}
              </button>
            </section>
          ))}
        </div>

        <p style={{ margin: '0 0 12px', color: '#6c757d', fontSize: '0.95rem' }}>
          Or just sign in and use the default pre-authorized flow.
        </p>
      </div>
      <button
        onClick={() => login()}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
      >
        Login with Keycloak
      </button>
    </div>
  );
};

export default Login;
