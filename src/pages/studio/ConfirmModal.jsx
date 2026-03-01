// src/pages/studio/ConfirmModal.jsx
import React, { useState, useEffect } from "react";

/**
 * Reusable confirm/input dialog rendered as a full-screen modal overlay.
 * Supports an optional text input field for rename/prompt workflows.
 */
const ConfirmModal = ({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  showInput = false,
  inputDefault = "",
  inputPlaceholder = "",
}) => {
  const [value, setValue] = useState(inputDefault || "");
  useEffect(() => {
    setValue(inputDefault || "");
  }, [inputDefault, open]);

  if (!open) return null;

  return (
    <div
      className="modal-container"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal__title">{title}</div>
        <p className="confirm-modal__message">{message}</p>
        {showInput && (
          <div style={{ margin: "8px 0" }}>
            <input
              autoFocus
              className="studio-input"
              placeholder={inputPlaceholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirm && onConfirm(value);
              }}
              aria-label={inputPlaceholder || title}
            />
          </div>
        )}
        <div className="confirm-modal__actions">
          <button onClick={onCancel} className="studio-btn">
            Cancel
          </button>
          <button
            onClick={() => onConfirm && onConfirm(value)}
            className="launch-btn confirm-modal__confirm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
