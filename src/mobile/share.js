import { Share } from '@capacitor/share';
import { hasNativePlugin, isNativeMobile } from './platform';

export async function shareText({ title = 'Score Easy', text, url, dialogTitle = 'Share score' }) {
  if (!text && !url) return { shared: false, method: 'empty' };

  if (isNativeMobile() && hasNativePlugin('Share')) {
    try {
      await Share.share({ title, text, url, dialogTitle });
      return { shared: true, method: 'native' };
    } catch {
      return { shared: false, method: 'native-failed' };
    }
  }

  if (globalThis.navigator?.share) {
    try {
      await globalThis.navigator.share({ title, text, url });
      return { shared: true, method: 'web-share' };
    } catch {
      return { shared: false, method: 'web-share-failed' };
    }
  }

  if (globalThis.navigator?.clipboard && text) {
    await globalThis.navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return { shared: true, method: 'clipboard' };
  }

  return { shared: false, method: 'unsupported' };
}
