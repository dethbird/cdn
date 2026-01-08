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
  const [collection, setCollection] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
        
        // Set selected collection to first one if none selected
        if (!selectedCollectionId && data.length > 0) {
          setSelectedCollectionId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  };

  const fetchCollection = async (collectionId) => {
    if (!collectionId) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      }
    } catch (error) {
      console.error('Failed to fetch collection:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (selectedCollectionId) {
      fetchCollection(selectedCollectionId);
    }
  }, [selectedCollectionId]);

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    
    if (!newCollectionTitle.trim()) return;
    
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCollectionTitle
        })
      });
      
      if (response.ok) {
        const newCollection = await response.json();
        setNewCollectionTitle('');
        setShowNewCollectionForm(false);
        await fetchCollections();
        setSelectedCollectionId(newCollection.id);
      }
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  };

  const handleUploadSuccess = (response) => {
    console.log('Upload successful:', response);
    // Refresh collection after upload
    if (selectedCollectionId) {
      fetchCollection(selectedCollectionId);
    }
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
        maxWidth: '1200px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.8rem', margin: 0, color: '#333' }}>
            Upload Image
          </h2>
          <button
            onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#fff',
              backgroundColor: '#4285f4',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#357ae8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4285f4'}
          >
            {showNewCollectionForm ? 'Cancel' : '+ New Collection'}
          </button>
        </div>

        {showNewCollectionForm && (
          <form 
            onSubmit={handleCreateCollection}
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333'
              }}>
                Collection Name
              </label>
              <input
                type="text"
                value={newCollectionTitle}
                onChange={(e) => setNewCollectionTitle(e.target.value)}
                placeholder="My New Collection"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#fff',
                backgroundColor: '#34a853',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d8e47'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#34a853'}
            >
              Create Collection
            </button>
          </form>
        )}

        <ImageUpload 
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onCollectionChange={setSelectedCollectionId}
          onUploadSuccess={handleUploadSuccess} 
        />
        
        {loading ? (
          <div style={{ marginTop: '3rem', textAlign: 'center', color: '#666' }}>
            Loading your images...
          </div>
        ) : collection && collection.media && collection.media.length > 0 ? (
          <div style={{ marginTop: '3rem' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', color: '#333' }}>
              {collection.title || 'My Uploads'}
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem'
            }}>
              {collection.media.map((media) => {
                const variant640 = media.variants.find(v => v.variant === '640');
                const variant960 = media.variants.find(v => v.variant === '960');
                const displayVariant = variant640 || variant960 || media.variants[0];
                
                return (
                  <div
                    key={media.id}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'box-shadow 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
                    onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                  >
                    <img
                      src={displayVariant.url}
                      alt="Uploaded image"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block'
                      }}
                    />
                    <div style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                        {media.width} × {media.height}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: '#999',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}>
                        {media.variants.map(v => (
                          <span key={v.id} style={{ 
                            padding: '2px 6px', 
                            backgroundColor: '#f0f0f0',
                            borderRadius: '3px'
                          }}>
                            {v.variant} ({Math.round(v.bytes / 1024)}KB)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '3rem', textAlign: 'center', color: '#666' }}>
            No images yet. Upload your first image above!
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
