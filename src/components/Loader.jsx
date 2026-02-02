import React from 'react';
import PropTypes from 'prop-types';

export default function Loader({ active, message, progress }) {
  if (!active) return null;

  const normalized = typeof progress === "number" && Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : null;
  const indeterminate = normalized == null;
  const barValue = indeterminate ? 0.3 : normalized;

  return (
    <div className="loader-container" role="status" aria-live="polite">
      <div className="loader-content loader-elevated">
        <div className="loader-orbit">
          <div className="loader-glow"></div>
          <div className="loader-radial">
            <span className="loader-arc arc-a"></span>
            <span className="loader-arc arc-b"></span>
            <span className="loader-arc arc-c"></span>
          </div>
          <div className="loader-core"></div>
          <div className="loader-scanline"></div>
          <div className="loader-dots">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="loader-dot"
                style={{ animationDelay: `${i * 0.12}s` }}
              ></span>
            ))}
          </div>
        </div>

        <div className="loader-text">
          <div className="loader-title">{message || "Preparing Studio"}</div>
          <div className="loader-subtitle">
            Calibrating lights · Priming shaders · Syncing collab channel
          </div>
        </div>

        <div className="progress-container loader-progress">
          <div className="progress-bar">
            <div
              className={`progress-fill${indeterminate ? " indeterminate" : ""}`}
              style={{ width: `${Math.min(100, Math.max(14, Math.round(barValue * 100)))}%` }}
            ></div>
            <div className="progress-glow"></div>
          </div>
          <div className="loader-progress-row">
            <span className="progress-text">
              {normalized != null ? `${Math.round(normalized * 100)}% ready` : "Streaming assets"}
            </span>
            <span className="loader-chip">Autosave armed</span>
          </div>
        </div>

        <div className="loader-chips">
          <span className="loader-chip">GPU sync</span>
          <span className="loader-chip">Scene graph</span>
          <span className="loader-chip">Collaboration</span>
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
