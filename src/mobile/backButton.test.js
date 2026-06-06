import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  exitApp: vi.fn(),
  hasNativePlugin: vi.fn(),
  isNativeMobile: vi.fn(),
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.addListener,
    exitApp: mocks.exitApp,
  },
}));

vi.mock('./platform', () => ({
  hasNativePlugin: mocks.hasNativePlugin,
  isNativeMobile: mocks.isNativeMobile,
}));

import {
  getProtectedScoringBackFallback,
  installNativeBackButtonGuard,
  isProtectedScoringRoute,
} from './backButton';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasNativePlugin.mockReturnValue(false);
  mocks.isNativeMobile.mockReturnValue(false);
});

function enableNativeApp() {
  mocks.hasNativePlugin.mockReturnValue(true);
  mocks.isNativeMobile.mockReturnValue(true);
}

async function setupNativeBackHandler({
  confirmResult = false,
  pathname = '/volleyball/quick',
} = {}) {
  enableNativeApp();

  let backButtonHandler;
  mocks.addListener.mockImplementation((eventName, handler) => {
    backButtonHandler = handler;
    return Promise.resolve({ remove: vi.fn() });
  });

  const confirmLeave = vi.fn(() => confirmResult);
  const goBack = vi.fn();
  const exitApp = vi.fn();
  const navigateFallback = vi.fn();

  installNativeBackButtonGuard({
    confirmLeave,
    exitApp,
    getPathname: () => pathname,
    goBack,
    navigateFallback,
  });
  await Promise.resolve();

  return { backButtonHandler, confirmLeave, exitApp, goBack, navigateFallback };
}

describe('isProtectedScoringRoute', () => {
  it('matches tournament scoring routes', () => {
    expect(isProtectedScoringRoute('/volleyball/tournament/123/match/abc/score')).toBe(true);
  });

  it('matches quick match routes', () => {
    expect(isProtectedScoringRoute('/volleyball/quick')).toBe(true);
  });

  it('does not protect game resume recovery routes', () => {
    expect(isProtectedScoringRoute('/game/stale-draft')).toBe(false);
  });

  it('does not match normal navigation routes', () => {
    expect(isProtectedScoringRoute('/play')).toBe(false);
    expect(isProtectedScoringRoute('/history')).toBe(false);
  });

  it('does not match scoring-like route substrings', () => {
    expect(isProtectedScoringRoute('/guides/quickstart')).toBe(false);
    expect(isProtectedScoringRoute('/volleyball/tournament/123/match/abc/scoreboard')).toBe(false);
  });

  it('does not protect non-sport routes with scorer-like segments', () => {
    expect(isProtectedScoringRoute('/profile/quick')).toBe(false);
    expect(isProtectedScoringRoute('/madeupsport/quick')).toBe(false);
  });
});

describe('getProtectedScoringBackFallback', () => {
  it('sends quick-match routes back to the sport-scoped Play chooser', () => {
    expect(getProtectedScoringBackFallback('/cricket/quick')).toBe('/play?sport=cricket');
    expect(getProtectedScoringBackFallback('/tennis/quick/live/match-123')).toBe('/play?sport=tennis');
  });

  it('sends tournament scorer routes back to the tournament dashboard when possible', () => {
    expect(getProtectedScoringBackFallback('/football/tournament/cup-1/match/match-2/score')).toBe('/football/tournament/cup-1');
  });

  it('has no fallback for unprotected routes', () => {
    expect(getProtectedScoringBackFallback('/history')).toBeNull();
    expect(getProtectedScoringBackFallback('/profile/quick')).toBeNull();
    expect(getProtectedScoringBackFallback('/madeupsport/tournament/cup/match/game/score')).toBeNull();
  });
});

describe('installNativeBackButtonGuard', () => {
  it('removes the native listener when cleanup runs before listener registration resolves', async () => {
    enableNativeApp();

    const remove = vi.fn();
    let resolveAddListener;
    mocks.addListener.mockReturnValue(new Promise((resolve) => {
      resolveAddListener = resolve;
    }));

    const cleanup = installNativeBackButtonGuard({
      getPathname: () => '/play',
    });

    cleanup();
    resolveAddListener({ remove });
    await Promise.resolve();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('guards protected routes before native history navigation', async () => {
    const { backButtonHandler, confirmLeave, exitApp, goBack } = await setupNativeBackHandler();

    await backButtonHandler({ canGoBack: true });

    expect(confirmLeave).toHaveBeenCalledWith('Leave this page? Your unsaved scoring progress may be lost.');
    expect(goBack).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('uses the scoring fallback from protected routes after confirmation', async () => {
    const { backButtonHandler, confirmLeave, exitApp, goBack, navigateFallback } = await setupNativeBackHandler({
      confirmResult: true,
      pathname: '/cricket/quick/test-match/match-123',
    });

    await backButtonHandler({ canGoBack: true });

    expect(confirmLeave).toHaveBeenCalledWith('Leave this page? Your unsaved scoring progress may be lost.');
    expect(navigateFallback).toHaveBeenCalledWith('/play?sport=cricket', { replace: true });
    expect(goBack).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('does not exit the native app from direct-entry protected routes after confirmation', async () => {
    const { backButtonHandler, exitApp, goBack, navigateFallback } = await setupNativeBackHandler({
      confirmResult: true,
      pathname: '/football/tournament/cup-1/match/match-2/score',
    });

    await backButtonHandler({ canGoBack: false });

    expect(navigateFallback).toHaveBeenCalledWith('/football/tournament/cup-1', { replace: true });
    expect(goBack).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('navigates back immediately from unprotected routes', async () => {
    const { backButtonHandler, confirmLeave, exitApp, goBack } = await setupNativeBackHandler({
      pathname: '/history',
    });

    await backButtonHandler({ canGoBack: true });

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('guards protected routes before exiting the native app', async () => {
    const { backButtonHandler, confirmLeave, exitApp, goBack } = await setupNativeBackHandler();

    await backButtonHandler({ canGoBack: false });

    expect(confirmLeave).toHaveBeenCalledWith('Leave this page? Your unsaved scoring progress may be lost.');
    expect(goBack).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('handles native listener registration failures', async () => {
    enableNativeApp();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('listener failed');
    mocks.addListener.mockRejectedValue(error);

    const cleanup = installNativeBackButtonGuard({
      getPathname: () => '/play',
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    cleanup();

    expect(warn).toHaveBeenCalledWith('Failed to register native backButton listener', error);
  });
});
