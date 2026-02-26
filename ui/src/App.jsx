import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Upload from './pages/Upload';
import CollectionView from './pages/CollectionView';
import MediaEdit from './pages/MediaEdit';
import CollectionEdit from './pages/CollectionEdit';

function Login() {
  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  const handleGithubLogin = () => {
    window.location.href = '/auth/github';
  };

  return (
    <section className="hero is-fullheight is-light login-page">
      <div className="hero-body">
        <div className="container has-text-centered">
          <h1 className="title login-title mb-6">
            Welcome
          </h1>
          <div className="is-flex is-flex-direction-column is-align-items-center" style={{ gap: '0.75rem' }}>
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
            <button
              onClick={handleGithubLogin}
              className="button is-medium is-dark github-btn"
            >
              <span className="icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </span>
              <span>Sign in with GitHub</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MainApp({ user, onLogout }) {
  const [imageError, setImageError] = useState(false);

  return (
    <BrowserRouter>
      <section className="section main-app has-background-light">
        {/* Header */}
        <nav className="level mb-6 pb-4 container" style={{ borderBottom: '1px solid #ddd' }}>
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
                <span className="icon">
                  <i className="fas fa-sign-out-alt"></i>
                </span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/collection/:id" element={<CollectionView />} />
          <Route path="/collection/:id/edit" element={<CollectionEdit />} />
          <Route path="/collection/:id/media/:mediaId/edit" element={<MediaEdit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
    </BrowserRouter>
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
