import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RELOAD_KEY,
  clearChunkReloadAttempt,
  installChunkReloadHandler,
  isChunkLoadError,
  reloadOnceForNewVersion,
} from './chunkReload';
import { markSaveFailed, markSaveOk, resetSaveHealth } from './saveHealth';

describe('isChunkLoadError', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: https://x/assets/a-1.js'),
    new TypeError('Importing a module script failed.'),
    new Error('error loading dynamically imported module'),
    Object.assign(new Error('Loading chunk 7 failed.'), { name: 'ChunkLoadError' }),
  ])('recognises %s', (error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([new Error('Cannot read properties of undefined'), new ReferenceError('x is not defined'), null, undefined, 'nope'])(
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
    resetSaveHealth();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetSaveHealth();
  });

  it('reloads the first time and records the attempt', () => {
    expect(reloadOnceForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull();
  });

  it('reloads exactly once when the same request fails again 12 seconds later', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    expect(reloadOnceForNewVersion()).toBe(true);

    vi.advanceTimersByTime(12_000);
    expect(reloadOnceForNewVersion()).toBe(false);

    vi.advanceTimersByTime(10 * 60_000);
    expect(reloadOnceForNewVersion()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows a reload again once a successful startup clears the attempt', () => {
    reloadOnceForNewVersion();
    clearChunkReloadAttempt();
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
    expect(reloadOnceForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload when it cannot record the attempt', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(reloadOnceForNewVersion()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload while a local save failure is outstanding, and records no attempt', () => {
    markSaveFailed('se_quickmatch_draft_volleyball_1');
    expect(reloadOnceForNewVersion()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();

    markSaveOk('se_quickmatch_draft_volleyball_1');
    expect(reloadOnceForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('installChunkReloadHandler', () => {
  let reload;
  let remove;

  const preloadError = (payload) => {
    const event = new Event('vite:preloadError', { cancelable: true });
    event.payload = payload;
    return event;
  };
  const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/Old-deadbeef.js');

  beforeEach(() => {
    reload = vi.fn();
    vi.stubGlobal('location', { ...globalThis.location, reload });
    globalThis.sessionStorage.clear();
    resetSaveHealth();
    remove = installChunkReloadHandler();
  });

  afterEach(() => {
    remove();
    vi.unstubAllGlobals();
    resetSaveHealth();
  });

  it('reloads on a chunk-load failure and calls preventDefault', () => {
    const event = preloadError(chunkError());
    globalThis.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lets a module-evaluation error through: no reload, no preventDefault', () => {
    const event = preloadError(new ReferenceError('lazyThing is not defined'));
    globalThis.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it('lets the error through while a reload attempt is outstanding', () => {
    globalThis.dispatchEvent(preloadError(chunkError()));
    const second = preloadError(chunkError());
    globalThis.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lets the error through while a local save failure is outstanding', () => {
    markSaveFailed('se_quickmatch_draft_volleyball_1');
    const event = preloadError(chunkError());
    globalThis.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
