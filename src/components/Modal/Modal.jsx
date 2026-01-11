import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

export default function Modal({ children, onClose, title, width = 520 }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const node = rootRef.current;
    const firstFocusable = node?.querySelector('button, a, input, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus?.();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab') {
        // Simple focus trap: keep focus inside modal
        const focusables = node.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const arr = Array.from(focusables);
        const idx = arr.indexOf(document.activeElement);
        if (e.shiftKey && idx === 0) {
          e.preventDefault();
          arr[arr.length - 1].focus();
        } else if (!e.shiftKey && idx === arr.length - 1) {
          e.preventDefault();
          arr[0].focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div ref={rootRef} className="modal-card" style={{ width, maxWidth: '95%' }}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {title && <h3>{title}</h3>}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

Modal.propTypes = {
  children: PropTypes.node,
  onClose: PropTypes.func,
  title: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
