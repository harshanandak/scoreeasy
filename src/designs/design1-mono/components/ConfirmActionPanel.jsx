import PropTypes from 'prop-types';

export default function ConfirmActionPanel({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  confirmAriaLabel = undefined,
}) {
  return (
    <div
      className="mt-3 p-3"
      style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}
      role="alert"
    >
      <p className="text-sm mb-2" style={{ color: '#991b1b' }}>
        {message}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="mono-btn-primary flex-1"
          style={{ minHeight: 44, background: '#dc2626' }}
          aria-label={confirmAriaLabel}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onCancel}
          className="mono-btn flex-1"
          style={{ minHeight: 44 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

ConfirmActionPanel.propTypes = {
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  confirmAriaLabel: PropTypes.string,
};
