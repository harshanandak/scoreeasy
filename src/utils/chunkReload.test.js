import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RELOAD_GUARD_MS,
  CHUNK_RELOAD_KEY,
  installChunkReloadHandler,
  isChunkLoadError,
  reloadOnceForNewVersion,
} from './chunkReload';

describe('isChunkLoadError', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: https://x/assets/a-1.js'),
    new TypeError('Importing a module script failed.'),
    new Error('error loading dynamically imported module'),
    Object.assign(new Error('Loading chunk 7 failed.'), { name: 'ChunkLoadError' }),
  ])('recognises %s', (error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([new Error('Cannot read properties of undefined'), null, undefined, 'nope'])(
    'ignores %s',
    (error) => {
      expect(isChunkLoadError(error)).toBe(false);
    },
  );
});

describe('reloadOnceForNewVersion', () => {
  let reload;

  beforeEach(() => {
    reload = vi.fn();
    vi.stubGlobal('location', { ...globalThis.location, reload });
    globalThis.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reloads the first time and records a timestamp', () => {
    expect(reloadOnceForNewVersion(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1000000');
  });

  it('refuses a second reload inside the guard window, so it can never loop', () => {
    expect(reloadOnceForNewVersion(1_000_000)).toBe(true);
    expect(reloadOnceForNewVersion(1_000_000 + CHUNK_RELOAD_GUARD_MS - 1)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows a reload again after the window', () => {
    reloadOnceForNewVersion(1_000_000);
    expect(reloadOnceForNewVersion(1_000_000 + CHUNK_RELOAD_GUARD_MS + 1)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload when it cannot record the guard', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(reloadOnceForNewVersion(1_000_000)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('installChunkReloadHandler', () => {
  let reload;
  let remove;

  beforeEach(() => {
    reload = vi.fn();
    vi.stubGlobal('location', { ...globalThis.location, reload });
    globalThis.sessionStorage.clear();
    remove = installChunkReloadHandler();
  });

  afterEach(() => {
    remove();
    vi.unstubAllGlobals();
  });

  it('reloads on vite:preloadError and calls preventDefault', () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    globalThis.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lets the error through when a reload just happened', () => {
    globalThis.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    const second = new Event('vite:preloadError', { cancelable: true });
    globalThis.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
