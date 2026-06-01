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
