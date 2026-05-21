export const APP_CONFIRM_BLOCKED_KEYS = new Set(['0', '1', '2', '3', '4', '5', '6', 'e', 'p', 'q', 'u', 'w']);

export const APP_CONFIRM_FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function isTopmostAppConfirmDialog(dialogElement) {
  if (!dialogElement?.isConnected) return false;

  const dialogs = [...document.querySelectorAll('.app-confirm-dialog')];
  return dialogs[dialogs.length - 1] === dialogElement;
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
    const focusable = dialogElement?.querySelectorAll(APP_CONFIRM_FOCUSABLE_SELECTOR);
    const controls = [...(focusable || [])].filter((control) => !control.disabled);
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
      return;
    }
  }

  const hasBrowserModifier = event.altKey || event.ctrlKey || event.metaKey;
  if (!hasBrowserModifier && APP_CONFIRM_BLOCKED_KEYS.has(event.key.toLowerCase())) {
    consumeAppConfirmKey(event);
  }
}
