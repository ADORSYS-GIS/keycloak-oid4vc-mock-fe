import { useAuth } from '../hooks/useAuth';

const Dashboard = () => {
  const { userProfile, logout, getToken } = useAuth();

  const handleCopyToken = () => {
    const token = getToken();
    if (token) {
      navigator.clipboard.writeText(token);
      alert('Token copied to clipboard!');
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '30px', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
      }}>
        <h1 style={{ marginBottom: '20px' }}>
          Hello {userProfile?.firstName || userProfile?.username}!
        </h1>
        
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '20px', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          <h3 style={{ marginBottom: '15px' }}>User Information:</h3>
          <p><strong>Username:</strong> {userProfile?.username || 'N/A'}</p>
          <p><strong>Email:</strong> {userProfile?.email || 'N/A'}</p>
          <p><strong>First Name:</strong> {userProfile?.firstName || 'N/A'}</p>
          <p><strong>Last Name:</strong> {userProfile?.lastName || 'N/A'}</p>
          <p><strong>User ID:</strong> {userProfile?.id || 'N/A'}</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleCopyToken}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Copy Access Token
          </button>
          
          <button
            onClick={logout}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
