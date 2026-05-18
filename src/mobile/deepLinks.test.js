import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  hasNativePlugin: vi.fn(),
  isNativeMobile: vi.fn(),
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocks.addListener,
    getLaunchUrl: mocks.getLaunchUrl,
  },
}));

vi.mock('./platform', () => ({
  hasNativePlugin: mocks.hasNativePlugin,
  isNativeMobile: mocks.isNativeMobile,
}));

import { installNativeDeepLinkHandler, pathFromAppUrl } from './deepLinks';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addListener.mockResolvedValue({ remove: vi.fn() });
  mocks.getLaunchUrl.mockResolvedValue(null);
  mocks.hasNativePlugin.mockReturnValue(false);
  mocks.isNativeMobile.mockReturnValue(false);
});

function enableNativeApp() {
  mocks.hasNativePlugin.mockReturnValue(true);
  mocks.isNativeMobile.mockReturnValue(true);
}

describe('pathFromAppUrl', () => {
  it('returns the internal app path from a scoreeasy app link', () => {
    expect(pathFromAppUrl('https://scoreeasy.app/play?tab=team#top')).toBe('/play?tab=team#top');
  });

  it('ignores unsupported hosts and schemes', () => {
    expect(pathFromAppUrl('https://example.com/play')).toBeNull();
    expect(pathFromAppUrl('scoreeasy://play')).toBeNull();
    expect(pathFromAppUrl('not-a-url')).toBeNull();
  });
});

describe('installNativeDeepLinkHandler', () => {
  it('does not register listeners outside the native app shell', () => {
    const cleanup = installNativeDeepLinkHandler({ navigate: vi.fn() });
    cleanup();

    expect(mocks.addListener).not.toHaveBeenCalled();
    expect(mocks.getLaunchUrl).not.toHaveBeenCalled();
  });

  it('navigates to a cold-launch app link', async () => {
    enableNativeApp();
    mocks.getLaunchUrl.mockResolvedValue({ url: 'https://scoreeasy.app/history' });
    const navigate = vi.fn();

    installNativeDeepLinkHandler({ navigate });
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith('/history', { replace: false });
  });

  it('ignores cold launches without a URL', async () => {
    enableNativeApp();
    mocks.getLaunchUrl.mockResolvedValue(null);
    const navigate = vi.fn();
    const onUnhandled = vi.fn();

    installNativeDeepLinkHandler({ navigate, onUnhandled });
    await Promise.resolve();

    expect(navigate).not.toHaveBeenCalled();
    expect(onUnhandled).not.toHaveBeenCalled();
  });

  it('navigates to runtime appUrlOpen events', async () => {
    enableNativeApp();
    let handler;
    mocks.addListener.mockImplementation((eventName, callback) => {
      handler = callback;
      return Promise.resolve({ remove: vi.fn() });
    });
    const navigate = vi.fn();

    installNativeDeepLinkHandler({ navigate });
    await Promise.resolve();
    handler({ url: 'https://scoreeasy.app/play' });

    expect(mocks.addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function));
    expect(navigate).toHaveBeenCalledWith('/play', { replace: false });
  });

  it('lets the app block navigation before opening a deep link', async () => {
    enableNativeApp();
    let handler;
    mocks.addListener.mockImplementation((eventName, callback) => {
      handler = callback;
      return Promise.resolve({ remove: vi.fn() });
    });
    const beforeNavigate = vi.fn(() => false);
    const navigate = vi.fn();

    installNativeDeepLinkHandler({ beforeNavigate, navigate });
    await Promise.resolve();
    handler({ url: 'https://scoreeasy.app/play' });
    await Promise.resolve();

    expect(beforeNavigate).toHaveBeenCalledWith('/play');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports unsupported URLs without navigating', async () => {
    enableNativeApp();
    let handler;
    mocks.addListener.mockImplementation((eventName, callback) => {
      handler = callback;
      return Promise.resolve({ remove: vi.fn() });
    });
    const navigate = vi.fn();
    const onUnhandled = vi.fn();

    installNativeDeepLinkHandler({ navigate, onUnhandled });
    await Promise.resolve();
    handler({ url: 'https://example.com/play' });

    expect(navigate).not.toHaveBeenCalled();
    expect(onUnhandled).toHaveBeenCalledWith('https://example.com/play');
  });

  it('removes the appUrlOpen listener even if cleanup runs before registration resolves', async () => {
    enableNativeApp();
    const remove = vi.fn();
    let resolveAddListener;
    mocks.addListener.mockReturnValue(new Promise((resolve) => {
      resolveAddListener = resolve;
    }));

    const cleanup = installNativeDeepLinkHandler({ navigate: vi.fn() });
    cleanup();
    resolveAddListener({ remove });
    await Promise.resolve();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
