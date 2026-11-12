import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeServiceWorker } from './serviceWorker';

const PRODUCTION = { isNative: false, isPreview: false, isProduction: true };

describe('service worker startup', () => {
  let worker;
  let update;
  let reload;
  let cacheStorage;

  beforeEach(() => {
    update = vi.fn().mockResolvedValue(undefined);
    reload = vi.fn();
    worker = new EventTarget();
    worker.controller = {};
    worker.register = vi.fn().mockResolvedValue({ update });
    worker.getRegistrations = vi.fn().mockResolvedValue([]);
    vi.stubGlobal('navigator', { serviceWorker: worker });
    vi.stubGlobal('location', { hostname: 'scoreeasy.app', reload });
    cacheStorage = { keys: vi.fn().mockResolvedValue(['old-precache']), delete: vi.fn() };
    vi.stubGlobal('caches', cacheStorage);
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('checks for updates on launch without replacing a controller or deleting its chunks', async () => {
    // No retired production reset marker: even a first visit must keep the active precache.
    localStorage.clear();
    const addListener = vi.spyOn(worker, 'addEventListener');
    await initializeServiceWorker(PRODUCTION);
    worker.dispatchEvent(new Event('controllerchange'));

    expect(worker.register).toHaveBeenCalledExactlyOnceWith('/sw.js');
    expect(update).toHaveBeenCalledTimes(1);
    expect(addListener).not.toHaveBeenCalled();
    expect(worker.getRegistrations).not.toHaveBeenCalled();
    expect(cacheStorage.keys).not.toHaveBeenCalled();
    expect(cacheStorage.delete).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('registers once after load when startup is still in progress', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    await initializeServiceWorker(PRODUCTION);
    expect(worker.register).not.toHaveBeenCalled();
    globalThis.dispatchEvent(new Event('load'));
    globalThis.dispatchEvent(new Event('load'));
    await Promise.resolve();
    expect(worker.register).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it.each(['register', 'update'])('ignores an offline %s failure without reloading', async (method) => {
    if (method === 'register') worker.register.mockRejectedValue(new Error('offline'));
    else update.mockRejectedValue(new Error('offline'));
    await initializeServiceWorker(PRODUCTION);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([{ isNative: true }, { isPreview: true }])('cleans retired workers only for %j, without navigating', async (mode) => {
    const unregister = vi.fn().mockResolvedValue(true);
    worker.getRegistrations.mockResolvedValue([{ unregister }]);
    await initializeServiceWorker({ ...PRODUCTION, ...mode });
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(cacheStorage.delete).toHaveBeenCalledExactlyOnceWith('old-precache');
    expect(worker.register).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not register in development or on an unsupported browser', async () => {
    await initializeServiceWorker({ ...PRODUCTION, isProduction: false });
    expect(worker.register).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', {});
    await expect(initializeServiceWorker(PRODUCTION)).resolves.toBeUndefined();
  });
});
