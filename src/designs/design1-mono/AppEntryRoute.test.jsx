import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadAppRoutes } from '../../test/preloadAppRoutes';
import Design1Mono from './index';
import { useScoringProgress } from './scoring/scoringProgressContext';

// Renders the real app shell, which code-splits routes via React.lazy. Load every
// route chunk during module collection so no test pays a cold dynamic import()
// inside its findBy/waitFor window (see preloadAppRoutes). Mocked routes below
// still resolve to their mocks.
await preloadAppRoutes();

let authState;
let renderAuthUserButton;
let simulatedScoringStarted;
let liveFeed = [];
let realAccountFlow = false;

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => liveFeed,
  useConvexConnectionState: () => ({
    isWebSocketConnected: true,
    hasEverConnected: true,
    connectionRetries: 0,
  }),
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

vi.mock('./landing/DashboardLanding', async (importOriginal) => {
  const { default: Dashboard } = await importOriginal();
  return { default: () => realAccountFlow ? <Dashboard /> : <p>App dashboard</p> };
});

vi.mock('./MonoQuickMatch', () => ({
  default: () => <p>Quick match setup</p>,
}));

vi.mock('./MonoLogin', () => ({
  default: () => <p>Login screen</p>,
}));

vi.mock('./MonoProfile', async (importOriginal) => {
  const { default: Profile } = await importOriginal();
  return { default: () => realAccountFlow ? <Profile /> : <p>Profile screen</p> };
});

