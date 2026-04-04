import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import '../styles/PremiumPages.css';

export default function Register() {
  usePageTitle("Register");
  const { signup } = useAuth() || {};
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const result = await signup(name, email, password);
      if (result?.ok) {
        navigate('/dashboard');
      } else {
        setErr(result?.error || 'Signup failed');
      }
    } catch (error) {
      setErr(error.message || 'Signup failed');
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
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">Start building immersive 3D experiences today</p>
          
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-name">Full name</label>
              <input 
                id="register-name"
                className="auth-input" 
                type="text"
                name="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="John Doe"
                required
                autoComplete="name"
              />
            </div>
            
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-email">Email</label>
              <input 
                id="register-email"
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
              <label className="auth-label" htmlFor="register-password">Password</label>
              <input 
                id="register-password"
                className="auth-input" 
                type="password"
                name="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Create a strong password"
                required
                minLength="6"
                autoComplete="new-password"
                aria-describedby="password-hint"
              />
              <span id="password-hint" className="auth-hint">Must be at least 6 characters</span>
            </div>
            
            {err && <div className="auth-error" role="alert">{err}</div>}
            
            <button type="submit" className="auth-button" disabled={loading} aria-busy={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          
          <div className="auth-divider">
            <span>Already have an account?</span>
          </div>
          
          <Link to="/login" className="auth-link-button">
            Sign in instead
          </Link>
        </div>
        
        <div className="auth-footer">
          <Link to="/" className="auth-footer-link">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
