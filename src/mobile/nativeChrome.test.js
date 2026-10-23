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
  document.documentElement.classList.remove('dark');
  document.documentElement.style.removeProperty('--se-color-canvas');
  vi.clearAllMocks();
  mocks.hasNativePlugin.mockReturnValue(true);
  mocks.hide.mockResolvedValue(undefined);
  mocks.isNativeMobile.mockReturnValue(true);
  mocks.setBackgroundColor.mockResolvedValue(undefined);
  mocks.setStyle.mockResolvedValue(undefined);
});

describe('setupNativeChrome', () => {
  it('uses light status bar icons when the app uses dark chrome', async () => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.setProperty('--se-color-canvas', '#0e0f12');
    await setupNativeChrome();
    expect(mocks.setStyle).toHaveBeenCalledWith({ style: 'DARK' });
    expect(mocks.setBackgroundColor).toHaveBeenCalledWith({ color: '#0e0f12' });
  });
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
