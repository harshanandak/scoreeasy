import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { handleAppConfirmKeyDown } from './appConfirmUtils';

const DEFAULT_DRAFT_SAVED_MESSAGE = 'Draft saved. You can resume this match later.';

export function useAppScoringPrompt() {
  const [notice, setNotice] = useState(null);
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [draftRedirectPending, setDraftRedirectPending] = useState(false);
  const draftRedirectTimeoutRef = useRef(null);

  const clearDraftRedirect = useCallback((resetPending = true) => {
    if (draftRedirectTimeoutRef.current) {
      globalThis.clearTimeout(draftRedirectTimeoutRef.current);
      draftRedirectTimeoutRef.current = null;
    }
    if (resetPending) setDraftRedirectPending(false);
  }, []);

  const scheduleDraftRedirect = useCallback((navigateAfterSave, message = DEFAULT_DRAFT_SAVED_MESSAGE) => {
    clearDraftRedirect();
    setNotice({ message, tone: 'success' });
    setDraftRedirectPending(true);
    draftRedirectTimeoutRef.current = globalThis.setTimeout(() => {
      draftRedirectTimeoutRef.current = null;
      setDraftRedirectPending(false);
      navigateAfterSave();
    }, 450);
  }, [clearDraftRedirect]);

  useEffect(() => () => clearDraftRedirect(false), [clearDraftRedirect]);

  const closeNotice = useCallback(() => setNotice(null), []);
  const closePrompt = useCallback(() => setPendingPrompt(null), []);

  const requestDiscardPrompt = useCallback(() => {
    setPendingPrompt({
      cancelLabel: 'Keep scoring',
      confirmLabel: 'Discard',
      message: 'Your unsaved scoring changes will be lost.',
      tone: 'danger',
      title: 'Discard changes?',
      type: 'discard',
    });
  }, []);

  const cancelOrNavigate = useCallback((hasChanges, navigateBack) => {
    if (hasChanges) {
      requestDiscardPrompt();
      return;
    }
    navigateBack();
  }, [requestDiscardPrompt]);

  const confirmDiscard = useCallback((navigateBack) => {
    if (pendingPrompt?.type !== 'discard') return;
    closePrompt();
    navigateBack();
  }, [closePrompt, pendingPrompt]);

  const renderPrompt = useCallback((onConfirmPrompt) => (
    <AppScoringPromptHost
      notice={notice}
      onCancelPrompt={closePrompt}
      onConfirmPrompt={onConfirmPrompt}
      onDismissNotice={closeNotice}
      pendingPrompt={pendingPrompt}
    />
  ), [closeNotice, closePrompt, notice, pendingPrompt]);

  const requestPrompt = useCallback((prompt) => setPendingPrompt(prompt), []);
  const showWarning = useCallback((message) => setNotice({ message, tone: 'warning' }), []);

  return {
    cancelOrNavigate,
    closeNotice,
    closePrompt,
    confirmDiscard,
    isInteractionLocked: Boolean(pendingPrompt || draftRedirectPending),
    notice,
    pendingPrompt,
    renderPrompt,
    requestDiscardPrompt,
    requestPrompt,
    scheduleDraftRedirect,
    showWarning,
  };
}

export function AppScoringNotice({ message, tone = 'success', onDismiss = null }) {
  if (!message) return null;

  const isWarning = tone === 'warning';
  return (
    <div
      role={isWarning ? 'alert' : 'status'}
      aria-live={isWarning ? 'assertive' : 'polite'}
      className={`app-scoring-notice ${isWarning ? 'app-scoring-notice-warning' : 'app-scoring-notice-success'}`}
    >
      <div className="app-scoring-notice-copy">
        <span className="app-scoring-notice-label">{isWarning ? 'Needs attention' : 'Saved locally'}</span>
        <p className="app-scoring-notice-message">{message}</p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="app-scoring-notice-action">
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
  tone = 'primary',
  title,
}) {
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const wasOpenRef = useRef(false);
  const isOpen = Boolean(title && message);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return undefined;
    }

    if (!wasOpenRef.current) {
      cancelButtonRef.current?.focus();
      wasOpenRef.current = true;
    }

    const handleKeyDown = (event) => handleAppConfirmKeyDown(event, dialogRef.current, onCancel);

    globalThis.addEventListener('keydown', handleKeyDown, true);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="app-confirm-backdrop" role="presentation">
      <button type="button" className="app-confirm-backdrop-button" aria-label="Cancel prompt" onClick={onCancel} tabIndex={-1} />
      <section
        className="app-confirm-dialog"
        ref={dialogRef}
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
          <button type="button" onClick={onConfirm} className={`app-confirm-primary${tone === 'danger' ? ' app-confirm-danger' : ''}`}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function AppScoringPromptHost({
  notice,
  onCancelPrompt,
  onConfirmPrompt,
  onDismissNotice,
  pendingPrompt,
}) {
  return (
    <>
      <AppScoringNotice
        message={notice?.message}
        tone={notice?.tone}
        onDismiss={onDismissNotice}
      />
      {pendingPrompt && (
        <AppScoringConfirmDialog
          cancelLabel={pendingPrompt.cancelLabel}
          confirmLabel={pendingPrompt.confirmLabel}
          message={pendingPrompt.message}
          onCancel={onCancelPrompt}
          onConfirm={onConfirmPrompt}
          tone={pendingPrompt.tone}
          title={pendingPrompt.title}
        />
      )}
    </>
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
  tone: PropTypes.oneOf(['primary', 'danger']),
  title: PropTypes.string.isRequired,
};

AppScoringPromptHost.propTypes = {
  notice: PropTypes.shape({
    message: PropTypes.string,
    tone: PropTypes.oneOf(['success', 'warning']),
  }),
  onCancelPrompt: PropTypes.func.isRequired,
  onConfirmPrompt: PropTypes.func.isRequired,
  onDismissNotice: PropTypes.func.isRequired,
  pendingPrompt: PropTypes.shape({
    cancelLabel: PropTypes.string,
    confirmLabel: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    tone: PropTypes.oneOf(['primary', 'danger']),
    title: PropTypes.string.isRequired,
    type: PropTypes.string,
  }),
};
