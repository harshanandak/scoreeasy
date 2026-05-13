export function getAuthBootstrapMode({
  clerkPublishableKey,
  convexUrl,
  isOnline = true,
  hostname = '',
} = {}) {
  if (!clerkPublishableKey || !convexUrl) {
    return { mode: 'local', reason: 'missing-config' };
  }

  const normalizedHostname = hostname.toLowerCase();
  const isProductionClerkKey = clerkPublishableKey.startsWith('pk_live_');
  const isAllowedProductionHost =
    normalizedHostname === 'scoreeasy.app' ||
    normalizedHostname.endsWith('.scoreeasy.app');

  if (isProductionClerkKey && !isAllowedProductionHost) {
    return { mode: 'local', reason: 'unsupported-origin' };
  }

  if (!isOnline) {
    return { mode: 'local', reason: 'offline' };
  }

  return { mode: 'cloud', reason: 'available' };
}

const CLOUD_AUTH_ROUTE_PREFIXES = [
  '/login',
  '/signup',
  '/sso-callback',
  '/onboarding',
  '/profile',
  '/users/search',
];

export function isCloudAuthRoute(pathname = '/') {
  return CLOUD_AUTH_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldUseCloudAuthRoot({
  authMode,
  shouldProbeNativeCloud = false,
  nativeProbeStatus = 'idle',
  nativeProbeAttempt = 0,
  pathname = '/',
} = {}) {
  if (authMode !== 'cloud') {
    return false;
  }

  if (!shouldProbeNativeCloud || nativeProbeStatus === 'reachable') {
    return true;
  }

  return (
    isCloudAuthRoute(pathname) &&
    (nativeProbeStatus === 'retrying' || nativeProbeAttempt > 0)
  );
}

export function shouldShowNativeCloudProbeLoading({
  shouldProbeNativeCloud = false,
  nativeProbeStatus = 'idle',
  nativeProbeAttempt = 0,
  pathname = '/',
} = {}) {
  if (!shouldProbeNativeCloud) {
    return false;
  }

  if (
    shouldUseCloudAuthRoot({
      authMode: 'cloud',
      shouldProbeNativeCloud,
      nativeProbeStatus,
      nativeProbeAttempt,
      pathname,
    })
  ) {
    return false;
  }

  return (
    nativeProbeAttempt === 0 &&
    (nativeProbeStatus === 'idle' || nativeProbeStatus === 'probing')
  );
}
