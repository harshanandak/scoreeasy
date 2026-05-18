import { App } from '@capacitor/app';
import { hasNativePlugin, isNativeMobile } from './platform';

export const APP_LINK_HOST = 'scoreeasy.app';

export function pathFromAppUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== APP_LINK_HOST) return null;

    return `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
  } catch {
    return null;
  }
}

export function installNativeDeepLinkHandler({ navigate, onUnhandled } = {}) {
  if (!isNativeMobile() || !hasNativePlugin('App') || typeof navigate !== 'function') {
    return () => {};
  }

  let removed = false;
  let listener;

  const handleUrl = (url) => {
    const path = pathFromAppUrl(url);
    if (!path) {
      if (typeof onUnhandled === 'function') onUnhandled(url);
      return;
    }

    navigate(path, { replace: false });
  };

  App.getLaunchUrl()
    .then((launchUrl) => handleUrl(launchUrl?.url))
    .catch((error) => {
      console.warn('Failed to read native launch URL', error);
    });

  App.addListener('appUrlOpen', (event) => handleUrl(event?.url))
    .then((registration) => {
      listener = registration;
      if (removed) listener?.remove?.();
    })
    .catch((error) => {
      console.warn('Failed to register native appUrlOpen listener', error);
    });

  return () => {
    removed = true;
    listener?.remove?.();
  };
}
