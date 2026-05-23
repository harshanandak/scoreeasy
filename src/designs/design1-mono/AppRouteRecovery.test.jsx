import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Design1Mono from './index';

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
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

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderApp(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Design1Mono />
    </MemoryRouter>,
  );
}

describe('app route recovery', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a useful recovery screen for invalid sport quick routes', async () => {
    renderApp('/madeupsport/quick');

    const heading = await screen.findByText('This screen is not available');
    const recoveryPanel = heading.closest('.max-w-2xl');
    expect(recoveryPanel).toBeInTheDocument();
    expect(within(recoveryPanel).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(within(recoveryPanel).getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });

  it('redirects legacy quick-match links into the default volleyball quick flow', async () => {
    renderApp('/quick-match');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick');
    });
    expect(await screen.findByRole('button', { name: 'Start Volleyball' })).toBeEnabled();
  });

  it('redirects legacy dashboard links home', async () => {
    renderApp('/dashboard');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    });
  });

  it('keeps quick test scoring restricted to cricket routes', async () => {
    renderApp('/tennis/quick/test/123');

    expect(await screen.findByText('This screen is not available')).toBeInTheDocument();
  });

  it('redirects legacy cricket Test Match quick links to product route language', async () => {
    renderApp('/cricket/quick/test/123');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick/test-match/123');
    });
  });
});
