import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
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
      await signup({ name, email, password });
      navigate('/dashboard');
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
              <label className="auth-label">Full name</label>
              <input 
                className="auth-input" 
                type="text"
                name="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="John Doe"
                required
              />
            </div>
            
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input 
                className="auth-input" 
                type="email"
                name="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="name@company.com"
                required
              />
            </div>
            
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input 
                className="auth-input" 
                type="password"
                name="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Create a strong password"
                required
                minLength="6"
              />
              <span className="auth-hint">Must be at least 6 characters</span>
            </div>
            
            {err && <div className="auth-error">{err}</div>}
            
            <button type="submit" className="auth-button" disabled={loading}>
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
