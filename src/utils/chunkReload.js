// A deploy replaces the hashed JS chunks. A tab opened before the deploy then asks
// for a chunk URL that no longer exists; the host answers with index.html and the
// dynamic import() throws. One automatic full reload picks up the new build. The
// guard below makes sure that reload can never turn into a loop.

export const CHUNK_RELOAD_KEY = 'se-chunk-reload-at';
export const CHUNK_RELOAD_GUARD_MS = 10_000;

const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'chunkloaderror',
];

export function isChunkLoadError(error) {
  if (!error) return false;
  const text = `${error.name ?? ''} ${error.message ?? (typeof error === 'string' ? error : '')}`.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}

// Reload the current URL once. Returns true when a reload was started, false when
// one already happened inside the guard window (or the guard cannot be recorded,
// in which case reloading blind could loop).
export function reloadOnceForNewVersion(now = Date.now()) {
  try {
    const storage = globalThis.sessionStorage;
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY));
    if (now - last < CHUNK_RELOAD_GUARD_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  globalThis.location.reload();
  return true;
}

// Vite fires `vite:preloadError` when a dependency preload fails. Reload once and
// swallow the error; if a reload just happened, let it through to the boundary.
export function installChunkReloadHandler() {
  const onPreloadError = (event) => {
    if (reloadOnceForNewVersion()) event.preventDefault();
  };
  globalThis.addEventListener('vite:preloadError', onPreloadError);
  return () => globalThis.removeEventListener('vite:preloadError', onPreloadError);
}
