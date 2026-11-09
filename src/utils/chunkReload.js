// A deploy replaces the hashed JS chunks. A tab opened before the deploy then asks for a
// chunk URL that no longer exists; the host answers with index.html and the dynamic import()
// throws. One automatic full reload picks up the new build.
//
// The reload can never loop, however slowly the next failure arrives: the attempt is recorded
// in sessionStorage and stays recorded until the app starts successfully (the shell mounted
// and a route rendered: ChunkReloadReset) or the user presses Reload / Try again. While an
// attempt is recorded, a chunk failure shows the "new version" screen instead of reloading.
import { hasOutstandingSaveFailure } from './saveHealth';

export const CHUNK_RELOAD_KEY = 'se-chunk-reload-attempt';

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

// Reload the current URL once. Returns true when a reload was started, false when it was
// refused: an attempt is already recorded, a local save failed and the newest score may exist
// only in memory, or the attempt cannot be recorded (reloading blind could loop).
export function reloadOnceForNewVersion(now = Date.now()) {
  if (hasOutstandingSaveFailure()) return false;
  try {
    const storage = globalThis.sessionStorage;
    if (storage.getItem(CHUNK_RELOAD_KEY) !== null) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  globalThis.location.reload();
  return true;
}

// The app started and a route rendered, or the user chose to reload: the next chunk failure
// may reload automatically once again.
export function clearChunkReloadAttempt() {
  try {
    globalThis.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Storage blocked: nothing was recorded, so nothing to clear.
  }
}

// Vite fires `vite:preloadError` when a dependency preload fails, with the error as `payload`.
// Reload once and swallow only a chunk-load failure. Any other rejected import (a module that
// throws while evaluating) and any refused reload propagate to the boundary and Sentry.
export function installChunkReloadHandler() {
  const onPreloadError = (event) => {
    if (!isChunkLoadError(event.payload)) return;
    if (reloadOnceForNewVersion()) event.preventDefault();
  };
  globalThis.addEventListener('vite:preloadError', onPreloadError);
  return () => globalThis.removeEventListener('vite:preloadError', onPreloadError);
}
