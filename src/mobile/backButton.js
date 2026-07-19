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

// When a protected scorer completes, its match lands on the FULL-TIME result
// screen. The active-scoring guard has pushed an extra `gameProtection` history
// entry on top of the scorer entry, so a plain `navigate(result, {replace:true})`
// only replaces that guard entry — the scorer entry stays in the back-stack and
// Back from Result returns the user to the frozen, completed scorer.
//
// Given the guard's history bookkeeping, this resolves how to leave the scorer so
// Result sits directly on the route the user was on BEFORE scoring:
//   - shouldUnwind + backDelta: pop `backDelta` entries (clearing every guard
//     entry AND the scorer entry) back to the pre-scorer route, then push Result;
//   - !shouldUnwind: no recoverable prior route (deep link / no history idx) —
//     the caller should replace the current entry with Result as a best effort.
export function resolveProtectedScoringCompletion({
  currentHistoryIndex,
  baseHistoryIndex,
  guardDepth = 0,
  noPriorRouteIndex = -1,
} = {}) {
  const canUnwind =
    typeof currentHistoryIndex === 'number' &&
    typeof baseHistoryIndex === 'number' &&
    baseHistoryIndex !== noPriorRouteIndex &&
    currentHistoryIndex > baseHistoryIndex;

  if (!canUnwind) {
    return { shouldUnwind: false, backDelta: 0 };
  }

  return {
    shouldUnwind: true,
    backDelta: currentHistoryIndex - baseHistoryIndex + guardDepth,
  };
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
