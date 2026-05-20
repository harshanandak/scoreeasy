import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';

export function AppScoringNotice({ message, tone = 'success', onDismiss = null }) {
  if (!message) return null;

  const isWarning = tone === 'warning';
  return (
    <div
      role={isWarning ? 'alert' : 'status'}
      className="mono-card mb-4 flex items-center justify-between gap-3"
      style={{
        padding: '12px 14px',
        background: isWarning ? '#fff7ed' : '#f0fdf4',
        borderColor: isWarning ? '#fed7aa' : '#bbf7d0',
      }}
    >
      <p className="text-sm" style={{ color: isWarning ? '#9a3412' : '#166534' }}>
        {message}
      </p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="mono-btn" style={{ padding: '6px 10px', minHeight: 34 }}>
          OK
        </button>
      )}
    </div>
  );
}

export function AppScoringConfirmDialog({
  cancelLabel = 'Cancel',
  confirmLabel,
  message,
  onCancel,
  onConfirm,
  title,
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!title || !message) return undefined;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [message, onCancel, title]);

  if (!title || !message) return null;

  return (
    <div className="app-confirm-backdrop" role="presentation">
      <button type="button" className="app-confirm-backdrop-button" aria-label="Cancel prompt" onClick={onCancel} />
      <section
        className="app-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scoring-confirm-title"
        aria-describedby="scoring-confirm-message"
      >
        <p className="app-confirm-eyebrow">Match control</p>
        <h2 id="scoring-confirm-title" className="app-confirm-title">{title}</h2>
        <p id="scoring-confirm-message" className="app-confirm-message">{message}</p>
        <div className="app-confirm-actions">
          <button type="button" ref={cancelButtonRef} onClick={onCancel} className="app-confirm-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="app-confirm-primary">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

AppScoringNotice.propTypes = {
  message: PropTypes.string,
  tone: PropTypes.oneOf(['success', 'warning']),
  onDismiss: PropTypes.func,
};

AppScoringConfirmDialog.propTypes = {
  cancelLabel: PropTypes.string,
  confirmLabel: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};
