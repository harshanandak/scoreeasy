import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadAppRoutes } from '../../test/preloadAppRoutes';
import Design1Mono from './index';

// Route contracts for the routing audit (docs/plans/2026-10-21-routing-audit.md).
//
// Each test states how a route SHOULD behave for a scorer on a phone. Tests in
// the first block pin behaviour that is already right. Tests in the second block
// encode the right behaviour for a finding that is still open: they are marked
// `it.fails`, so the suite stays green while the bug exists and goes red the day
// the fix lands. Whoever lands the fix flips `it.fails` to `it` in the same PR.
// The finding id (RA-n) points at the audit doc's findings table and fix plan.
//
// Match AppRouteRecovery.test.jsx: resolve lazy route chunks during collection
// so contract assertions do not depend on cold imports inside a test timeout.
await preloadAppRoutes();

const authState = vi.hoisted(() => ({ current: null }));
const convexState = vi.hoisted(() => ({ useQuery: () => [] }));
const nativeBack = vi.hoisted(() => ({ install: vi.fn(() => () => {}) }));

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(() => Promise.resolve(null)),
  useQuery: (...args) => convexState.useQuery(...args),
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }),
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

vi.mock('./utils/confetti', () => ({ triggerConfetti: vi.fn() }));

vi.mock('../../mobile/backButton', async (importOriginal) => ({
  ...(await importOriginal()),
  installNativeBackButtonGuard: (...args) => nativeBack.install(...args),
}));

const GUEST = {
  authMode: 'local',
  cloudAuthAvailable: false,
  isAuthenticated: false,
  isLoading: false,
  needsOnboarding: false,
  user: null,
};

const NOW_ISO = new Date().toISOString();
const TENNIS_ID = '1761000000000';
const blankTennisSet = {
  games1: 0, games2: 0, points1: 0, points2: 0, isDeuce: false, advantage: null,
  isTiebreak: false, tiebreakPoints1: 0, tiebreakPoints2: 0, completed: false,
};
const wonTennisSet = { ...blankTennisSet, games1: 6, games2: 0, completed: true };

function footballTournament(id = 100) {
  return {
    id,
    name: 'Sunday League',
    type: 'round-robin',
    mode: 'tournament',
    phase: 'group',
    format: {},
    createdAt: NOW_ISO,
    winnerMode: 'table-topper',
    knockoutConfig: null,
    knockoutMatches: [],
    teams: [{ id: 't1', name: 'Red' }, { id: 't2', name: 'Blue' }],
    matches: [{ id: 'm1', team1Id: 't1', team2Id: 't2', score1: null, score2: null, status: 'pending' }],
  };
}

function seed(key, value) {
  globalThis.localStorage.setItem(key, JSON.stringify(value));
}

// Test-only controls rendered inside the router: the current location, an
// in-app Back (navigate(-1), what a back arrow or hardware Back does), and an
// in-app jump (what a nav tab does).
function RouterProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>
      <button type="button" onClick={() => navigate(-1)}>Probe back</button>
      <button type="button" onClick={() => navigate('/history')}>Probe go history</button>
    </div>
  );
}

function renderApp(initialEntries, initialIndex = initialEntries.length - 1) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <RouterProbe />
      <Design1Mono />
    </MemoryRouter>,
  );
}

const currentRoute = () => screen.getByLabelText('Current route').textContent;

// Wait until the lazy route chunk has replaced the route skeleton, then let the
// screen's own mount effects (localStorage reads, setState) flush. Assertions
// after this are synchronous, so an `it.fails` test fails on the contract, not
// on a timeout.
async function settleRoute() {
  await waitFor(() => {
    expect(document.querySelector('.route-skeleton')).toBeNull();
    expect(document.querySelector('main')?.textContent?.trim()).toBeTruthy();
  });
  await act(async () => {});
}

