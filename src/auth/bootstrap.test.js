import { describe, expect, it } from 'vitest';
import {
  getAuthBootstrapMode,
  isCloudAuthRoute,
  shouldShowNativeCloudProbeLoading,
  shouldUseCloudAuthRoot,
} from './bootstrap';

describe('getAuthBootstrapMode', () => {
  it('uses local mode when Clerk config is missing', () => {
    expect(
      getAuthBootstrapMode({
        clerkPublishableKey: '',
        convexUrl: 'https://example.convex.cloud',
        isOnline: true,
      }),
    ).toEqual({ mode: 'local', reason: 'missing-config' });
  });

  it('uses local mode when Convex config is missing', () => {
    expect(
      getAuthBootstrapMode({
        clerkPublishableKey: 'pk_test_123',
        convexUrl: '',
        isOnline: true,
      }),
    ).toEqual({ mode: 'local', reason: 'missing-config' });
  });

  it('uses local mode when the app starts offline', () => {
    expect(
      getAuthBootstrapMode({
        clerkPublishableKey: 'pk_test_123',
        convexUrl: 'https://example.convex.cloud',
        isOnline: false,
      }),
    ).toEqual({ mode: 'local', reason: 'offline' });
  });

  it('uses cloud mode when config exists and the app starts online', () => {
    expect(
      getAuthBootstrapMode({
        clerkPublishableKey: 'pk_test_123',
        convexUrl: 'https://example.convex.cloud',
        isOnline: true,
      }),
    ).toEqual({ mode: 'cloud', reason: 'available' });
  });

  it('uses local mode when a production Clerk key is loaded on an unsupported host', () => {
    expect(
      getAuthBootstrapMode({
        clerkPublishableKey: 'pk_live_123',
        convexUrl: 'https://example.convex.cloud',
        isOnline: true,
        hostname: 'scoreeasy-git-branch-user.vercel.app',
      }),
    ).toEqual({ mode: 'local', reason: 'unsupported-origin' });
  });

  it('uses cloud mode when a production Clerk key is loaded on the configured domain', () => {
    expect(
      getAuthBootstrapMode({
        clerkPublishableKey: 'pk_live_123',
        convexUrl: 'https://example.convex.cloud',
        isOnline: true,
        hostname: 'scoreeasy.app',
      }),
    ).toEqual({ mode: 'cloud', reason: 'available' });
  });
});

describe('isCloudAuthRoute', () => {
  it('matches cloud-only auth routes and nested profile routes', () => {
    expect(isCloudAuthRoute('/login')).toBe(true);
    expect(isCloudAuthRoute('/signup')).toBe(true);
    expect(isCloudAuthRoute('/sso-callback')).toBe(true);
    expect(isCloudAuthRoute('/profile/alex')).toBe(true);
  });

  it('does not match local-first gameplay routes', () => {
    expect(isCloudAuthRoute('/')).toBe(false);
    expect(isCloudAuthRoute('/quick-match')).toBe(false);
  });
});

describe('shouldUseCloudAuthRoot', () => {
  it('uses cloud auth immediately for web cloud mode', () => {
    expect(
      shouldUseCloudAuthRoot({
        authMode: 'cloud',
        shouldProbeNativeCloud: false,
        nativeProbeStatus: 'idle',
      }),
    ).toBe(true);
  });

  it('keeps native cloud routes mounted during retry cycles', () => {
    expect(
      shouldUseCloudAuthRoot({
        authMode: 'cloud',
        shouldProbeNativeCloud: true,
        nativeProbeStatus: 'retrying',
        pathname: '/sso-callback',
      }),
    ).toBe(true);

    expect(
      shouldUseCloudAuthRoot({
        authMode: 'cloud',
        shouldProbeNativeCloud: true,
        nativeProbeStatus: 'probing',
        nativeProbeAttempt: 1,
        pathname: '/login',
      }),
    ).toBe(true);
  });

  it('allows local fallback for non-auth routes during native retries', () => {
    expect(
      shouldUseCloudAuthRoot({
        authMode: 'cloud',
        shouldProbeNativeCloud: true,
        nativeProbeStatus: 'retrying',
        pathname: '/',
      }),
    ).toBe(false);
  });
});

describe('shouldShowNativeCloudProbeLoading', () => {
  it('shows loading only during the initial native probe', () => {
    expect(
      shouldShowNativeCloudProbeLoading({
        shouldProbeNativeCloud: true,
        nativeProbeStatus: 'probing',
        pathname: '/login',
      }),
    ).toBe(true);

    expect(
      shouldShowNativeCloudProbeLoading({
        shouldProbeNativeCloud: true,
        nativeProbeStatus: 'probing',
        nativeProbeAttempt: 1,
        pathname: '/login',
      }),
    ).toBe(false);

    expect(
      shouldShowNativeCloudProbeLoading({
        shouldProbeNativeCloud: true,
        nativeProbeStatus: 'probing',
        nativeProbeAttempt: 1,
        pathname: '/',
      }),
    ).toBe(false);
  });
});
