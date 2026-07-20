import PropTypes from 'prop-types';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getTrappableControls, handleModalTabTrap, isTopmostModalSurface } from './appConfirmUtils';

const actionShape = PropTypes.shape({
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  tone: PropTypes.oneOf(['primary', 'danger']),
});

// Ref-counted body scroll-lock shared across every open MonoSheet. Saving and
// restoring document.body.style.overflow per-sheet is not concurrency-safe:
// when two sheets close in the same render, the later one restores the earlier
// one's already-locked 'hidden' value and the lock leaks. Instead the first
// sheet to open captures the real previous overflow and only the last sheet to
// close restores it.
let sheetScrollLockCount = 0;
let sheetScrollLockPreviousOverflow = '';

function acquireBodyScrollLock() {
  if (sheetScrollLockCount === 0) {
    sheetScrollLockPreviousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  sheetScrollLockCount += 1;
}

function releaseBodyScrollLock() {
  if (sheetScrollLockCount === 0) return;
  sheetScrollLockCount -= 1;
  if (sheetScrollLockCount === 0) {
    document.body.style.overflow = sheetScrollLockPreviousOverflow;
  }
}

/**
 * MonoSheet — the shared bottom-sheet host for the mono design.
 *
 * A slide-up modal sheet rendered in a portal: brutalist frame (hard hairline top
 * border + hard offset shadow) with HiFi soft top radii and a grab-handle
 * affordance. Backdrop tap and Escape dismiss, focus is trapped and returned to
 * the trigger, body scroll is locked while open, and the slide-up animation is
 * neutralized under reduced-motion (see mono.css). Consumers own the content and
 * an optional Skip/Confirm action row.
 */
export default function MonoSheet({
  open,
  onClose,
  title = undefined,
  ariaLabel = undefined,
  children = null,
  primaryAction = null,
  secondaryAction = null,
}) {
  const sheetRef = useRef(null);
  const triggerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    acquireBodyScrollLock();

    triggerRef.current = document.activeElement;
    const [firstControl] = getTrappableControls(sheetRef.current);
    (firstControl || sheetRef.current)?.focus?.();

    // Capture phase (runs before the event reaches any control): own Escape and
    // Tab. These are the sheet's, not the content's — close and focus-trap — so
    // we consume them here and stop them reaching the scorer behind the sheet.
    const handleKeyDownCapture = (event) => {
      if (!isTopmostModalSurface(sheetRef.current)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab') {
        handleModalTabTrap(event, sheetRef.current);
        event.stopPropagation();
      }
      // Every other key is intentionally left to flow through the full
      // capture -> target -> bubble path so the focused control and React's
      // delegated onKeyDown handlers inside the sheet still receive it. The
      // leak to the scorer is closed in the bubble phase below.
    };

    // Bubble phase on document — which sits between the sheet content and the
    // window. Scorers listen on window in the bubble phase, so by the time the
    // event reaches document it has already been delivered to the focused
    // control and React's handlers; stopping it here blocks the scorer's global
    // hotkeys (q/p/u/w/e, number keys) without swallowing the sheet's own
    // keyboard-driven controls. Scorers listen on keydown only.
    const handleKeyDownBubble = (event) => {
      if (!isTopmostModalSurface(sheetRef.current)) return;
      event.stopPropagation();
    };

    globalThis.addEventListener('keydown', handleKeyDownCapture, true);
    document.addEventListener('keydown', handleKeyDownBubble);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDownCapture, true);
      document.removeEventListener('keydown', handleKeyDownBubble);
      releaseBodyScrollLock();
      const trigger = triggerRef.current;
      triggerRef.current = null;
      trigger?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const labelledBy = title ? titleId : undefined;
  const accessibleLabel = title ? undefined : (ariaLabel || 'Sheet');

  return createPortal(
    <div className="mono-sheet-backdrop" role="presentation">
      <button
        type="button"
        className="mono-sheet-backdrop-button"
        aria-label="Close sheet"
        onClick={() => onCloseRef.current()}
        tabIndex={-1}
      />
      <section
        ref={sheetRef}
        className="mono-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={accessibleLabel}
        tabIndex={-1}
      >
        <span className="mono-sheet-handle" aria-hidden="true" />
        {title && (
          <h2 id={titleId} className="mono-sheet-title">
            {title}
          </h2>
        )}
        <div className="mono-sheet-body">{children}</div>
        {(primaryAction || secondaryAction) && (
          <div className="mono-sheet-actions">
            {secondaryAction && (
              <button
                type="button"
                className="mono-sheet-secondary"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </button>
            )}
            {primaryAction && (
              <button
                type="button"
                className={`mono-sheet-primary${primaryAction.tone === 'danger' ? ' mono-sheet-danger' : ''}`}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </button>
            )}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

MonoSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  ariaLabel: PropTypes.string,
  children: PropTypes.node,
  primaryAction: actionShape,
  secondaryAction: actionShape,
};
