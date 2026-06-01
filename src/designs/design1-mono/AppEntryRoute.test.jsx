import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Design1Mono from './index';

let authState;

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('./MonoLanding', () => ({
  default: () => <p>Public marketing</p>,
}));

vi.mock('./landing/DashboardLanding', () => ({
  default: () => <p>App dashboard</p>,
}));

vi.mock('./MonoQuickMatch', () => ({
  default: () => <p>Quick match setup</p>,
}));

vi.mock('./scoring/MonoTennisLiveScore', () => ({
  default: () => <p>Tennis quick scorer</p>,
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

describe('app entry route contract', () => {
  beforeEach(() => {
    authState = {
      authMode: 'local',
      cloudAuthAvailable: false,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
      user: null,
    };
    globalThis.localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback?.(0);
      return 1;
    }));
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    globalThis.localStorage.clear();
  });

  it('sends anonymous first-time root visits to the public marketing route', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/marketing');
    });
    expect(screen.getByText('Public marketing')).toBeInTheDocument();
  });

  it('sends authenticated root visits to the app dashboard route', async () => {
    authState = {
      ...authState,
      isAuthenticated: true,
      user: { username: 'harsha' },
    };

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/app');
    });
    expect(screen.getByText('App dashboard')).toBeInTheDocument();
  });

  it('sends returning local players with recent matches to the app dashboard route', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1' }]));

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/app');
    });
    expect(screen.getByText('App dashboard')).toBeInTheDocument();
  });

  it('sends draft-only quick-match players to the sport quick route', async () => {
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
    }));

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick');
    });
    expect(screen.getByText('Quick match setup')).toBeInTheDocument();
  });

  it('sends tennis quick-live draft players to their live scorer route', async () => {
    globalThis.localStorage.setItem('se_tennis_quick_draft_match-1', JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
    }));

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/tennis/quick/live/match-1');
    });
    expect(screen.getByText('Tennis quick scorer')).toBeInTheDocument();
  });

  it('keeps public marketing intentionally reachable for signed-in users', async () => {
    authState = {
      ...authState,
      isAuthenticated: true,
      user: { username: 'harsha' },
    };

    renderApp('/marketing');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/marketing');
    });
    expect(screen.getByText('Public marketing')).toBeInTheDocument();
  });

  it('maps legacy dashboard links to the app dashboard route', async () => {
    renderApp('/dashboard');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/app');
    });
    expect(screen.getByText('App dashboard')).toBeInTheDocument();
  });
});
