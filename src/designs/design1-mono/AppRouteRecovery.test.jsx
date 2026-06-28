import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Design1Mono from './index';

// This file renders the real Design1Mono app, which code-splits its routes via
// React.lazy (see index.jsx). Each test navigates to a route whose component is
// fetched through an on-demand dynamic import(). When the full suite runs in
// parallel, those one-time module transforms contend for CPU and can take
// several seconds to resolve, leaving the Suspense fallback (<AppLoading />)
// mounted past the global 5s asyncUtilTimeout — which surfaces as a flaky
// waitFor/findBy timeout even though the route eventually renders correctly.
//
// Give the async queries generous headroom (file-local, so the rest of the
// suite keeps the tighter global default) and raise the per-test timeout above
// 2x asyncUtilTimeout so tests with two sequential awaits (e.g. waitFor the
// redirect, then findBy the loaded screen) are never killed mid-wait.
configure({ asyncUtilTimeout: 15000 });
vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });

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
  useConvexConnectionState: () => ({
    isWebSocketConnected: true,
    hasEverConnected: true,
    connectionRetries: 0,
  }),
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
    globalThis.localStorage?.clear();
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

  it('redirects legacy stats links to the merged History route', async () => {
    renderApp('/stats');

    await waitFor(() => {
      expectCurrentRoute('/history');
    });
  });

  it('redirects legacy statistics links to the merged History route', async () => {
    renderApp('/statistics');

    await waitFor(() => {
      expectCurrentRoute('/history');
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

    const heading = await screen.findByRole('heading', { name: 'Resume link unavailable' });
    const recoveryPanel = heading.closest('.max-w-2xl');
    expect(within(recoveryPanel).getByRole('button', { name: 'Find matches to resume' })).toBeInTheDocument();
    expect(within(recoveryPanel).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This screen is not available' })).not.toBeInTheDocument();
  });

  it('resolves a legacy game resume link against a saved tennis quick draft', async () => {
    globalThis.localStorage.setItem('se_tennis_quick_draft_resume-1', JSON.stringify({
      id: 'resume-1',
      sport: 'tennis',
      status: 'in-progress',
    }));

    renderApp('/game/resume-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/tennis/quick/live/resume-1');
    });
    expect(screen.queryByRole('heading', { name: 'Resume link unavailable' })).not.toBeInTheDocument();
  });

  it('resolves a legacy game resume link against a saved cricket Test quick match', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{
      id: 'test-resume-1',
      sport: 'cricket',
      status: 'in-progress',
      format: { totalInnings: 4 },
    }]));

    renderApp('/game/test-resume-1');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick/test-match/test-resume-1');
    });
    expect(screen.queryByRole('heading', { name: 'Resume link unavailable' })).not.toBeInTheDocument();
  });

  it('falls back to recovery when a saved draft is already completed', async () => {
    globalThis.localStorage.setItem('se_tennis_quick_draft_done-1', JSON.stringify({
      id: 'done-1',
      sport: 'tennis',
      status: 'completed',
    }));

    renderApp('/game/done-1');

    expect(await screen.findByRole('heading', { name: 'Resume link unavailable' })).toBeInTheDocument();
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

    const heading = await screen.findByRole('heading', { name: 'This Badminton screen is not available' });
    const recoveryPanel = heading.closest('.max-w-2xl');
    expect(within(recoveryPanel).getByRole('button', { name: 'Start Badminton quick match' })).toBeInTheDocument();
    // Sport-scoped 404s previously dead-ended without a Home escape.
    expect(within(recoveryPanel).getByRole('button', { name: 'Home' })).toBeInTheDocument();

    fireEvent.click(within(recoveryPanel).getByRole('button', { name: 'Choose another sport' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/play');
    });
  });

  it('offers a Home escape from sport-scoped 404s', async () => {
    renderApp('/badminton/not-a-route');

    const heading = await screen.findByRole('heading', { name: 'This Badminton screen is not available' });
    const recoveryPanel = heading.closest('.max-w-2xl');

    fireEvent.click(within(recoveryPanel).getByRole('button', { name: 'Home' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
    });
  });
});