vi.mock('./scoring/MonoTennisLiveScore', () => ({
  default: function TennisQuickScorerStub() {
    useScoringProgress(simulatedScoringStarted);
    return <p>Tennis quick scorer</p>;
  },
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
    realAccountFlow = false;
    liveFeed = [];
    authState = {
      authMode: 'local',
      cloudAuthAvailable: false,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
      user: null,
    };
    renderAuthUserButton = true;
    simulatedScoringStarted = false;
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

  it('has one guest account entry on real Home, through Profile, with the login return target', async () => {
    realAccountFlow = true;
    authState = { ...authState, cloudAuthAvailable: true, isUserReady: true };
    const { container } = renderApp('/app');
    await screen.findByRole('heading', { name: 'Welcome.' });
    const dock = container.querySelector('.global-bottom-nav');
    expect(within(dock).getAllByRole('button', { name: 'Profile', hidden: true })).toHaveLength(1);
    expect(container.querySelector('.kit-top')).not.toHaveTextContent('Sign in');
    fireEvent.click(within(dock).getByRole('button', { name: 'Profile', hidden: true }));
    await screen.findByRole('heading', { name: 'Your profile, when you’re ready' });
    expect(within(dock).getByRole('button', { name: 'Profile', hidden: true })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('button', { name: /^Sign in$/, hidden: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in', hidden: true }));
    await screen.findByText('Login screen');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login?returnTo=%2Fprofile');
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
    // History and Stats are now one merged section reachable from a single tab.
    expect(within(appNav).getByRole('button', { name: 'History', hidden: true })).toBeInTheDocument();
    expect(within(appNav).queryByRole('button', { name: 'Stats', hidden: true })).not.toBeInTheDocument();
    expect(within(appNav).getByRole('button', { name: 'Live', hidden: true })).toBeInTheDocument();
    // Dock icons are clean monolines, not the hand-drawn layer (that is for moments): one 1.9
    // stroke on the 24 grid with round caps and joins. The active tab is an ink fill.
    for (const icon of appNav.querySelectorAll('.global-bottom-nav-icon svg')) {
      expect(icon).toHaveAttribute('stroke-width', '1.9');
      expect(icon).toHaveAttribute('stroke-linecap', 'round');
      expect(icon).toHaveAttribute('stroke-linejoin', 'round');
      expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
    }
    expect(appNav.querySelector('.global-bottom-nav-icon path')).toHaveAttribute('d', 'M3.5 10.5 12 3.5l8.5 7');
    expect(navStyles).toMatch(/\.global-bottom-nav-account-cell\.is-active \{\s*background: var\(--se-color-ink\);\s*color: var\(--se-color-on-ink\);/);
  });

  it('keeps icon-led native app tabs active on the Play hub and cricket fast start', async () => {
    const { container } = renderApp('/play');

    expect(await screen.findByRole('heading', { name: 'What are we scoring?' })).toBeInTheDocument();
    const appNav = container.querySelector('.global-bottom-nav');
    expect(appNav).toHaveClass('global-bottom-nav-native');
    expect(appNav.querySelectorAll('.global-bottom-nav-icon')).toHaveLength(4);
    expect(within(appNav).getByRole('button', { name: 'Play', hidden: true })).toHaveAttribute('aria-current', 'page');

    // A Play hub tile starts that sport's quick setup.
    fireEvent.click(screen.getByRole('button', { name: 'Quick match: Cricket' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick');
    });
  });

  it('exposes a single account control (the Clerk button) in app bottom navigation', async () => {
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

    // Single control per cell: once the Clerk account button has mounted it is
    // the ONLY interactive control (the sole sign-out / manage-account surface
    // on mobile). The previous pattern stacked an invisible Clerk button over a
    // separate visible nav button — now there is exactly one.
    expect(within(appNav).getByRole('button', { name: 'Account menu', hidden: true })).toBeInTheDocument();
    expect(within(appNav).queryByRole('button', { name: 'Account', hidden: true })).not.toBeInTheDocument();
    // Visible label is non-interactive chrome, hidden from assistive tech.
    const label = within(appNav).getByText('Profile');
    expect(label).toHaveAttribute('aria-hidden', 'true');

    // The signed-in trigger (Clerk's avatar button) and its loading fallback are thumb-sized:
    // >= 48x48 hit areas. These rules live in the mobile media query, which jsdom does not match,
    // so the declarations themselves are read from the shell's stylesheet.
    const css = Array.from(container.querySelectorAll('style')).map((style) => style.textContent).join('\n');
    const rule = (selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
      expect(match, selector).not.toBeNull();
      return Object.fromEntries(match[1].split(';').map((d) => d.split(':').map((p) => p.trim())).filter(([k]) => k));
    };
    const px = (value) => Number.parseFloat(value);
    const trigger = rule('.global-bottom-nav-account-control .cl-userButtonTrigger,\n          .global-bottom-nav-account-control .cl-userButtonBox');
    expect(px(trigger.width)).toBeGreaterThanOrEqual(48);
    expect(px(trigger.height)).toBeGreaterThanOrEqual(48);
    const control = rule('.global-bottom-nav-account-control');
    expect(px(control['min-width'])).toBeGreaterThanOrEqual(48);
    expect(px(control['min-height'])).toBeGreaterThanOrEqual(48);
    expect(px(rule('.global-bottom-nav-account-fallback')['min-height'])).toBeGreaterThanOrEqual(48);
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

  it('labels the last tab Profile for a cloud guest and highlights it on arrival', async () => {
    authState = { ...authState, authMode: 'cloud', cloudAuthAvailable: true, isAuthenticated: false };
    const { container } = renderApp('/history');

    expect(await screen.findByRole('heading', { name: 'No match history yet' })).toBeInTheDocument();
    const appNav = container.querySelector('.global-bottom-nav');
    const tabs = within(appNav).getAllByRole('button', { hidden: true });
    expect(tabs.map((tab) => tab.textContent.trim())).toEqual(['Home', 'Play', 'Live', 'History', 'Profile']);
    expect(within(appNav).getByRole('button', { name: 'History', hidden: true })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(within(appNav).getByRole('button', { name: 'Profile', hidden: true }));
    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/profile');
    });
    expect(await screen.findByText('Profile screen')).toBeInTheDocument();
    expect(within(appNav).getByRole('button', { name: 'Profile', hidden: true })).toHaveAttribute('aria-current', 'page');
  });

  it('gives the brand button an accessible label without leaking the line break', async () => {
    const { container } = renderApp('/app');

    expect(await screen.findByText('App dashboard')).toBeInTheDocument();
    const brand = container.querySelector('.global-nav-brand');
    expect(brand).toHaveAttribute('aria-label', 'Score Easy home');
    // The visible SCORE/EASY wordmark (with its <br/>) must not pollute the
    // accessible name — it is hidden from assistive tech.
    expect(brand.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: 'Score Easy home', hidden: true })).toBe(brand);
  });

  it('opens Live with the dock, keeps the count reactive, and returns Home', async () => {
    authState = { ...authState, cloudAuthAvailable: true };
    liveFeed = [{ token: 'one', sport: 'tennis', lastEventAt: Date.now(), teamA: { name: 'A' }, teamB: { name: 'B' } }];
    const { container, rerender } = renderApp('/app');
    await screen.findByText('App dashboard');
    const dock = () => container.querySelector('.global-bottom-nav');
    expect(within(dock()).getAllByRole('button', { hidden: true }).map(b => b.textContent)).toEqual(['Home', 'Play', 'Live', 'History', 'Profile']);
    fireEvent.click(within(dock()).getByRole('button', { name: 'Live, 1 match now', hidden: true }));
    await screen.findByRole('heading', { name: 'Live now' });
    expect(within(dock()).getByRole('button', { name: 'Live, 1 match now', hidden: true })).toHaveAttribute('aria-current', 'page');
    expect(container.querySelector('.global-nav-links [aria-current="page"]')).toHaveTextContent('Live');
    expect(dock().querySelector('.kit-nav-live-dot')).toBeInTheDocument();
    // JSDOM has no native dialog.showModal; model only the browser's open flag.
    const dialogPrototype = HTMLDialogElement.prototype;
    const showModal = Object.getOwnPropertyDescriptor(dialogPrototype, 'showModal');
    Object.defineProperty(dialogPrototype, 'showModal', { configurable: true, value() { this.open = true; } });
    try {
      fireEvent.click(container.querySelector('.global-mobile-menu-button'));
      expect(within(container.querySelector('.global-mobile-menu-panel')).getByRole('button', { name: 'Live, 1 match now', hidden: true })).toHaveAttribute('aria-current', 'page');
      fireEvent.click(container.querySelector('.global-mobile-menu-close'));
    } finally {
      if (showModal) Object.defineProperty(dialogPrototype, 'showModal', showModal);
      else delete dialogPrototype.showModal;
    }
    liveFeed = [];
    rerender(<MemoryRouter initialEntries={['/app']}><LocationProbe /><Design1Mono /></MemoryRouter>);
    expect(dock().querySelector('.kit-nav-live-dot')).toBeNull();
    expect(within(dock()).getByRole('button', { name: 'Live', hidden: true })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(dock()).getByRole('button', { name: 'Home', hidden: true }));
    await screen.findByText('App dashboard');
    expect(within(dock()).getByRole('button', { name: 'Home', hidden: true })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the active tab consistently across header and bottom navigation', async () => {
    const { container } = renderApp('/history');

    // History route renders MonoHistory; assert via the location probe so the
    // test does not depend on that screen's internals.
    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/history');
    });

    const headerHistory = within(container.querySelector('.global-nav-links'))
      .getByRole('button', { name: 'History', hidden: true });
    const bottomHistory = within(container.querySelector('.global-bottom-nav'))
      .getByRole('button', { name: 'History', hidden: true });

    expect(headerHistory).toHaveAttribute('aria-current', 'page');
    expect(bottomHistory).toHaveAttribute('aria-current', 'page');

    // Both surfaces drive the active cue off the same unified action token.
    const navStyles = Array.from(container.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('\n');
    expect(navStyles).toContain('.global-bottom-nav-item[aria-current="page"]');
    expect(navStyles).toContain('background: var(--se-color-action);');
    expect(navStyles).not.toContain('var(--se-color-action-soft)');
  });

  it('paints the account tab active on the profile route with a >=48px tap target', async () => {
    authState = {
      ...authState,
      authMode: 'cloud',
      cloudAuthAvailable: true,
      isAuthenticated: true,
      user: { username: 'harsha' },
    };
    const { container } = renderApp('/profile');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/profile');
    });

    const appNav = container.querySelector('.global-bottom-nav');
    // With Clerk mounted, the interactive control is the Clerk account button,
    // so the active cue must live on the account CELL (not the fallback button,
    // which only renders while Clerk is loading).
    const accountCell = appNav.querySelector('.global-bottom-nav-account-cell');
    expect(accountCell).not.toBeNull();
    expect(accountCell).toHaveClass('is-active');
    expect(accountCell).toHaveAttribute('aria-current', 'page');

    // The active cue is driven by the same unified action token as every other
    // tab, via a selector that includes the account cell.
    const navStyles = Array.from(container.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('\n');
    expect(navStyles).toContain('.global-bottom-nav-account-cell.is-active');
    // Tap targets meet the >=48px bar — assert Clerk's OWN trigger/avatar box (the
    // real hit area) is sized to 48px, not just that a 48px rule exists somewhere.
    expect(navStyles).toContain('.global-bottom-nav-account-control .cl-userButtonTrigger');
    expect(navStyles).toMatch(/\.cl-userButtonBox\s*\{[^}]*width: 48px;[^}]*height: 48px;/);
    expect(navStyles).not.toContain('min-height: 24px;');
  });

  it('keeps the active cue on the account cell while Clerk is still loading', async () => {
    authState = {
      ...authState,
      authMode: 'cloud',
      cloudAuthAvailable: true,
      isAuthenticated: true,
      user: { username: 'harsha' },
    };
    // Clerk chunk not mounted yet -> the cell renders the /profile fallback.
    renderAuthUserButton = false;
    const { container } = renderApp('/profile');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/profile');
    });

    const appNav = container.querySelector('.global-bottom-nav');
    const accountCell = appNav.querySelector('.global-bottom-nav-account-cell');
    expect(accountCell).toHaveClass('is-active');
    // The loading fallback also exposes the active cue for assistive tech.
    const fallback = within(appNav).getByRole('button', { name: 'Account', hidden: true });
    expect(fallback).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the nav shell mounted around the lazy route boundary', async () => {
    const { container } = renderApp('/app');

    // The nav shell lives OUTSIDE the route <Suspense>, so it is present both
    // during and after the lazy chunk load — chunk swaps never tear down the
    // header/brand.
    expect(container.querySelector('.global-nav-brand')).toBeInTheDocument();
    expect(await screen.findByText('App dashboard')).toBeInTheDocument();
    expect(container.querySelector('.global-nav-brand')).toBeInTheDocument();
  });

  it('does not show app bottom navigation on the public marketing route', async () => {
    renderApp('/marketing');

    expect(await screen.findByText('Public marketing')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'App navigation' })).not.toBeInTheDocument();
  });

  it('keeps marketing Home and brand clicks on the public entry resolver', async () => {
    renderApp('/marketing');

    expect(await screen.findByText('Public marketing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/marketing');
    });
    expect(screen.queryByText('App dashboard')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Score Easy home' }));
    await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/marketing'));
  });

  it('does not show app bottom navigation after scoring starts', async () => {
    simulatedScoringStarted = true;
    globalThis.localStorage.setItem('se_tennis_quick_draft_match-1', JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
    }));

    const { container } = renderApp('/tennis/quick/live/match-1');

    expect(await screen.findByText('Tennis quick scorer')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('.global-bottom-nav')).toBeNull());
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
