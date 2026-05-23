import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasNativePlugin: vi.fn(),
  hide: vi.fn(),
  isNativeMobile: vi.fn(),
  setBackgroundColor: vi.fn(),
  setStyle: vi.fn(),
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setBackgroundColor: mocks.setBackgroundColor,
    setStyle: mocks.setStyle,
  },
  Style: {
    Dark: 'DARK',
    Light: 'LIGHT',
  },
}));

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: mocks.hide,
  },
}));

vi.mock('./platform', () => ({
  hasNativePlugin: mocks.hasNativePlugin,
  isNativeMobile: mocks.isNativeMobile,
}));

import { setupNativeChrome } from './nativeChrome';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasNativePlugin.mockReturnValue(true);
  mocks.hide.mockResolvedValue(undefined);
  mocks.isNativeMobile.mockReturnValue(true);
  mocks.setBackgroundColor.mockResolvedValue(undefined);
  mocks.setStyle.mockResolvedValue(undefined);
});

describe('setupNativeChrome', () => {
  it('uses dark status bar text on the light native app chrome', async () => {
    await expect(setupNativeChrome()).resolves.toEqual({
      splashScreen: 'hidden',
      statusBar: 'configured',
    });

    expect(mocks.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(mocks.setBackgroundColor).toHaveBeenCalledWith({ color: '#fafafa' });
    expect(mocks.hide).toHaveBeenCalledTimes(1);
  });

  it('skips native chrome setup outside the native app shell', async () => {
    mocks.isNativeMobile.mockReturnValue(false);

    await expect(setupNativeChrome()).resolves.toEqual({
      splashScreen: 'web',
      statusBar: 'web',
    });

    expect(mocks.setStyle).not.toHaveBeenCalled();
    expect(mocks.hide).not.toHaveBeenCalled();
  });
});
