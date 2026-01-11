import React from 'react';
import PropTypes from 'prop-types';

export default function StudioToast({ toasts, onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className="toast-item" role="status">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>{t.title || (t.type === 'error' ? 'Error' : 'Info')}</div>
            <button onClick={() => onDismiss?.(t.id)} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>{t.message}</div>
        </div>
      ))}
    </div>
  );
}

StudioToast.propTypes = {
  toasts: PropTypes.array,
  onDismiss: PropTypes.func,
};
