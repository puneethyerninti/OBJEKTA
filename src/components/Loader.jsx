import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';

export default function Loader({ active, message, progress }) {
  // Animated percentage counter
  const [displayPct, setDisplayPct] = useState(0);
  const rafRef = useRef(null);

  const normalized = typeof progress === "number" && Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : null;
  const indeterminate = normalized == null;
  const targetPct = indeterminate ? 0 : Math.round(normalized * 100);

  // Smoothly animate percentage counter (use ref to avoid stale closure)
  const currentPctRef = useRef(0);
  useEffect(() => {
    if (indeterminate) { setDisplayPct(0); currentPctRef.current = 0; return; }
    const step = () => {
      const cur = currentPctRef.current;
      if (cur < targetPct) {
        const next = Math.min(targetPct, cur + Math.max(1, Math.ceil((targetPct - cur) * 0.08)));
        currentPctRef.current = next;
        setDisplayPct(next);
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetPct, indeterminate]);

  if (!active) return null;

  return (
    <div className="loader-overlay" role="status" aria-live="polite">
      <div className="loader-premium">
        {/* Ambient glow */}
        <div className="loader-ambient" aria-hidden="true" />

        {/* Multi-ring spinner */}
        <div className="loader-rings">
          <svg className="loader-ring-svg" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="54" stroke="rgba(127,90,240,0.12)" strokeWidth="2" />
            <circle cx="60" cy="60" r="54" stroke="url(#loaderGrad1)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="85 255" className="loader-ring-a" />
            <circle cx="60" cy="60" r="44" stroke="rgba(0,215,255,0.08)" strokeWidth="1.5" />
            <circle cx="60" cy="60" r="44" stroke="url(#loaderGrad2)" strokeWidth="2" strokeLinecap="round" strokeDasharray="55 221" className="loader-ring-b" />
            <circle cx="60" cy="60" r="34" stroke="rgba(255,71,163,0.06)" strokeWidth="1" />
            <circle cx="60" cy="60" r="34" stroke="url(#loaderGrad3)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="35 179" className="loader-ring-c" />
            <circle cx="60" cy="6" r="3" fill="#7f5af0" className="loader-orbit-dot-a" opacity="0.9">
              <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="16" r="2" fill="#00d7ff" className="loader-orbit-dot-b" opacity="0.7">
              <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <defs>
              <linearGradient id="loaderGrad1" x1="0" y1="0" x2="120" y2="120">
                <stop offset="0%" stopColor="#7f5af0" />
                <stop offset="100%" stopColor="#00d7ff" />
              </linearGradient>
              <linearGradient id="loaderGrad2" x1="120" y1="0" x2="0" y2="120">
                <stop offset="0%" stopColor="#00d7ff" />
                <stop offset="100%" stopColor="#ff47a3" />
              </linearGradient>
              <linearGradient id="loaderGrad3" x1="0" y1="120" x2="120" y2="0">
                <stop offset="0%" stopColor="#ff47a3" />
                <stop offset="100%" stopColor="#7f5af0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="loader-center-pulse" />
        </div>

        {/* Text */}
        <div className="loader-info">
          <div className="loader-msg">{message || "Initializing Studio"}</div>
          <div className="loader-detail">
            {indeterminate ? "Streaming assets..." : `${displayPct}% loaded`}
          </div>
        </div>

        {/* Progress bar with animated bars */}
        <div className="loader-progress-track">
          <div
            className={`loader-progress-bar${indeterminate ? " loader-progress-indeterminate" : ""}`}
            style={{ width: indeterminate ? undefined : `${Math.max(8, displayPct)}%` }}
          />
          <div className="loader-progress-shine" />
          {/* Animated equalizer bars */}
          <div className="loader-eq-bars" aria-hidden="true">
            <span className="loader-eq-bar" style={{ animationDelay: '0s' }} />
            <span className="loader-eq-bar" style={{ animationDelay: '0.15s' }} />
            <span className="loader-eq-bar" style={{ animationDelay: '0.3s' }} />
            <span className="loader-eq-bar" style={{ animationDelay: '0.45s' }} />
            <span className="loader-eq-bar" style={{ animationDelay: '0.6s' }} />
            <span className="loader-eq-bar" style={{ animationDelay: '0.2s' }} />
            <span className="loader-eq-bar" style={{ animationDelay: '0.5s' }} />
            <span className="loader-eq-bar" style={{ animationDelay: '0.1s' }} />
          </div>
        </div>

        {/* Percentage counter */}
        {!indeterminate && (
          <div className="loader-pct-counter" aria-hidden="true">
            <span className="loader-pct-num">{displayPct}</span>
            <span className="loader-pct-symbol">%</span>
          </div>
        )}

        {/* Status chips with staggered pulse */}
        <div className="loader-status-row">
          <span className="loader-status-chip loader-chip-stagger-1">
            <span className="loader-status-dot loader-dot-pulse" />GPU sync
          </span>
          <span className="loader-status-chip loader-chip-stagger-2">
            <span className="loader-status-dot dot-teal loader-dot-pulse" />Scene graph
          </span>
          <span className="loader-status-chip loader-chip-stagger-3">
            <span className="loader-status-dot dot-pink loader-dot-pulse" />Collaboration
          </span>
        </div>
      </div>
    </div>
  );
}

Loader.propTypes = {
  active: PropTypes.bool,
  message: PropTypes.string,
  progress: PropTypes.number,
};
