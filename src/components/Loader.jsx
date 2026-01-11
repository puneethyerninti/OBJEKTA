import React from 'react';
import PropTypes from 'prop-types';

export default function Loader({ active, message, progress }) {
  if (!active) return null;
  return (
    <div className="loader-container" role="status" aria-live="polite">
      <div className="loader-content">
        {/* Enhanced loading animation with multiple elements */}
        <div className="loader-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-core"></div>
        </div>
        <div className="loader-particles">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="particle" style={{ animationDelay: `${i * 0.1}s` }}></div>
          ))}
        </div>
        <div style={{ marginBottom: 16, fontWeight: 700, fontSize: '18px', color: 'var(--brand-purple)' }}>
          {message || 'Loading Experience...'}
        </div>
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            ></div>
            <div className="progress-glow"></div>
          </div>
        </div>
        {typeof progress === 'number' && (
          <div className="progress-text">{Math.round(progress * 100)}%</div>
        )}
        <div className="loader-subtitle">Initializing holographic interface...</div>
      </div>
    </div>
  );
}

Loader.propTypes = {
  active: PropTypes.bool,
  message: PropTypes.string,
  progress: PropTypes.number,
};
