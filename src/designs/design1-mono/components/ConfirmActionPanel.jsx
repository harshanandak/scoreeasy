import PropTypes from 'prop-types';

// Inline destructive confirm (clear a score, delete a tournament). Shares the
// hard-shell confirm classes in mono.css with the app dialogs.
export default function ConfirmActionPanel({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  confirmAriaLabel = undefined,
}) {
  return (
    <div className="app-confirm-panel mt-3 p-3" role="alert">
      <p className="app-confirm-panel-message text-sm mb-3">
        {message}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="app-confirm-primary app-confirm-danger flex-1"
          aria-label={confirmAriaLabel}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="app-confirm-secondary flex-1"
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
