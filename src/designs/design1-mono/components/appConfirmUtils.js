export const APP_CONFIRM_BLOCKED_KEYS = new Set(['0', '1', '2', '3', '4', '5', '6', 'e', 'p', 'q', 'u', 'w']);

export const APP_CONFIRM_FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Shared modal-surface selector. The MonoSheet bottom-sheet primitive reuses the
// app-confirm focus-trap machinery, so both surfaces must qualify as "topmost"
// modals for stacking-aware Escape/Tab handling.
export const APP_MODAL_SURFACE_SELECTOR = '.app-confirm-dialog, .mono-sheet';

export function isTopmostModalSurface(surfaceElement, selector = APP_MODAL_SURFACE_SELECTOR) {
  if (!surfaceElement?.isConnected) return false;

  const surfaces = [...document.querySelectorAll(selector)];
  return surfaces[surfaces.length - 1] === surfaceElement;
}

export function isTopmostAppConfirmDialog(dialogElement) {
  return isTopmostModalSurface(dialogElement);
}

export function getTrappableControls(container) {
  const focusable = container?.querySelectorAll(APP_CONFIRM_FOCUSABLE_SELECTOR);
  return [...(focusable || [])].filter((control) => !control.disabled);
}

// Cycles Tab / Shift+Tab focus inside a modal container. Shared by the app-confirm
// dialog and the MonoSheet primitive so both share identical focus-trap parity.
export function handleModalTabTrap(event, container) {
  if (event.key !== 'Tab') return;

  const controls = getTrappableControls(container);
  if (controls.length === 0) return;

  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function consumeAppConfirmKey(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

export function handleAppConfirmKeyDown(event, dialogElement, onCancel) {
  if (!isTopmostAppConfirmDialog(dialogElement)) return;

  if (event.key === 'Escape') {
    consumeAppConfirmKey(event);
    onCancel();
    return;
  }

  if (event.key === 'Tab') {
    handleModalTabTrap(event, dialogElement);
    return;
  }

  const hasBrowserModifier = event.altKey || event.ctrlKey || event.metaKey;
  if (!hasBrowserModifier && APP_CONFIRM_BLOCKED_KEYS.has(event.key.toLowerCase())) {
    consumeAppConfirmKey(event);
  }
}
