import React from 'react';
import PropTypes from 'prop-types';

export default function StudioToast({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item toast-item--${t.type || 'info'}`} role="status">
          <div className="toast-item__header">
            <div className="toast-item__title">{t.title || (t.type === 'error' ? 'Error' : 'Info')}</div>
            <button onClick={() => onDismiss?.(t.id)} aria-label="Dismiss notification" className="toast-item__close">✕</button>
          </div>
          <div className="toast-item__message">{t.message}</div>
        </div>
      ))}
    </div>
  );
}

StudioToast.propTypes = {
  toasts: PropTypes.array,
  onDismiss: PropTypes.func,
};