async function pressProbeBack() {
  fireEvent.click(screen.getByRole('button', { name: 'Probe back' }));
  await settleRoute();
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  globalThis.sessionStorage?.clear();
  authState.current = { ...GUEST };
  convexState.useQuery = () => [];
  nativeBack.install.mockReset();
  nativeBack.install.mockImplementation(() => () => {});
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

describe('route contracts: already correct (pinned)', () => {
  it('renders the 404 recovery screen, with Play and Home, for an unknown multi-segment path', async () => {
    renderApp(['/this/does/not/exist']);
    const heading = await screen.findByRole('heading', { name: 'This screen is not available' });
    const panel = heading.closest('.max-w-2xl');
    expect(within(panel).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Home' })).toBeInTheDocument();
  });

  it('keeps sport context on a 404 under a real sport', async () => {
    renderApp(['/volleyball']);
    expect(await screen.findByRole('heading', { name: 'This Volleyball screen is not available' })).toBeInTheDocument();
  });

  it('auto-resumes the single in-progress draft from the app entry route', async () => {
    seed(`se_tennis_quick_draft_${TENNIS_ID}`, {
      id: TENNIS_ID, sport: 'tennis', team1Name: 'Ana', team2Name: 'Bea',
      format: { sets: 3 }, status: 'in-progress', updatedAt: NOW_ISO, createdAt: NOW_ISO,
    });
    renderApp(['/']);
    await waitFor(() => expect(currentRoute()).toBe(`/tennis/quick/live/${TENNIS_ID}`));
  });
});

describe('route contracts: audit findings (open findings retain it.fails)', () => {
  // RA-1 (P1). Goals scorers finish with a plain navigate() PUSH to the
  // tournament page, so Back from the tournament reopens the scorer of the match
  // that just finished. Sets scorers already route completion through
  // completeProtectedScoring (PR #128); goals, tennis-tournament and cricket do
  // not. Fix PR: "Back-stack: every scorer finishes through completeProtectedScoring".
  it.fails('RA-1: Back after finishing a goals tournament match does not reopen its scorer', async () => {
    seed('se_football', [footballTournament()]);
    renderApp(['/football/tournament/100', '/football/tournament/100/match/m1/score']);
    await settleRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(currentRoute()).toBe('/football/tournament/100'));

    await pressProbeBack();

    expect(currentRoute()).not.toBe('/football/tournament/100/match/m1/score');
  });

  // RA-2 (P1). Finishing a tennis quick match PUSHES /history. Back lands on the
  // scorer URL of the finished match, whose draft is gone: "Match not found",
  // inside the exit guard. Same fix PR as RA-1.
  it.fails('RA-2: Back after finishing a tennis quick match does not land on the dead scorer', async () => {
    seed(`se_tennis_quick_draft_${TENNIS_ID}`, {
      id: TENNIS_ID, sport: 'tennis', team1Name: 'Ana', team2Name: 'Bea',
      format: { sets: 3 }, status: 'in-progress', sets: null, updatedAt: NOW_ISO, createdAt: NOW_ISO,
      draftState: { currentSet: 2, sets: [wonTennisSet, wonTennisSet, blankTennisSet], history: [], savedAt: NOW_ISO },
    });
    renderApp(['/app', `/tennis/quick/live/${TENNIS_ID}`]);
    await settleRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(currentRoute()).toBe('/history'));

    await pressProbeBack();

    expect(currentRoute()).not.toBe(`/tennis/quick/live/${TENNIS_ID}`);
  });

  // RA-3 fixed: Home exposes the same resumable catalog as cold entry.
  it('RA-3: the Home dashboard offers a resume action for an in-progress quick draft', async () => {
    seed('se_quickmatch_draft_volleyball', {
      phase: 'scoring', sport: 'volleyball', team1Name: 'Sharks', team2Name: 'Jets',
      updatedAt: NOW_ISO, savedAt: NOW_ISO,
    });
    renderApp(['/app']);
    await settleRoute();

    expect(screen.getAllByRole('button', { name: /resume/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/first match/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    await waitFor(() => expect(currentRoute()).toBe('/volleyball/quick'));
  });

  it('RA-3: multiple matches land on Home and each Resume opens its own route', async () => {
    const cases = [
      { name: /resume.*tennis/i, path: `/tennis/quick/live/${TENNIS_ID}` },
      { name: /resume.*cricket/i, path: '/cricket/quick/test-match/123' },
      { name: /resume.*Sunday League/i, path: '/football/tournament/100' },
    ];
    for (const entry of cases) {
      seed(`se_tennis_quick_draft_${TENNIS_ID}`, {
        id: TENNIS_ID, sport: 'tennis', team1Name: 'Ana', team2Name: 'Bea',
        status: 'in-progress', format: { sets: 3 }, updatedAt: NOW_ISO,
      });
      seed('se_quickmatches', [{ id: 123, sport: 'cricket', team1: 'Red', team2: 'Blue', status: 'in-progress', format: { totalInnings: 4 }, updatedAt: NOW_ISO }]);
      seed('se_football', [footballTournament()]);
      renderApp(['/']);
      await settleRoute();
      expect(currentRoute()).toBe('/app');
      expect(screen.getAllByRole('button', { name: /resume/i })).toHaveLength(3);
      fireEvent.click(screen.getByRole('button', { name: entry.name }));
      await waitFor(() => expect(currentRoute()).toBe(entry.path));
      cleanup();
    }
  });

  it.each(['cricket', 'kabaddi', 'volleyball', 'badminton', 'football', 'basketball', 'tabletennis', 'hockey'])('RA-3: Resume restores the %s quick scorer', async (sport) => {
    seed(`se_quickmatch_draft_${sport}`, {
      phase: 'scoring', sport, team1Name: 'Sharks', team2Name: 'Jets',
      vScore1: 12, vScore2: 9, sets: [{ score1: 12, score2: 9, completed: false }],
      currentSet: 0, gScore1: 2, gScore2: 1, updatedAt: NOW_ISO,
    });
    renderApp(['/app']);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    await waitFor(() => expect(currentRoute()).toBe(`/${sport}/quick`));
    await settleRoute();
    expect(screen.queryByText('App route crashed')).not.toBeInTheDocument();
    expect(screen.getByText(/Resumed/)).toBeInTheDocument();
  });

  // RA-4 (P1). The cricket Test scorer renders "Loading..." forever when the
  // match id is unknown (stale resume link, deleted match), with the bottom nav
  // hidden and Back answering "Your unsaved scoring progress may be lost".
  // Fix PR: "Validate :id / :matchId routes: recovery instead of Loading".
  it.fails('RA-4: an unknown cricket Test match id shows a recovery screen, not endless Loading', async () => {
    renderApp(['/cricket/quick/test-match/999']);
    await settleRoute();

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
  });

  // RA-5 (P2). /:sport/quick is a protected scoring route by PATH, so the exit
  // guard is armed on the untouched setup form: Back (hardware or the in-app
  // arrow) asks "Leave this page? Your unsaved scoring progress may be lost."
  // before a single point exists. Fix PR: "Arm the exit guard from the scorer,
  // not from the URL".
  it.fails('RA-5: the scoring exit guard is not armed while a quick match is still in setup', async () => {
    renderApp(['/volleyball/quick']);
    await settleRoute();
    expect(screen.getByRole('button', { name: 'Start Volleyball' })).toBeInTheDocument();

    expect(nativeBack.install).not.toHaveBeenCalled();
  });

  // RA-6 (P2). The app-level ErrorBoundary around <Routes> never resets on
  // navigation. Once any route throws, every later in-app navigation keeps
  // showing "App route crashed" until a full reload. Fix PR: "Route error
  // boundary keyed by location".
  it.fails('RA-6: a crashed route clears when the user navigates to another screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    convexState.useQuery = () => { throw new Error('backend unavailable'); };
    renderApp(['/live/not-a-real-token']);
    expect(await screen.findByText('App route crashed')).toBeInTheDocument();

    convexState.useQuery = () => [];
    fireEvent.click(screen.getByRole('button', { name: 'Probe go history' }));
    await waitFor(() => expect(currentRoute()).toBe('/history'));
    await settleRoute();

    expect(screen.queryByText('App route crashed')).not.toBeInTheDocument();
  });

  // RA-7 (P2). Five copies of "find tournament + match from URL params" compare
  // ids differently. The dispatcher accepts a string tournament id; the goals
  // (and tennis) scorer only tries Number(id) and renders "Loading..." forever.
  // Fix PR: "Validate :id / :matchId routes" (one shared resolver).
  it.fails('RA-7: a tournament the dispatcher resolves also resolves inside the goals scorer', async () => {
    seed('se_football', [footballTournament('fx')]);
    renderApp(['/football/tournament/fx/match/m1/score']);
    await settleRoute();

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  // RA-9 (P2). getSportById is `SPORT_REGISTRY[id] || null` on a plain object,
  // so inherited keys pass every sport guard: /constructor/quick opens a quick
  // match for sport "Object" that can be started and saved. Fix PR: "Validate
  // :sport with an own-key lookup".
  it.fails('RA-9: an Object.prototype key is not accepted as a :sport slug', async () => {
    renderApp(['/constructor/quick']);
    await settleRoute();

    expect(screen.getByRole('heading', { name: 'This screen is not available' })).toBeInTheDocument();
  });

  // RA-8 (P2). MonoProfile's Back is navigate(-1) with no fallback. Opened from
  // a shared link (first history entry), Back leaves the app (browser) or does
  // nothing (Android WebView). Fix PR: "Back-stack: safe back helper".
  it.fails('RA-8: Back on a deep-linked "Profile not found" stays inside the app', async () => {
    authState.current = { ...GUEST, authMode: 'cloud', cloudAuthAvailable: true };
    convexState.useQuery = (_fn, args) => (args && args !== 'skip' && 'username' in args ? null : []);
    renderApp(['/profile/no-such-user']);
    expect(await screen.findByRole('heading', { name: 'Profile not found' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await settleRoute();

    expect(currentRoute()).not.toBe('/profile/no-such-user');
  });
});
