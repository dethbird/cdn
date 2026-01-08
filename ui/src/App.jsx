import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';

function Login() {
  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <section className="hero is-fullheight is-light login-page">
      <div className="hero-body">
        <div className="container has-text-centered">
          <h1 className="title login-title mb-6">
            Welcome
          </h1>
          <button
            onClick={handleGoogleLogin}
            className="button is-medium is-link google-btn"
          >
            <span className="icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </span>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function MainApp({ user, onLogout }) {
  const [collection, setCollection] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [imageError, setImageError] = useState(false);

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
        
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
    if (selectedCollectionId) {
      fetchCollection(selectedCollectionId);
    }
  };

  return (
    <section className="section main-app has-background-light">
      <div className="container">
        {/* Header */}
        <nav className="level mb-6 pb-4" style={{ borderBottom: '1px solid #ddd' }}>
          <div className="level-left">
            <div className="level-item">
              <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
                {user.picture && !imageError ? (
                  <img 
                    src={user.picture} 
                    alt={user.name}
                    onError={() => setImageError(true)}
                    className="user-avatar"
                  />
                ) : (
                  <div className="avatar-fallback">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div>
                  <p className="has-text-weight-semibold is-size-6">{user.name}</p>
                  <p className="has-text-grey is-size-7">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="level-right">
            <div className="level-item">
              <button
                onClick={onLogout}
                className="button is-light"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        {/* Upload Section Header */}
        <div className="level mb-5">
          <div className="level-left">
            <div className="level-item">
              <h2 className="title is-4 mb-0">Upload File</h2>
            </div>
          </div>
          <div className="level-right">
            <div className="level-item">
              <button
                onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
                className="button is-link"
              >
                {showNewCollectionForm ? 'Cancel' : '+ New Collection'}
              </button>
            </div>
          </div>
        </div>

        {/* New Collection Form */}
        {showNewCollectionForm && (
          <div className="box mb-5">
            <form onSubmit={handleCreateCollection}>
              <div className="field">
                <label className="label">Collection Name</label>
                <div className="control">
                  <input
                    className="input form-field-max"
                    type="text"
                    value={newCollectionTitle}
                    onChange={(e) => setNewCollectionTitle(e.target.value)}
                    placeholder="My New Collection"
                    required
                  />
                </div>
              </div>
              <div className="field">
                <div className="control">
                  <button type="submit" className="button is-success">
                    Create Collection
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* File Upload Component */}
        <FileUpload 
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onCollectionChange={setSelectedCollectionId}
          onUploadSuccess={handleUploadSuccess} 
        />
        
        {/* Media Gallery */}
        {loading ? (
          <div className="has-text-centered has-text-grey mt-6">
            Loading your images...
          </div>
        ) : collection && collection.media && collection.media.length > 0 ? (
          <div className="mt-6">
            <h3 className="title is-5 mb-5">
              {collection.title || 'My Uploads'}
            </h3>
            <div className="columns is-multiline">
              {collection.media.map((media) => {
                const variant640 = media.variants.find(v => v.variant === '640');
                const variant960 = media.variants.find(v => v.variant === '960');
                const displayVariant = variant640 || variant960 || media.variants[0];
                const isArchive = media.type === 'archive';
                const isAudio = media.type === 'audio';
                const isVideo = media.type === 'video';
                
                return (
                  <div key={media.id} className="column is-one-third-desktop is-half-tablet">
                    <div className="card">
                      {isArchive ? (
                        <div className="card-image">
                          <div className="media-placeholder has-background-light has-text-grey">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <p className="mt-3 is-size-7 has-text-weight-medium">ZIP Archive</p>
                          </div>
                        </div>
                      ) : isAudio ? (
                        <div className="card-image">
                          <div className="audio-container has-background-light">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18V5l12-2v13"></path>
                              <circle cx="6" cy="18" r="3"></circle>
                              <circle cx="18" cy="16" r="3"></circle>
                            </svg>
                            <audio controls className="audio-player">
                              <source src={displayVariant.url} type="audio/mpeg" />
                            </audio>
                          </div>
                        </div>
                      ) : isVideo ? (
                        <div className="card-image">
                          <video controls className="video-player">
                            <source src={displayVariant.url} type="video/mp4" />
                          </video>
                        </div>
                      ) : (
                        <div className="card-image">
                          <figure className="image">
                            <img src={displayVariant.url} alt={media.title || 'Uploaded image'} />
                          </figure>
                        </div>
                      )}
                      <div className="card-content">
                        {media.title && (
                          <p className="title is-6 mb-2">{media.title}</p>
                        )}
                        {media.caption && (
                          <p className="subtitle is-7 has-text-grey mb-2">{media.caption}</p>
                        )}
                        {!isArchive && !isAudio && !isVideo && media.width && media.height && (
                          <p className="is-size-7 has-text-grey-light mb-2">
                            {media.width} × {media.height}
                          </p>
                        )}
                        <div className="tags">
                          {media.variants.map(v => (
                            <a key={v.id} href={v.url} download className="tag is-light">
                              {v.variant} ({Math.round(v.bytes / 1024)}KB)
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="has-text-centered has-text-grey mt-6">
            No images yet. Upload your first image above!
          </div>
        )}
      </div>
    </section>
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
      <div className="loading-container">
        <span className="is-size-5 has-text-grey">Loading...</span>
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
