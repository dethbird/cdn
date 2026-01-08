import { useState, useEffect } from 'react';
import ImageUpload from './components/ImageUpload';

function Login() {
  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '3rem', color: '#333' }}>
        Welcome
      </h1>
      <button
        onClick={handleGoogleLogin}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: '500',
          color: '#fff',
          backgroundColor: '#4285f4',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          transition: 'box-shadow 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)'}
        onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.25)'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}

function MainApp({ user, onLogout }) {
  const [uploadedMedia, setUploadedMedia] = useState([]);

  const handleUploadSuccess = (response) => {
    console.log('Upload successful:', response);
    setUploadedMedia(prev => [...prev, response]);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: '1200px',
        marginBottom: '3rem',
        padding: '1rem 0',
        borderBottom: '1px solid #ddd'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user.picture && (
            <img 
              src={user.picture} 
              alt={user.name}
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%' 
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{user.name}</div>
            <div style={{ color: '#666', fontSize: '0.9rem' }}>{user.email}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            color: '#333',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
        >
          Logout
        </button>
      </div>
      <div style={{ 
        width: '100%',
        maxWidth: '800px'
      }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem', color: '#333' }}>
          Upload Image
        </h2>
        <ImageUpload onUploadSuccess={handleUploadSuccess} />
        
        {uploadedMedia.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1rem', color: '#333' }}>
              Uploaded Images
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
              gap: '1rem' 
            }}>
              {uploadedMedia.map((media, index) => (
                <div key={index} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  padding: '0.5rem',
                  backgroundColor: '#fff'
                }}>
                  <img 
                    src={media.url} 
                    alt={`Uploaded ${index + 1}`}
                    style={{ 
                      width: '100%', 
                      height: 'auto', 
                      borderRadius: '4px' 
                    }}
                  />
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.85rem', 
                    color: '#666',
                    wordBreak: 'break-all'
                  }}>
                    ID: {media.publicId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setAuthState({ loading: false, authenticated: data.authenticated, user: data.user });
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState({ loading: false, authenticated: false, user: null });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthState({ loading: false, authenticated: false, user: null });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (authState.loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        Loading...
      </div>
    );
  }

  return authState.authenticated ? (
    <MainApp user={authState.user} onLogout={handleLogout} />
  ) : (
    <Login />
  );
}

export default App;
