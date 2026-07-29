import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Shield } from 'lucide-react';

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
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        background: 'linear-gradient(135deg, #eef2f6 0%, #f8f9fa 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '44px 36px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: '#e7f1ff',
            color: 'var(--color-primary)',
          }}
        >
          <Shield size={36} aria-hidden="true" />
        </div>

        <h1
          style={{
            margin: '0 0 10px',
            fontSize: '1.6rem',
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          Authentication Required
        </h1>
        <p
          style={{
            margin: '0 0 32px',
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--color-muted)',
          }}
        >
          Please sign in with your Keycloak account to access the credential dashboard.
        </p>

        <button
          onClick={login}
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: '1rem',
            fontWeight: 600,
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease, transform 0.1s ease',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)')
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Login with Keycloak
        </button>
      </div>
    </div>
  );
};

export default Login;
