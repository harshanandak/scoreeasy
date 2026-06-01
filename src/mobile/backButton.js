import { App } from '@capacitor/app';
import { hasNativePlugin, isNativeMobile } from './platform';

export function isProtectedScoringRoute(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.includes('quick')
    || segments.some((segment, index) => (
      segment === 'tournament'
      && segments[index + 2] === 'match'
      && segments[index + 4] === 'score'
    ));
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

  App.addListener('backButton', async ({ canGoBack }) => {
    const pathname = getPathname?.() || globalThis.location.pathname;

    if (isProtectedScoringRoute(pathname) && !(await confirmLeave('Leave this page? Your unsaved scoring progress may be lost.'))) {
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
