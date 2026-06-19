import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Design1Mono from './index';

let authState;
let renderAuthUserButton;

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../components/AuthButtons', () => ({
  AuthUserButton: (props) => (renderAuthUserButton ? <button type="button" {...props}>Account menu</button> : null),
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

vi.mock('./MonoProfile', () => ({
  default: () => <p>Profile screen</p>,
}));

vi.mock('./scoring/MonoTennisLiveScore', () => ({
  default: () => <p>Tennis quick scorer</p>,
}));

vi.mock('./scoring/MonoCricketTestLiveScore', () => ({
  default: () => <p>Cricket Test scorer</p>,
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
    renderAuthUserButton = true;
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
    cleanup();
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

  it('sends draft-only quick-match players to the draft scorer route', async () => {
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

  it('sends tennis quick-live draft players to the draft scorer route', async () => {
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

  it('sends in-progress cricket Test quick matches to the draft scorer route', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{
      id: 'test-1',
      sport: 'cricket',
      status: 'in-progress',
      format: { totalInnings: 4 },
    }]));

    renderApp('/');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick/test-match/test-1');
    });
    expect(screen.getByText('Cricket Test scorer')).toBeInTheDocument();
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

  it('shows icon-led native app tabs with Home active on the app dashboard', async () => {
    const { container } = renderApp('/app');

    expect(await screen.findByText('App dashboard')).toBeInTheDocument();
    const appNav = container.querySelector('.global-bottom-nav');
    expect(appNav).toHaveAttribute('aria-label', 'App navigation');
    expect(appNav).toHaveClass('global-bottom-nav-native');
    expect(appNav.querySelectorAll('.global-bottom-nav-icon')).toHaveLength(4);
    const navStyles = Array.from(container.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('\n');
    expect(navStyles).toContain('width: auto;');
    expect(navStyles).toContain('max-width: 520px;');
    expect(navStyles).not.toContain('calc(100vw - 20px)');

    expect(within(appNav).getByRole('button', { name: 'Home', hidden: true })).toHaveAttribute('aria-current', 'page');
    expect(within(appNav).getByRole('button', { name: 'Play', hidden: true })).toBeInTheDocument();
    expect(within(appNav).getByRole('button', { name: 'Matches', hidden: true })).toBeInTheDocument();
    expect(within(appNav).getByRole('button', { name: 'Stats', hidden: true })).toBeInTheDocument();
  });

  it('keeps icon-led native app tabs active on the Play hub and cricket fast start', async () => {
    // The Play hub defaults new users to Guided; Browse (the ledger chooser) is one tap away
    // and is remembered, so seed it to assert the browse-mode sport list directly.
    globalThis.localStorage.setItem('se_play_mode', 'browse');
    const { container } = renderApp('/play');

    expect(await screen.findByRole('heading', { name: 'Play' })).toBeInTheDocument();
    const appNav = container.querySelector('.global-bottom-nav');
    expect(appNav).toHaveClass('global-bottom-nav-native');
    expect(appNav.querySelectorAll('.global-bottom-nav-icon')).toHaveLength(4);
    expect(within(appNav).getByRole('button', { name: 'Play', hidden: true })).toHaveAttribute('aria-current', 'page');

    // The /play hub was simplified into a ledger-style chooser: the quick-match
    // action now navigates straight to the sport scorer.
    fireEvent.click(screen.getByRole('button', { name: 'Quick match: Cricket' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick');
    });
  });

  it('keeps the signed-in account menu reachable from app bottom navigation', async () => {
    authState = {
      ...authState,
      authMode: 'cloud',
      cloudAuthAvailable: true,
      isAuthenticated: true,
      user: { username: 'harsha' },
    };
    const { container } = renderApp('/app');

    expect(await screen.findByText('App dashboard')).toBeInTheDocument();
    const appNav = container.querySelector('.global-bottom-nav');

    expect(within(appNav).getByText('Account')).toBeInTheDocument();
    expect(within(appNav).getByRole('button', { name: 'Account menu', hidden: true })).toBeInTheDocument();
  });

  it('keeps signed-in account tab navigation while Clerk account menu is loading', async () => {
    authState = {
      ...authState,
      authMode: 'cloud',
      cloudAuthAvailable: true,
      isAuthenticated: true,
      user: { username: 'harsha' },
    };
    renderAuthUserButton = false;
    const { container } = renderApp('/app');

    expect(await screen.findByText('App dashboard')).toBeInTheDocument();
    const appNav = container.querySelector('.global-bottom-nav');

    fireEvent.click(within(appNav).getByRole('button', { name: 'Account', hidden: true }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/profile');
    });
    expect(screen.getByText('Profile screen')).toBeInTheDocument();
  });

  it('does not show app bottom navigation on the public marketing route', async () => {
    renderApp('/marketing');

    expect(await screen.findByText('Public marketing')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'App navigation' })).not.toBeInTheDocument();
  });

  it('routes public Home clicks through the entry resolver', async () => {
    renderApp('/marketing');

    expect(await screen.findByText('Public marketing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/marketing');
    });
    expect(screen.queryByText('App dashboard')).not.toBeInTheDocument();
  });

  it('does not show app bottom navigation on protected scorer routes', async () => {
    globalThis.localStorage.setItem('se_tennis_quick_draft_match-1', JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
    }));

    renderApp('/tennis/quick/live/match-1');

    expect(await screen.findByText('Tennis quick scorer')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'App navigation' })).not.toBeInTheDocument();
  });

  it('marks mobile input focus so the bottom nav can hide for keyboards', async () => {
    renderApp('/app');

    expect(await screen.findByText('App dashboard')).toBeInTheDocument();
    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.focusIn(input);
    expect(document.body).toHaveClass('has-mobile-input-focus');

    fireEvent.focusOut(input);
    expect(document.body).not.toHaveClass('has-mobile-input-focus');
    input.remove();
  });
});
