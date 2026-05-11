import { App } from '@capacitor/app';
import { hasNativePlugin, isNativeMobile } from './platform';

export function isProtectedScoringRoute(pathname) {
  return /\/(?:game\/|.*\/tournament\/\d+\/match\/.*\/score|.*\/quick)/.test(pathname);
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

  void App.addListener('backButton', ({ canGoBack }) => {
    const pathname = getPathname?.() || globalThis.location.pathname;

    if (canGoBack) {
      goBack();
      return;
    }

    if (isProtectedScoringRoute(pathname) && !confirmLeave('Leave this page? Your unsaved scoring progress may be lost.')) {
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
  });

  return () => {
    isActive = false;
    removeNativeListener();
  };
}
