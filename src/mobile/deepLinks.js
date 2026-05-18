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

export function installNativeDeepLinkHandler({ beforeNavigate, navigate, onUnhandled } = {}) {
  if (!isNativeMobile() || !hasNativePlugin('App') || typeof navigate !== 'function') {
    return () => {};
  }

  let removed = false;
  let listener;

  const handleUrl = async (url) => {
    if (typeof url !== 'string' || url.length === 0) return;

    const path = pathFromAppUrl(url);
    if (!path) {
      if (typeof onUnhandled === 'function') onUnhandled(url);
      return;
    }

    if (typeof beforeNavigate === 'function') {
      const shouldNavigate = await beforeNavigate(path);
      if (shouldNavigate === false) return;
    }

    navigate(path, { replace: false });
  };

  App.getLaunchUrl()
    .then((launchUrl) => {
      void handleUrl(launchUrl?.url);
    })
    .catch((error) => {
      console.warn('Failed to read native launch URL', error);
    });

  App.addListener('appUrlOpen', (event) => {
    void handleUrl(event?.url);
  })
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
