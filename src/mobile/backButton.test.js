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

import { installNativeBackButtonGuard, isProtectedScoringRoute } from './backButton';

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

  installNativeBackButtonGuard({
    confirmLeave,
    exitApp,
    getPathname: () => pathname,
    goBack,
  });
  await Promise.resolve();

  return { backButtonHandler, confirmLeave, exitApp, goBack };
}

describe('isProtectedScoringRoute', () => {
  it('matches tournament scoring routes', () => {
    expect(isProtectedScoringRoute('/volleyball/tournament/123/match/abc/score')).toBe(true);
  });

  it('matches quick match routes', () => {
    expect(isProtectedScoringRoute('/volleyball/quick')).toBe(true);
  });

  it('does not match normal navigation routes', () => {
    expect(isProtectedScoringRoute('/play')).toBe(false);
    expect(isProtectedScoringRoute('/history')).toBe(false);
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

  it('lets browser popstate guard protected routes during native history navigation', async () => {
    const { backButtonHandler, confirmLeave, exitApp, goBack } = await setupNativeBackHandler();

    backButtonHandler({ canGoBack: true });

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('navigates back from protected routes after confirmation', async () => {
    const { backButtonHandler, confirmLeave, exitApp, goBack } = await setupNativeBackHandler({
      confirmResult: true,
    });

    backButtonHandler({ canGoBack: true });

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('guards protected routes before exiting the native app', async () => {
    const { backButtonHandler, confirmLeave, exitApp, goBack } = await setupNativeBackHandler();

    backButtonHandler({ canGoBack: false });

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
