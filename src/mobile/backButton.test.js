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
    mocks.hasNativePlugin.mockReturnValue(true);
    mocks.isNativeMobile.mockReturnValue(true);

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
});
