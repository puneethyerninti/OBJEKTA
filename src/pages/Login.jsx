import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import '../styles/PremiumPages.css';

export default function Login() {
  usePageTitle("Login");
  const { login } = useAuth() || {};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [gisAvailable, setGisAvailable] = useState(false);
  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID__);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    const syncAvailability = () => {
      const ready = Boolean(window.google && window.google.accounts && window.google.accounts.id);
      setGisAvailable(ready);
      return ready;
    };

    syncAvailability();

    const onGsiReady = () => {
      syncAvailability();
    };
    window.addEventListener('objekta:gsi-ready', onGsiReady);

    const intervalId = window.setInterval(() => {
      if (syncAvailability()) {
        window.clearInterval(intervalId);
      }
    }, 600);

    return () => {
      window.removeEventListener('objekta:gsi-ready', onGsiReady);
      window.clearInterval(intervalId);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.ok) {
        navigate('/dashboard');
      } else {
        setErr(result?.error || 'Login failed');
      }
    } catch (error) {
      setErr(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <Link to="/" className="auth-logo">
            <span className="auth-logo-text">OBJEKTA</span>
          </Link>
        </div>
        
        <div className="auth-card">
          <h1 className="auth-title">Sign in</h1>
          <p className="auth-subtitle">Enter your credentials to access your workspace</p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email</label>
              <input 
                id="login-email"
                className="auth-input" 
                type="email"
                name="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="name@company.com"
                required
                autoComplete="email"
              />
            </div>
            
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-password">Password</label>
              <input 
                id="login-password"
                className="auth-input" 
                type="password"
                name="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>
            
            {err && <div className="auth-error" role="alert">{err}</div>}
            
            <button type="submit" className="auth-button" disabled={loading} aria-busy={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Placeholder for Google's rendered button (AppInit will render into this if present) */}
          <div className="auth-google-placeholder" style={{ marginTop: 12 }}>
            <div id="g_id_signin" />
            {hasGoogleClientId && (
              <div
                role="note"
                style={{ marginTop: 10, fontSize: '0.78rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}
              >
                If Google shows <strong>origin_mismatch</strong>, add <strong>{currentOrigin}</strong> in Google Cloud Console under OAuth client Authorized JavaScript origins.
              </div>
            )}
            {!hasGoogleClientId && (
              <div className="auth-error" role="status" style={{ marginTop: 10 }}>
                Google Sign-in is not configured for this environment.
              </div>
            )}
            {hasGoogleClientId && !gisAvailable && (
              <button
                type="button"
                className="auth-button auth-google-fallback"
                onClick={async () => {
                  setErr(null);
                  setLoading(true);
                  try {
                    if (window.google && window.google.accounts && window.google.accounts.id) {
                      window.google.accounts.id.prompt();
                    } else {
                      setErr('Google Sign-in not initialized. Please refresh or follow setup instructions.');
                    }
                  } catch (e) {
                    setErr(e.message || 'Google sign-in failed');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <span className="auth-google-logo" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" focusable="false">
                    <path fill="#EA4335" d="M17.64 9.2c0-.63-.06-1.23-.18-1.8H9v3.4h4.84c-.21 1.15-.84 2.12-1.8 2.78v2.3h2.9c1.7-1.57 2.7-3.88 2.7-6.68z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.16l-2.9-2.3c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.58-5.05-3.7H1.02v2.32C2.5 15.9 5.5 18 9 18z"/>
                    <path fill="#4A90E2" d="M3.95 10.8a5.4 5.4 0 010-3.6V4.88H1.02A9 9 0 000 9c0 1.45.33 2.83.92 4.06l3.03-2.26z"/>
                    <path fill="#FBBC05" d="M9 3.6c1.32 0 2.5.45 3.43 1.34l2.57-2.57C13.44.9 11.4 0 9 0 5.5 0 2.5 2.1 1.02 4.88L4.05 7.1C4.66 5 6.65 3.6 9 3.6z"/>
                  </svg>
                </span>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
          
          <div className="auth-divider">
            <span>New to OBJEKTA?</span>
          </div>
          
          <Link to="/register" className="auth-link-button">
            Create your account
          </Link>
        </div>
        
        <div className="auth-footer">
          <Link to="/" className="auth-footer-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
