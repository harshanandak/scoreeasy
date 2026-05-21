import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { hasNativePlugin, isNativeMobile } from './platform';

function canUseHaptics() {
  return isNativeMobile() && hasNativePlugin('Haptics');
}

function vibrateFallback(pattern) {
  if (typeof globalThis.navigator?.vibrate !== 'function') return false;
  return Boolean(globalThis.navigator.vibrate(pattern));
}

async function runHaptic(callback, fallbackPattern) {
  if (!canUseHaptics()) return vibrateFallback(fallbackPattern);

  try {
    await callback();
    return true;
  } catch {
    return vibrateFallback(fallbackPattern);
  }
}

export async function scoreImpact() {
  return runHaptic(() => Haptics.impact({ style: ImpactStyle.Light }), 50);
}

export async function correctionImpact() {
  return runHaptic(() => Haptics.impact({ style: ImpactStyle.Medium }), 30);
}

export async function endMatchImpact() {
  return runHaptic(() => Haptics.notification({ type: NotificationType.Success }), [100, 100, 100, 100, 100]);
}

export async function warningImpact() {
  return runHaptic(() => Haptics.notification({ type: NotificationType.Warning }), [80, 80, 80]);
}
