import PropTypes from 'prop-types';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getTrappableControls, handleModalTabTrap, isTopmostModalSurface } from './appConfirmUtils';

const actionShape = PropTypes.shape({
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  tone: PropTypes.oneOf(['primary', 'danger']),
});

// Keys that must reach controls inside the sheet: Enter/Space activate the
// focused control. (Escape/Tab are handled explicitly before this check.)
const SHEET_ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar']);

// True when the key press belongs to an editable field inside the sheet, so
// typing is never swallowed by the propagation guard.
function isEditableTarget(target) {
  if (!target || typeof target.tagName !== 'string') return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    triggerRef.current = document.activeElement;
    const [firstControl] = getTrappableControls(sheetRef.current);
    (firstControl || sheetRef.current)?.focus?.();

    const handleKeyDown = (event) => {
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
        return;
      }

      // Everything else: let controls inside the sheet receive the keys they
      // actually need (typing in fields, Enter/Space activating the focused
      // control), and stop every other key here in the capture phase so global
      // scorer hotkeys (q/p/u/w/e, number keys) can't mutate the match behind
      // the open sheet. Scorers listen on keydown only, so keydown is enough.
      const { target } = event;
      const sheetNeedsKey =
        sheetRef.current?.contains(target) &&
        (isEditableTarget(target) || SHEET_ACTIVATION_KEYS.has(event.key));
      if (sheetNeedsKey) return;

      event.stopPropagation();
    };

    globalThis.addEventListener('keydown', handleKeyDown, true);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
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
