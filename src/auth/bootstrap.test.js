import { describe, expect, it } from 'vitest';
import { getAuthBootstrapMode } from './bootstrap';

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
});
