export const AUTH_RETURN_TO_KEY = 'scoreeasy.authReturnTo';
export const DEFAULT_GUEST_SCORING_PATH = '/volleyball/quick';

export function isSafeAppPath(value) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\');
}

export function getAuthReturnToFromSearch(search, fallback = '/') {
  const params = new URLSearchParams(search || '');
  const returnTo = params.get('returnTo');
  return isSafeAppPath(returnTo) ? returnTo : fallback;
}

export function getStoredAuthReturnTo(fallback = '/') {
  if (typeof globalThis.window === 'undefined') return fallback;
  try {
    const stored = globalThis.window.sessionStorage.getItem(AUTH_RETURN_TO_KEY);
    return isSafeAppPath(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function rememberAuthReturnTo(value) {
  if (typeof globalThis.window === 'undefined' || !isSafeAppPath(value)) return;
  try {
    globalThis.window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, value);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export function consumeAuthReturnTo(fallback = '/') {
  const target = getStoredAuthReturnTo(fallback);
  if (typeof globalThis.window !== 'undefined') {
    try {
      globalThis.window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }
  return target;
}
