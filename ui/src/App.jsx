import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Upload from './pages/Upload';
import CollectionView from './pages/CollectionView';

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
                Logout
              </button>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/collection/:id" element={<CollectionView />} />
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
