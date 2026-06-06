import { App } from '@capacitor/app';
import { hasNativePlugin, isNativeMobile } from './platform';
import { getSportById } from '../models/sportRegistry';

export function isProtectedScoringRoute(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const [sport, flow] = segments;

  if (!getSportById(sport)) return false;
  return flow === 'quick'
    || (
      flow === 'tournament'
      && segments[3] === 'match'
      && segments[5] === 'score'
    );
}

export function getProtectedScoringBackFallback(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const [sport, flow, tournamentId] = segments;

  if (!getSportById(sport)) return null;
  if (flow === 'quick') return `/play?sport=${encodeURIComponent(sport)}`;
  if (flow === 'tournament' && tournamentId && segments[3] === 'match' && segments[5] === 'score') {
    return `/${encodeURIComponent(sport)}/tournament/${encodeURIComponent(tournamentId)}`;
  }
  if (flow === 'tournament' && segments.some((segment, index) => segment === 'match' && segments[index + 2] === 'score')) {
    return `/${encodeURIComponent(sport)}/tournament`;
  }

  return null;
}

export function installNativeBackButtonGuard({
  getPathname,
  confirmLeave = (message) => Promise.resolve(globalThis.confirm(message)),
  goBack = () => globalThis.history.back(),
  navigateFallback,
  exitApp = () => App.exitApp(),
} = {}) {
  if (!isNativeMobile() || !hasNativePlugin('App')) {
    return () => {};
  }

  let isActive = true;
  let removeNativeListener = () => {};

  App.addListener('backButton', async ({ canGoBack }) => {
    const pathname = getPathname?.() || globalThis.location.pathname;
    const protectedRoute = isProtectedScoringRoute(pathname);

    if (protectedRoute) {
      const leaveConfirmed = await confirmLeave('Leave this page? Your unsaved scoring progress may be lost.');
      if (!leaveConfirmed) {
        return;
      }

      const fallbackPath = getProtectedScoringBackFallback(pathname);
      if (fallbackPath && typeof navigateFallback === 'function') {
        navigateFallback(fallbackPath, { replace: true, unwindProtectedEntry: true });
        return;
      }
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
