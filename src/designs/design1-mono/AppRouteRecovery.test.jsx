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

  it('honors supported sport query params on legacy quick-match links', async () => {
    renderApp('/quick-match?sport=tennis');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/tennis/quick');
    });
    expect(await screen.findByRole('button', { name: 'Start Tennis' })).toBeEnabled();
  });

  it('redirects legacy dashboard links home', async () => {
    renderApp('/dashboard');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    });
  });

  it('redirects signin aliases through the supported auth route', async () => {
    renderApp('/signin');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    });
    expect(screen.queryByRole('heading', { name: 'This screen is not available' })).not.toBeInTheDocument();
  });

  it('recovers dead dashboard game resume links without generic not found', async () => {
    renderApp('/game/stale-draft');

    expect(await screen.findByRole('heading', { name: 'Resume link unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find matches to resume' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This screen is not available' })).not.toBeInTheDocument();
  });

  it('shows actionable recovery for missing tournament scorer deep links', async () => {
    renderApp('/football/tournament/missing/match/missing/score');

    expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Football tournaments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Football quick match' })).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('keeps quick test scoring restricted to cricket routes', async () => {
    renderApp('/tennis/quick/test/123');

    expect(await screen.findByText('This Tennis screen is not available')).toBeInTheDocument();
  });

  it('redirects legacy cricket Test Match quick links to product route language', async () => {
    renderApp('/cricket/quick/test/123');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick/test-match/123');
    });
  });

  it('redirects legacy tennis live links to the canonical quick live scorer route', async () => {
    renderApp('/tennis/live/match-123');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/tennis/quick/live/match-123');
    });
  });

  it('preserves sport context in bad sport-scoped route recovery', async () => {
    renderApp('/badminton/not-a-route');

    expect(await screen.findByRole('heading', { name: 'This Badminton screen is not available' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Badminton quick match' })).toBeInTheDocument();
  });
});
