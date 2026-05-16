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
  if (typeof window === 'undefined') return fallback;
  const stored = window.sessionStorage.getItem(AUTH_RETURN_TO_KEY);
  return isSafeAppPath(stored) ? stored : fallback;
}

export function rememberAuthReturnTo(value) {
  if (typeof window === 'undefined' || !isSafeAppPath(value)) return;
  window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, value);
}

export function consumeAuthReturnTo(fallback = '/') {
  const target = getStoredAuthReturnTo(fallback);
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  }
  return target;
}
