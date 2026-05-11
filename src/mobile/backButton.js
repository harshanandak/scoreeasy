import { App } from '@capacitor/app';
import { hasNativePlugin, isNativeMobile } from './platform';

export function isProtectedScoringRoute(pathname) {
  return /\/(?:game\/|.*\/tournament\/\d+\/match\/.*\/score|.*\/quick)/.test(pathname);
}

export async function installNativeBackButtonGuard({
  getPathname,
  confirmLeave = globalThis.confirm,
  goBack = () => globalThis.history.back(),
  exitApp = () => App.exitApp(),
} = {}) {
  if (!isNativeMobile() || !hasNativePlugin('App')) {
    return () => {};
  }

  const handle = await App.addListener('backButton', ({ canGoBack }) => {
    const pathname = getPathname?.() || globalThis.location.pathname;

    if (isProtectedScoringRoute(pathname) && !confirmLeave('Leave this page? Your unsaved scoring progress may be lost.')) {
      return;
    }

    if (canGoBack) {
      goBack();
      return;
    }

    exitApp();
  });

  return () => {
    handle.remove();
  };
}
