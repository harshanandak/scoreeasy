import { App } from '@capacitor/app';
import { hasNativePlugin, isNativeMobile } from './platform';

export function isProtectedScoringRoute(pathname) {
  return pathname.includes('/game/')
    || pathname.includes('/quick')
    || (pathname.includes('/tournament/') && pathname.includes('/match/') && pathname.includes('/score'));
}

export function installNativeBackButtonGuard({
  getPathname,
  confirmLeave = globalThis.confirm,
  goBack = () => globalThis.history.back(),
  exitApp = () => App.exitApp(),
} = {}) {
  if (!isNativeMobile() || !hasNativePlugin('App')) {
    return () => {};
  }

  let isActive = true;
  let removeNativeListener = () => {};

  App.addListener('backButton', ({ canGoBack }) => {
    const pathname = getPathname?.() || globalThis.location.pathname;

    if (isProtectedScoringRoute(pathname) && !confirmLeave('Leave this page? Your unsaved scoring progress may be lost.')) {
      return;
    }

    if (canGoBack) {
      goBack();
      return;
    }

    exitApp();
  }).then((handle) => {
    if (!isActive) {
      handle.remove();
      return;
    }

    removeNativeListener = () => {
      handle.remove();
    };
  }).catch((error) => {
    console.warn('Failed to register native backButton listener', error);
  });

  return () => {
    isActive = false;
    removeNativeListener();
  };
}
