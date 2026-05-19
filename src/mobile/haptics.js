import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { hasNativePlugin, isNativeMobile } from './platform';

function canUseHaptics() {
  return isNativeMobile() && hasNativePlugin('Haptics');
}

async function runHaptic(callback) {
  if (!canUseHaptics()) return false;

  try {
    await callback();
    return true;
  } catch {
    return false;
  }
}

export async function scoreImpact() {
  return runHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
}

export async function correctionImpact() {
  return runHaptic(() => Haptics.impact({ style: ImpactStyle.Medium }));
}

export async function endMatchImpact() {
  return runHaptic(() => Haptics.notification({ type: NotificationType.Success }));
}

export async function warningImpact() {
  return runHaptic(() => Haptics.notification({ type: NotificationType.Warning }));
}
