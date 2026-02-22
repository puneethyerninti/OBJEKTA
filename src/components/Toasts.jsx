import React from 'react';
import PropTypes from 'prop-types';

export default function Toasts({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toasts-root" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || 'info'}`} role="status">
          <div className="toast-text">{t.text}</div>
          <button className="toast-close" onClick={() => onDismiss?.(t.id)} aria-label="Dismiss notification">✕</button>
        </div>
      ))}
    </div>
  );
}

Toasts.propTypes = {
  toasts: PropTypes.array,
  onDismiss: PropTypes.func,
};
