import { Share } from '@capacitor/share';
import { hasNativePlugin, isNativeMobile } from './platform';

function getClipboardPayload({ text, url }) {
  return text && url ? `${text}\n${url}` : (text || url);
}

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

  if (globalThis.navigator?.clipboard && (text || url)) {
    try {
      await globalThis.navigator.clipboard.writeText(getClipboardPayload({ text, url }));
      return { shared: true, method: 'clipboard' };
    } catch {
      return { shared: false, method: 'clipboard-failed' };
    }
  }

  return { shared: false, method: 'unsupported' };
}
