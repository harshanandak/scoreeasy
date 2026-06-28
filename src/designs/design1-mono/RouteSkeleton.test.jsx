import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// index.jsx pulls in router hooks and the design CSS at module load; stub the
// heavy/native edges so we can unit-test the exported LazyFallback skeleton in
// isolation (the lighter replacement for the full-splash route fallback).
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
  useConvexConnectionState: () => ({
    isWebSocketConnected: true,
    hasEverConnected: true,
    connectionRetries: 0,
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    authMode: 'local',
    cloudAuthAvailable: false,
    isAuthenticated: false,
    isLoading: false,
    needsOnboarding: false,
    user: null,
  }),
}));

import { LazyFallback } from './index';

describe('LazyFallback route skeleton', () => {
  it('renders a light, polite inline skeleton rather than the branded splash', () => {
    const { container } = render(<LazyFallback />);

    const skeleton = container.querySelector('.route-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('role', 'status');
    expect(skeleton).toHaveAttribute('aria-live', 'polite');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');

    // It must NOT be the heavy AppLoading splash (no scoreboard / brand mark).
    expect(container.querySelector('.app-loading')).not.toBeInTheDocument();
    expect(container.querySelector('.app-loading-board')).not.toBeInTheDocument();

    // Placeholder blocks carry the shimmer animation styling.
    expect(container.querySelectorAll('.route-skeleton-block').length).toBeGreaterThan(0);
    const styles = Array.from(container.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('\n');
    expect(styles).toContain('route-skeleton-shimmer');
    expect(styles).toContain('prefers-reduced-motion: reduce');
  });
});
