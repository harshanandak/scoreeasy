import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Design1Mono from './index';

const authState = vi.hoisted(() => ({
  current: {
    authMode: 'local',
    cloudAuthAvailable: false,
    isAuthenticated: false,
    isLoading: false,
    needsOnboarding: false,
    user: null,
  },
}));

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState.current,
}));

vi.mock('@clerk/clerk-react', () => ({
  SignIn: () => <div>Sign in form</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}${location.hash}`}</output>;
}

function renderApp(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Design1Mono />
    </MemoryRouter>,
  );
}

function expectCurrentRoute(route) {
  expect(screen.getByLabelText('Current route').textContent).toBe(route);
}

describe('app route recovery', () => {
  beforeEach(() => {
    authState.current = {
      authMode: 'local',
      cloudAuthAvailable: false,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
      user: null,
    };
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
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

  it('redirects legacy tournament links to the sport chooser when no sport is supplied', async () => {
    renderApp('/tournament');

    await waitFor(() => {
      expectCurrentRoute('/play');
    });
  });

  it('honors supported sport query params on legacy tournament links', async () => {
    renderApp('/tournament?sport=cricket');

    await waitFor(() => {
      expectCurrentRoute('/cricket/tournament');
    });
  });

  it('redirects legacy stats links to the Statistics route', async () => {
    renderApp('/stats');

    await waitFor(() => {
      expectCurrentRoute('/statistics');
    });
  });

  it('redirects legacy dashboard links to the app dashboard', async () => {
    renderApp('/dashboard');

    await waitFor(() => {
      expectCurrentRoute('/app');
    });
  });

  it('redirects signin aliases through the supported auth route', async () => {
    renderApp('/signin');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    });
    expect(screen.queryByRole('heading', { name: 'This screen is not available' })).not.toBeInTheDocument();
  });

  it('preserves hash fragments on signin alias redirects', async () => {
    authState.current = {
      authMode: 'cloud',
      cloudAuthAvailable: true,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
      user: null,
    };

    renderApp('/signin?returnTo=%2Fapp#oauth');

    await waitFor(() => {
      expectCurrentRoute('/login?returnTo=%2Fapp#oauth');
    });
  });

  it('preserves returnTo on signin alias redirects', async () => {
    authState.current = {
      authMode: 'cloud',
      cloudAuthAvailable: true,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
      user: null,
    };

    renderApp('/sign-in?returnTo=%2Fprofile');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/login?returnTo=%2Fprofile');
    });
    expect(screen.getByText('Sign in form')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Choose another sport' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/play');
    });
  });
});
