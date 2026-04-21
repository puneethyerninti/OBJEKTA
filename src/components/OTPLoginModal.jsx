import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Clock, CheckCircle } from 'lucide-react';
import '../styles/OTPLogin.css';

export default function OTPLoginModal({ isOpen, onClose, onSuccess }) {
  const { requestOTP, verifyOTP, loading } = useAuth();
  const [step, setStep] = useState('email'); // email | otp | success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [devOtp, setDevOtp] = useState(null);

  // Countdown for OTP expiry
  useEffect(() => {
    if (step !== 'otp') return;
    if (timeLeft <= 0) {
      setStep('email');
      setError('OTP expired. Please request a new one.');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const { ok, data } = await requestOTP(email);
    if (ok) {
      setStep('otp');
      setTimeLeft(30);
      // For testing: log the OTP if in development
      if (data?.otp) {
        setDevOtp(data.otp);
        console.log('📧 Dev OTP:', data.otp);
      }
    } else {
      setError(data?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    const { ok, error: err } = await verifyOTP(email, otp);
    if (ok) {
      setStep('success');
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } else {
      setError(err || 'Invalid OTP. Try again.');
    }
  };

  const handleClose = () => {
    setStep('email');
    setEmail('');
    setOtp('');
    setError('');
    setTimeLeft(30);
    setDevOtp(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="otp-modal-overlay" onClick={handleClose}>
      <div className="otp-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="otp-modal-close" onClick={handleClose}>
          <X size={20} />
        </button>

        {step === 'email' && (
          <div className="otp-step">
            <h2>Passwordless Login</h2>
            <p className="otp-subtitle">Enter your email to receive a login code</p>

            <form onSubmit={handleRequestOTP} className="otp-form">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="otp-input"
              />
              {error && <div className="otp-error">{error}</div>}
              <button type="submit" disabled={loading} className="otp-button">
                {loading ? 'Sending...' : 'Send Login Code'}
              </button>
            </form>

            <p className="otp-help">
              No password needed. We'll send a 6-digit code to your email valid for 30 seconds.
            </p>
          </div>
        )}

        {step === 'otp' && (
          <div className="otp-step">
            <h2>Enter Code</h2>
            <p className="otp-subtitle">Check your email for the code</p>

            <div className={`otp-timer ${timeLeft <= 10 ? 'warning' : ''}`}>
              <Clock size={16} />
              <span>{timeLeft}s remaining</span>
            </div>

            <form onSubmit={handleVerifyOTP} className="otp-form">
              <input
                type="text"
                maxLength="6"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                className="otp-input otp-code-input"
                autoFocus
              />
              {devOtp && import.meta.env.DEV && (
                <div className="otp-dev-hint">
                  📧 Dev: {devOtp}
                </div>
              )}
              {error && <div className="otp-error">{error}</div>}
              <button type="submit" disabled={loading || otp.length !== 6} className="otp-button">
                {loading ? 'Verifying...' : 'Login'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setOtp('');
                setError('');
              }}
              className="otp-back-btn"
            >
              ← Back
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="otp-step otp-success">
            <CheckCircle size={48} className="otp-success-icon" />
            <h2>Welcome back!</h2>
            <p>You're logged in securely.</p>
          </div>
        )}
      </div>
    </div>
  );
}
