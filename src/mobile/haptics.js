import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { hasNativePlugin, isNativeMobile } from './platform';

export async function scoreImpact() {
  if (!isNativeMobile() || !hasNativePlugin('Haptics')) return false;

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
    return true;
  } catch {
    return false;
  }
}
