export const APP_CONFIRM_BLOCKED_KEYS = new Set(['0', '1', '2', '3', '4', '5', '6', 'e', 'p', 'q', 'u', 'w']);

export const APP_CONFIRM_FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function handleAppConfirmKeyDown(event, dialogElement, onCancel) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
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
    event.preventDefault();
    event.stopPropagation();
  }
}
