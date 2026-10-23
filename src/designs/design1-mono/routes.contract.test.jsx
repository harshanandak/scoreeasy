import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadAppRoutes } from '../../test/preloadAppRoutes';
import Design1Mono from './index';
import { getGoalsSports } from '../../models/sportRegistry';
import { cricketFinishSeed } from '../../test/cricketFinishFixtures';

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
      <button type="button" onClick={() => navigate(1)}>Probe forward</button>
      <button type="button" onClick={() => navigate('/history')}>Probe go history</button>
      <button type="button" onClick={() => navigate('/football/tournament/100')}>Probe tournament</button>
      <button type="button" onClick={() => navigate('/football/tournament/100/match/m1/score')}>Probe scorer</button>
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
  it.each(['limited', 'test-tournament', 'test-quick', 'guided'])('RA-1: Back after finishing %s cricket preserves the result and does not reopen its scorer', async (kind) => {
    Object.entries(cricketFinishSeed(kind)).forEach(([key, value]) => seed(key, value));
    const quick = kind === 'test-quick';
    const storageKey = quick ? 'se_quickmatches' : 'se_cricket';
    renderApp(['/history', quick ? '/cricket/quick/test-match/300' : '/cricket/tournament/100/match/m1/score']);
    await settleRoute();
    if (kind === 'guided') {
      fireEvent.click(await screen.findByRole('button', { name: 'Four' }));
    } else if (kind.startsWith('test')) {
      fireEvent.click(await screen.findByRole('button', { name: 'Four runs' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save & Return' }));
    } else {
      fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    }
    await waitFor(() => expect(currentRoute()).toBe(quick ? '/cricket/quick?result=300' : '/cricket/tournament/100'));
    if (quick) {
      expect(await screen.findByRole('region', { name: 'Match result' })).toHaveAttribute('data-screen', 'finish');
      expect(screen.getByText('Won by 10 wickets')).toBeInTheDocument();
    }
    const saved = JSON.parse(localStorage.getItem(storageKey));
    expect(quick ? saved[0] : saved[0].matches[0]).toMatchObject({ status: 'completed', winner: quick ? 'Beta' : 'B' });
    await pressProbeBack();
    await waitFor(() => expect(currentRoute()).toBe('/history'));
    expect(JSON.parse(localStorage.getItem(storageKey))).toEqual(saved);
    if (quick) {
      fireEvent.click(screen.getByRole('button', { name: 'Probe forward' }));
      expect(await screen.findByRole('region', { name: 'Match result' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Four runs' })).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(storageKey))).toEqual(saved);
    }
  });

  it('RA-1 cricket regression: limited-overs quick Finish preserves restored Undo and the saved innings through Back', async () => {
    const scores = { team1: { runs: 1, balls: 6, wickets: 0, allOut: false }, team2: { runs: 0, balls: 0, wickets: 0, allOut: false } };
    seed('se_quickmatch_draft_cricket', {
      sport: 'cricket', phase: 'scoring', team1Name: 'Alpha', team2Name: 'Beta',
      format: { preset: 'custom', overs: 1, players: 11, totalInnings: 2, trackOvers: true },
      innings: 2, battingTeam: 2, scores: { ...scores, team2: { ...scores.team2, runs: 1, balls: 1 } },
      cricketHistory: [{ type: 'runs', key: 'team2', value: 1, innings: 2, battingTeam: 2 }], updatedAt: NOW_ISO,
    });
    renderApp(['/app', '/cricket/quick']);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    fireEvent.click(screen.getByRole('button', { name: 'Four runs' }));
    expect(await screen.findByText('Match saved to History on this device.')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('se_quickmatches'));
    expect(saved).toEqual([expect.objectContaining({ sport: 'cricket', winner: 'Beta' })]);
    expect(saved[0].team1Score).toMatchObject({ runs: 1, balls: 6 });
    expect(saved[0].team2Score).toMatchObject({ runs: 4, balls: 1 });
    await pressProbeBack();
    await waitFor(() => expect(currentRoute()).toBe('/app'));
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual(saved);
  });

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

describe('route contracts: goals completion (RA-1/RA-2)', () => {
  it('cannot reopen a completed football match through browser Forward and score into a draft', async () => {
    seed('se_football', [footballTournament()]);
    globalThis.history.replaceState({ idx: 0 }, '', '/history');
    render(<BrowserRouter><RouterProbe /><Design1Mono /></BrowserRouter>);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Probe tournament' }));
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Probe scorer' }));
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 point to Red' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(currentRoute()).toBe('/football/tournament/100'));
    const finished = JSON.parse(localStorage.getItem('se_football'));
    await act(async () => {
      const popped = new Promise(resolve => globalThis.addEventListener('popstate', resolve, { once: true }));
      globalThis.history.forward();
      await popped;
    });
    await settleRoute();
    const score = screen.queryByRole('button', { name: 'Add 1 point to Red' });
    if (score) fireEvent.click(score);
    fireEvent.keyDown(globalThis, { key: 'q' });
    expect(JSON.parse(localStorage.getItem('se_football'))).toEqual(finished);
    await waitFor(() => expect(currentRoute()).toBe('/football/tournament/100'));
    expect(screen.queryByRole('button', { name: 'Add 1 point to Red' })).not.toBeInTheDocument();
  });

  it('reuses the unwound tournament entry so one Back leaves it', async () => {
    seed('se_football', [footballTournament()]);
    globalThis.history.replaceState({ idx: 0 }, '', '/history');
    render(<BrowserRouter><RouterProbe /><Design1Mono /></BrowserRouter>);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Probe tournament' }));
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Probe scorer' }));
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 point to Red' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(currentRoute()).toBe('/football/tournament/100'));
    await pressProbeBack();
    await waitFor(() => expect(currentRoute()).toBe('/history'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('covers every registered goals-engine sport', () => {
    expect(getGoalsSports().map(({ id }) => id).sort()).toEqual(['basketball', 'football', 'hockey', 'kabaddi']);
  });

  it.each(getGoalsSports())('RA-1: $id tournament Finish saves the result and Back does not reopen the scorer', async ({ id: sport, storageKey }) => {
    const tournament = footballTournament();
    tournament.matches[0].draftState = {
      score1: 3, score2: 1, history: [{ score1: 2, score2: 1 }], savedAt: NOW_ISO,
    };
    seed(storageKey, [tournament]);
    const tournamentPath = `/${sport}/tournament/100`;
    renderApp([tournamentPath, `${tournamentPath}/match/m1/score`]);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(currentRoute()).toBe(tournamentPath));

    await pressProbeBack();

    expect(currentRoute()).toBe(tournamentPath);
    expect(JSON.parse(localStorage.getItem(storageKey))[0].matches[0]).toMatchObject({
      status: 'completed', score1: 2, score2: 1, winner: 't1',
    });
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
  });

  // Goals quick matches already finish in place in MonoQuickMatch. Pin that
  // separate path; tennis and cricket completion have their own contracts.
  it.each(getGoalsSports())('RA-2 goals regression: $id quick Finish preserves Undo and the saved result through Back', async ({ id: sport }) => {
    seed(`se_quickmatch_draft_${sport}`, {
      sport, phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', format: { mode: 'free' },
      gScore1: 3, gScore2: 1, gScoreHistory: [{ team: 1, value: 1 }],
      updatedAt: NOW_ISO, savedAt: NOW_ISO,
    });
    renderApp(['/app', `/${sport}/quick`]);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
    expect(await screen.findByText('Match saved to History on this device.')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('se_quickmatches'));
    expect(saved).toEqual([expect.objectContaining({ sport, score1: 2, score2: 1, winner: 'Red' })]);
    expect(localStorage.getItem(`se_quickmatch_draft_${sport}`)).toBeNull();
    await pressProbeBack();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
    expect(localStorage.getItem('se_quickmatches')).toBe(JSON.stringify(saved));
  });
});

describe('route contracts: audit findings (open findings retain it.fails)', () => {
  // Tennis completion unwinds the scorer and its exit guard (RA-1/RA-2).
  it('RA-1: Back after finishing a tennis tournament match does not reopen its scorer', async () => {
    const tournament = footballTournament();
    tournament.name = 'Tennis Cup';
    tournament.format = { sets: 3 };
    tournament.matches[0].draftState = {
      currentSet: 2, sets: [wonTennisSet, wonTennisSet, blankTennisSet], history: [], savedAt: NOW_ISO,
    };
    seed('se_tennis', [tournament]);
    renderApp(['/tennis/tournament/100', '/tennis/tournament/100/match/m1/score']);
    await settleRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(currentRoute()).toBe('/tennis/tournament/100'));

    await pressProbeBack();

    expect(currentRoute()).toBe('/tennis/tournament/100');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('se_tennis'))[0].matches[0];
    expect(saved).toMatchObject({ status: 'completed', winner: 't1', sets: [{ score1: 6, score2: 0, completed: true }, { score1: 6, score2: 0, completed: true }, { score1: 0, score2: 0, completed: false }] });
    expect(screen.queryByRole('heading', { name: 'Tennis match scorer' })).not.toBeInTheDocument();
  });

  it('RA-2: Back after finishing a tennis quick match does not land on the dead scorer', async () => {
    seed(`se_tennis_quick_draft_${TENNIS_ID}`, {
      id: TENNIS_ID, sport: 'tennis', team1Name: 'Ana', team2Name: 'Bea',
      format: { sets: 3 }, status: 'in-progress', sets: null, updatedAt: NOW_ISO, createdAt: NOW_ISO,
      draftState: { currentSet: 2, sets: [wonTennisSet, wonTennisSet, blankTennisSet], history: [], savedAt: NOW_ISO },
    });
    renderApp(['/app', `/tennis/quick/live/${TENNIS_ID}`]);
    await settleRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(currentRoute()).toBe(`/tennis/quick?result=${TENNIS_ID}`));
    expect(await screen.findByRole('region', { name: 'Match result' })).toHaveAttribute('data-screen', 'finish');
    expect(screen.getByText('Took the last set 6–0')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('se_quickmatches'));

    await pressProbeBack();

    expect(currentRoute()).not.toBe(`/tennis/quick/live/${TENNIS_ID}`);
    expect(screen.queryByRole('heading', { name: 'Match not found' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
    expect(localStorage.getItem(`se_tennis_quick_draft_${TENNIS_ID}`)).toBeNull();
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0]).toMatchObject({
      sport: 'tennis', status: 'completed', setsWon1: 2, setsWon2: 0,
      sets: [{ score1: 6, score2: 0, completed: true }, { score1: 6, score2: 0, completed: true }, { score1: 0, score2: 0, completed: false }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Probe forward' }));
    expect(await screen.findByRole('region', { name: 'Match result' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual(saved);
  });

  it.each(['quick', 'tournament'])('tennis %s keeps the saved draft and Undo history across a remount', async (mode) => {
    const sets = [wonTennisSet, { ...blankTennisSet, games1: 5, points1: 2 }, blankTennisSet];
    const priorSets = [wonTennisSet, { ...blankTennisSet, games1: 5, points1: 1 }, blankTennisSet];
    const history = [{ currentSet: 1, sets: priorSets, timestamp: Date.now() - 1000 }];
    const path = mode === 'quick' ? `/tennis/quick/live/${TENNIS_ID}` : '/tennis/tournament/100/match/m1/score';
    if (mode === 'quick') {
      seed(`se_tennis_quick_draft_${TENNIS_ID}`, {
        id: TENNIS_ID, sport: 'tennis', team1Name: 'Ana', team2Name: 'Bea',
        format: { sets: 3 }, status: 'in-progress', updatedAt: NOW_ISO,
        draftState: { currentSet: 1, sets, history, savedAt: NOW_ISO },
      });
    } else {
      const tournament = footballTournament();
      tournament.name = 'Tennis Cup';
      tournament.teams[0].name = 'Ana';
      tournament.teams[1].name = 'Bea';
      tournament.format = { sets: 3 };
      tournament.matches[0].draftState = { currentSet: 1, sets, history, savedAt: NOW_ISO };
      seed('se_tennis', [tournament]);
    }
    const savedDraft = () => mode === 'quick'
      ? JSON.parse(localStorage.getItem(`se_tennis_quick_draft_${TENNIS_ID}`)).draftState
      : JSON.parse(localStorage.getItem('se_tennis'))[0].matches[0].draftState;
    renderApp(['/app', path]);
    await settleRoute();
    fireEvent.click(await screen.findByRole('button', { name: /^Ana: 30/ }));
    await waitFor(() => expect(savedDraft().sets[1].points1).toBe(3));
    expect(savedDraft().history).toHaveLength(2);
    expect(savedDraft().history[1].sets).toEqual(sets);
    cleanup();

    renderApp(['/app', path]);
    await settleRoute();
    expect(await screen.findByRole('button', { name: /^Ana: 40/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    await waitFor(() => expect(savedDraft().sets).toEqual(sets));
    expect(savedDraft().history).toEqual(history);
    expect(screen.getByRole('button', { name: /^Ana: 30/ })).toBeEnabled();
  });

  it.each(['tennis', 'cricket'])('%s quick Finish refreshes safely and Rematch starts its own engine with the saved setup', async sport => {
    const format = sport === 'tennis' ? { sets: 3 } : { preset: 'test', players: 11, totalInnings: 4, overs: null };
    const finished = {
      id: 300, sport, status: 'completed', team1: 'Alpha', team2: 'Beta', team1Name: 'Alpha', team2Name: 'Beta',
      team1Id: 'A', team2Id: 'B', team1Color: '#123456', team2Color: '#654321', format,
      winner: 'Alpha', winDesc: 'Won by 1 run', completedAt: NOW_ISO, score1: 2, score2: 0,
      sets: [{ score1: 6, score2: 4, completed: true }, { score1: 6, score2: 2, completed: true }],
      innings: [{ teamId: 'A', runs: 2, wickets: 10, balls: 6 }, { teamId: 'B', runs: 1, wickets: 10, balls: 6 }],
    };
    seed('se_quickmatches', [finished]);
    const first = renderApp([`/${sport}/quick?result=300`]);
    expect(await screen.findByRole('region', { name: 'Match result' })).toBeInTheDocument();
    first.unmount();
    renderApp([`/${sport}/quick?result=300`]);
    expect(await screen.findByRole('region', { name: 'Match result' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual([finished]);
    expect(localStorage.getItem(`se_quickmatch_draft_${sport}`)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    await waitFor(() => expect(currentRoute()).toMatch(sport === 'tennis' ? /^\/tennis\/quick\/live\// : /^\/cricket\/quick\/test-match\//));
    const nextId = currentRoute().split('/').pop();
    const fresh = sport === 'tennis' ? JSON.parse(localStorage.getItem(`se_tennis_quick_draft_${nextId}`))
      : JSON.parse(localStorage.getItem('se_quickmatches')).find(m => String(m.id) === nextId);
    expect(fresh).toMatchObject({ team1Name: 'Alpha', team2Name: 'Beta', team1Color: '#123456', team2Color: '#654321', format, status: 'in-progress' });
    expect(JSON.parse(localStorage.getItem('se_quickmatches')).find(m => m.id === 300)).toEqual(finished);
  });

  it.each(['tennis', 'cricket'])('a completed %s quick scorer deep link opens Finish without rewriting its saved result', async sport => {
    const saved = {
      ...cricketFinishSeed('test-quick').se_quickmatches[0], sport, status: 'completed', winner: 'Draw', winDesc: 'Match Drawn',
      completedAt: NOW_ISO, draftState: undefined,
    };
    seed('se_quickmatches', [saved]);
    renderApp([sport === 'tennis' ? '/tennis/quick/live/300' : '/cricket/quick/test-match/300']);
    expect(await screen.findByRole('region', { name: 'Match result' })).toBeInTheDocument();
    expect(currentRoute()).toBe(`/${sport}/quick?result=300`);
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual([JSON.parse(JSON.stringify(saved))]);
    expect(screen.queryByRole('button', { name: 'Four runs' })).not.toBeInTheDocument();
  });

  it.each(['missing', 'wrong-sport', 'unfinished'])('rejects a %s quick result link without changing any saved match or draft', async kind => {
    const match = cricketFinishSeed('test-quick').se_quickmatches[0];
    match.winner = null;
    if (kind !== 'unfinished') {
      match.status = 'completed';
      match.completedAt = NOW_ISO;
      delete match.draftState;
    } else {
      match.sport = 'tennis';
    }
    seed('se_quickmatches', [match]);
    const draft = { sport: 'tennis', phase: 'scoring', team1Name: 'Do not change', quickMatchId: 100 };
    seed('se_quickmatch_draft_tennis', draft);
    renderApp([`/tennis/quick?result=${kind === 'missing' ? '999' : '300'}`]);
    await waitFor(() => expect(currentRoute()).toBe('/history'));
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual([match]);
    expect(JSON.parse(localStorage.getItem('se_quickmatch_draft_tennis'))).toEqual(draft);
  });

  it('New Match after Test Finish keeps the displayed format consistent with the scorer it starts', async () => {
    const match = { ...cricketFinishSeed('test-quick').se_quickmatches[0], status: 'completed', winner: 'Draw',
      completedAt: NOW_ISO, draftState: undefined };
    seed('se_quickmatches', [match]);
    renderApp(['/cricket/quick?result=300']);
    fireEvent.click(await screen.findByRole('button', { name: 'New Match' }));
    expect(currentRoute()).toBe('/cricket/quick');
    expect(screen.getByRole('button', { name: 'Test' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Start cricket' }));
    await waitFor(() => expect(currentRoute()).toMatch(/^\/cricket\/quick\/test-match\//));
  });

  it.each(['tennis', 'cricket'])('a failed %s Rematch preserves the completed result and permits retry', async sport => {
    const match = { ...cricketFinishSeed('test-quick').se_quickmatches[0], sport, status: 'completed', winner: 'Alpha',
      completedAt: NOW_ISO, draftState: undefined, score1: 2, score2: 0,
      sets: [{ score1: 6, score2: 4, completed: true }, { score1: 6, score2: 2, completed: true }] };
    seed('se_quickmatches', [match]);
    renderApp([`/${sport}/quick?result=300`]);
    expect(await screen.findByRole('heading', { name: /winner: alpha/i })).toBeInTheDocument();
    const write = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (sport === 'tennis' ? key.startsWith('se_tennis_quick_draft_') : key === 'se_quickmatches') {
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return write.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(screen.getByRole('heading', { name: /winner: alpha/i })).toBeInTheDocument();
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    expect(currentRoute()).toBe(`/${sport}/quick?result=300`);
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual([JSON.parse(JSON.stringify(match))]);
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    await waitFor(() => expect(currentRoute()).toMatch(sport === 'tennis' ? /^\/tennis\/quick\/live\// : /^\/cricket\/quick\/test-match\//));
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
  // match id is unknown (stale resume link, deleted match). Guard activation
  // is covered separately by the first-score contracts.
  // Fix PR: "Validate :id / :matchId routes: recovery instead of Loading".
  it.fails('RA-4: an unknown cricket Test match id shows a recovery screen, not endless Loading', async () => {
    renderApp(['/cricket/quick/test-match/999']);
    await settleRoute();

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
  });

  // RA-5 fixed: setup does not arm the app-owned guard. The first-score
  // contracts below cover its activation across the quick/tournament scorers.
  it('RA-5: the scoring exit guard is not armed while a quick match is still in setup', async () => {
    renderApp(['/volleyball/quick']);
    await settleRoute();
    expect(screen.getByRole('button', { name: 'Start volleyball' })).toBeInTheDocument();

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

  // RA-9 is fixed by the own-key registry lookup used by sport routes and live links.
  it('RA-9: an Object.prototype key is not accepted as a :sport slug', async () => {
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

describe('navigation decisions (2026-10-21)', () => {
  it.each(['brand', 'header', 'bottom'])('%s Home goes to /app even with one resumable draft', async surface => {
    seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', gScore1: 1, updatedAt: NOW_ISO });
    renderApp(['/history']);
    await settleRoute();
    const target = surface === 'brand' ? document.querySelector('.global-nav-brand')
      : within(document.querySelector(surface === 'header' ? '.global-nav-links' : '.global-bottom-nav')).getByRole('button', { name: 'Home', hidden: surface === 'bottom' });
    fireEvent.click(target);
    await waitFor(() => expect(currentRoute()).toBe('/app'));
  });

  it('quick cricket arms on a dot ball', async () => {
    seed('se_quickmatch_draft_cricket', { sport: 'cricket', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', format: { preset: 'custom', overs: 1, totalInnings: 2, players: 11, trackOvers: true }, updatedAt: NOW_ISO });
    renderApp(['/cricket/quick']);
    await settleRoute();
    expect(nativeBack.install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '0 runs' }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
  });

  it.each(['quick', 'tournament'])('tennis %s arms on its first point', async mode => {
    const draftState = { currentSet: 0, sets: [{ ...blankTennisSet }], history: [] };
    if (mode === 'quick') seed(`se_tennis_quick_draft_${TENNIS_ID}`, { id: TENNIS_ID, sport: 'tennis', team1Name: 'Red', team2Name: 'Blue', format: { sets: 1 }, status: 'in-progress', draftState, updatedAt: NOW_ISO });
    else {
      const tournament = footballTournament();
      tournament.format = { sets: 1 };
      tournament.matches[0].draftState = draftState;
      seed('se_tennis', [tournament]);
    }
    renderApp([mode === 'quick' ? `/tennis/quick/live/${TENNIS_ID}` : '/tennis/tournament/100/match/m1/score']);
    await settleRoute();
    expect(nativeBack.install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Red: / }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
  });

  it.each(['limited', 'test-tournament', 'test-quick', 'guided'])('cricket %s arms on the first recorded ball', async kind => {
    const entries = cricketFinishSeed(kind);
    const match = kind === 'test-quick' ? entries.se_quickmatches[0] : entries.se_cricket[0].matches[0];
    const zero = { runs: 0, balls: 0, wickets: 0, allOut: false };
    if (kind.startsWith('test')) match.draftState = { currentInningsIndex: 0, history: [], innings: [{ ...zero, teamId: 'A' }, { ...zero, teamId: 'B' }, { ...zero, teamId: 'A' }, { ...zero, teamId: 'B' }] };
    else if (kind === 'guided') { match.team1Score = zero; match.draftState = { phase: 'innings1', openers1: { striker: 'Batter 1', nonStriker: 'Batter 2', bowler: 'Bowler' } }; }
    else match.draftState = { innings: 1, battingTeam: 1, history: [], scores: { team1: { ...zero }, team2: { ...zero } } };
    Object.entries(entries).forEach(([key, value]) => seed(key, value));
    renderApp([kind === 'test-quick' ? '/cricket/quick/test-match/300' : '/cricket/tournament/100/match/m1/score']);
    await settleRoute();
    expect(nativeBack.install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: kind === 'guided' ? 'Dot' : kind === 'limited' ? '0' : '0 runs', exact: true }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
  });

  const ordinarySports = ['volleyball', 'badminton', 'tabletennis', 'football', 'basketball', 'hockey', 'kabaddi'];

  it.each(ordinarySports)('Round 2: %s quick keeps its guard after scoring, Undo to zero and remount', async sport => {
    const goals = getGoalsSports().some(config => config.id === sport);
    const key = `se_quickmatch_draft_${sport}`;
    seed(key, { sport, phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', format: goals ? { mode: 'free' } : { sets: 3, pointsPerSet: 25 }, updatedAt: NOW_ISO });
    const view = renderApp([`/${sport}/quick`]);
    await settleRoute();
    if (sport === 'kabaddi') fireEvent.click(screen.getByRole('button', { name: 'Add +1 for Red' }));
    else if (sport === 'basketball') fireEvent.click(screen.getByRole('button', { name: 'Add +1 for Red' }));
    else fireEvent.click(screen.getByRole('button', { name: goals ? 'Add 1 to Red' : 'Add point for Red' }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    const saved = JSON.parse(localStorage.getItem(key));
    expect(goals ? saved.gScore1 : saved.vScore1).toBe(0);
    view.unmount();
    nativeBack.install.mockClear();
    renderApp([`/${sport}/quick`]);
    await settleRoute();
    fireEvent.click(document.querySelector('.global-nav-brand'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Leave this page?');
    expect(JSON.parse(localStorage.getItem(key)).scoringStarted).toBe(true);
  });

  it.each(['privacy', 'terms', 'contact'])('Round 2: legal %s brand opens /app with one resumable draft', async page => {
    seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', gScore1: 1, updatedAt: NOW_ISO });
    renderApp([`/${page}`]);
    await settleRoute();
    fireEvent.click(screen.getByRole('link', { name: 'SCORE EASY' }));
    await waitFor(() => expect(currentRoute()).toBe('/app'));
  });

  async function remountAndCheckGuard(view, path) {
    view.unmount();
    nativeBack.install.mockClear();
    renderApp([path]);
    await settleRoute();
    fireEvent.click(document.querySelector('.global-nav-brand'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Leave this page?');
  }

  it.each(ordinarySports)('Round 2: %s tournament persists the final Undo and guard through remount', async sport => {
    const goals = getGoalsSports().some(config => config.id === sport);
    const tournament = footballTournament();
    tournament.format = goals ? { mode: 'free' } : { sets: 3, pointsPerSet: 25 };
    seed(`se_${sport}`, [tournament]);
    const path = `/${sport}/tournament/100/match/m1/score`;
    const view = renderApp([path]);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: goals ? 'Add 1 point to Red' : /^Red: / }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    const saved = JSON.parse(localStorage.getItem(`se_${sport}`))[0].matches[0].draftState;
    expect(goals ? saved.score1 : saved.sets[0].score1).toBe(0);
    expect(saved.history).toEqual([]);
    await remountAndCheckGuard(view, path);
  });

  it.each(['quick', 'tournament'])('Round 2: tennis %s keeps its guard after Undo to zero and remount', async mode => {
    const draftState = { currentSet: 0, sets: [{ ...blankTennisSet }], history: [] };
    if (mode === 'quick') seed(`se_tennis_quick_draft_${TENNIS_ID}`, { id: TENNIS_ID, sport: 'tennis', team1Name: 'Red', team2Name: 'Blue', format: { sets: 1 }, status: 'in-progress', draftState, updatedAt: NOW_ISO });
    else {
      const tournament = footballTournament();
      tournament.format = { sets: 1 };
      tournament.matches[0].draftState = draftState;
      seed('se_tennis', [tournament]);
    }
    const path = mode === 'quick' ? `/tennis/quick/live/${TENNIS_ID}` : '/tennis/tournament/100/match/m1/score';
    const view = renderApp([path]);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: /^Red: / }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action', exact: true }));
    const saved = mode === 'quick' ? JSON.parse(localStorage.getItem(`se_tennis_quick_draft_${TENNIS_ID}`)) : JSON.parse(localStorage.getItem('se_tennis'))[0].matches[0];
    expect(saved.draftState.sets[0].points1).toBe(0);
    expect(saved.draftState.history).toEqual([]);
    await remountAndCheckGuard(view, path);
  });

  it.each(['quick', 'limited', 'test-tournament', 'test-quick', 'guided'])('Round 2: cricket %s keeps its guard after Undo of its first dot ball and remount', async kind => {
    const zero = { runs: 0, balls: 0, wickets: 0, allOut: false };
    if (kind === 'quick') seed('se_quickmatch_draft_cricket', { sport: 'cricket', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', format: { preset: 'custom', overs: 1, totalInnings: 2, players: 11, trackOvers: true }, updatedAt: NOW_ISO });
    else {
      const entries = cricketFinishSeed(kind);
      const match = kind === 'test-quick' ? entries.se_quickmatches[0] : entries.se_cricket[0].matches[0];
      if (kind.startsWith('test')) match.draftState = { currentInningsIndex: 0, history: [], innings: [{ ...zero, teamId: 'A' }, { ...zero, teamId: 'B' }, { ...zero, teamId: 'A' }, { ...zero, teamId: 'B' }] };
      else if (kind === 'guided') { match.team1Score = { ...zero }; match.draftState = { phase: 'innings1', openers1: { striker: 'Batter 1', nonStriker: 'Batter 2', bowler: 'Bowler' } }; }
      else match.draftState = { innings: 1, battingTeam: 1, history: [], scores: { team1: { ...zero }, team2: { ...zero } } };
      Object.entries(entries).forEach(([key, value]) => seed(key, value));
    }
    const path = kind === 'quick' ? '/cricket/quick' : kind === 'test-quick' ? '/cricket/quick/test-match/300' : '/cricket/tournament/100/match/m1/score';
    const view = renderApp([path]);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: kind === 'guided' ? 'Dot' : kind === 'limited' ? '0' : '0 runs', exact: true }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    const saved = kind === 'quick' ? JSON.parse(localStorage.getItem('se_quickmatch_draft_cricket')) : kind === 'test-quick' ? JSON.parse(localStorage.getItem('se_quickmatches'))[0] : JSON.parse(localStorage.getItem('se_cricket'))[0].matches[0];
    if (kind === 'quick') expect(saved.scores.team1.balls).toBe(0);
    else if (kind === 'guided') expect(saved.draftState.guidedInnings.deliveries).toEqual([]);
    else if (kind.startsWith('test')) expect(saved.draftState.innings[0].balls).toBe(0);
    else expect(saved.draftState.scores.team1.balls).toBe(0);
    await remountAndCheckGuard(view, path);
  });

  it('Round 2: football draft resume restores the latch independently of its empty score and history', async () => {
    seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', format: { mode: 'free' }, updatedAt: NOW_ISO });
    const view = renderApp(['/football/quick']);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Red' }));
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    view.unmount();
    renderApp(['/app']);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: /resume/i }));
    await settleRoute();
    fireEvent.click(document.querySelector('.global-nav-brand'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Leave this page?');
  });

  it.each(['Rematch', 'New Match'])('Round 2: %s clears the latch and stays unguarded after remount', async action => {
    seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', gScore1: 1, format: { mode: 'free' }, updatedAt: NOW_ISO });
    const view = renderApp(['/football/quick']);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
    fireEvent.click(await screen.findByRole('button', { name: action, exact: true }));
    const draft = JSON.parse(localStorage.getItem('se_quickmatch_draft_football'));
    if (action === 'Rematch') expect(draft.scoringStarted).toBe(false);
    else expect(draft).toBeNull();
    view.unmount();
    renderApp(['/football/quick']);
    await settleRoute();
    fireEvent.click(document.querySelector('.global-nav-brand'));
    await waitFor(() => expect(currentRoute()).toBe('/app'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['break', 'innings2'])('Round 2: guided cricket restores its match latch during %s without current deliveries', async phase => {
    const entries = cricketFinishSeed('guided');
    const match = entries.se_cricket[0].matches[0];
    match.team1Score = { runs: 0, balls: 0, wickets: 0, allOut: false };
    match.draftState = { phase, scoringStarted: true, target: 1, openers2: { striker: 'Batter 1', nonStriker: 'Batter 2', bowler: 'Bowler' } };
    Object.entries(entries).forEach(([key, value]) => seed(key, value));
    renderApp(['/cricket/tournament/100/match/m1/score']);
    await settleRoute();
    fireEvent.click(document.querySelector('.global-nav-brand'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Leave this page?');
  });

  it.each(ordinarySports.flatMap(sport => ['quick', 'tournament'].map(mode => ({ sport, mode }))))('$sport $mode arms only after its first point and stays armed after Undo', async ({ sport, mode }) => {
    const goals = getGoalsSports().some(config => config.id === sport);
    const tournament = footballTournament();
    tournament.format = goals ? { mode: 'free' } : { sets: 3, pointsPerSet: 25 };
    if (mode === 'quick') {
      seed(`se_quickmatch_draft_${sport}`, { sport, phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', format: tournament.format, updatedAt: NOW_ISO });
    } else seed(`se_${sport}`, [tournament]);
    renderApp([mode === 'quick' ? `/${sport}/quick` : `/${sport}/tournament/100/match/m1/score`]);
    await settleRoute();
    expect(nativeBack.install).not.toHaveBeenCalled();
    const score = goals
      ? (mode === 'quick' ? 'Add 1 to Red' : 'Add 1 point to Red')
      : (mode === 'quick' ? 'Add point for Red' : /^Red: /);
    if (mode === 'quick' && sport === 'kabaddi') {
      fireEvent.click(screen.getByRole('button', { name: 'Add +1 for Red' }));
    } else if (mode === 'quick' && sport === 'basketball') {
      fireEvent.click(screen.getByRole('button', { name: 'Add +1 for Red' }));
    } else fireEvent.click(screen.getByRole('button', { name: score }));
    await waitFor(() => expect(nativeBack.install).toHaveBeenCalled());
    const installs = nativeBack.install.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(nativeBack.install.mock.calls.length).toBe(installs);
    fireEvent.click(document.querySelector('.global-nav-brand'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Leave this page?');
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
  });

  it.each(['/history', '/volleyball/tournament', '/volleyball/tournament/new', '/this/does/not/exist'])('Home from %s opens the dashboard even with one resumable draft', async (path) => {
    seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', gScore1: 1, updatedAt: NOW_ISO });
    renderApp([path]);
    await settleRoute();
    const home = screen.getAllByRole('button', { name: /^(Home|Go back to home)$/i });
    fireEvent.click(home[home.length - 1]);
    await waitFor(() => expect(currentRoute()).toBe('/app'));
  });

  it.each(['volleyball', 'badminton', 'tabletennis', 'football', 'basketball', 'hockey', 'kabaddi', 'cricket', 'tennis'])('%s setup leaves without a guard and shows bottom navigation', async (sport) => {
    renderApp([`/${sport}/quick`]);
    await settleRoute();
    expect(nativeBack.install).not.toHaveBeenCalled();
    expect(document.querySelector('.global-bottom-nav')).toBeInTheDocument();
  });

  it('tournament results hide Rematch and return to their tournament', async () => {
    const tournament = footballTournament();
    tournament.matches[0] = { ...tournament.matches[0], status: 'completed', winner: 't1', sets: [{ score1: 25, score2: 12, completed: true }] };
    seed('se_volleyball', [tournament]);
    renderApp(['/volleyball/tournament/100/match/m1/result']);
    await settleRoute();
    expect(screen.getByRole('region', { name: 'Match result' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rematch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(currentRoute()).toBe('/volleyball/tournament/100'));
  });

  it('quick results keep Rematch and its fresh scorer leaves without warning', async () => {
    seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', gScore1: 1, gScore2: 0, format: { mode: 'free' }, updatedAt: NOW_ISO });
    renderApp(['/football/quick']);
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rematch' }));
    expect(document.querySelector('.global-bottom-nav')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.global-nav-brand'));
    await waitFor(() => expect(currentRoute()).toBe('/app'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Rematch does not queue navigation before a fresh point can arm the guard', async () => {
    const historyGo = vi.spyOn(globalThis.history, 'go').mockImplementation(() => {});
    try {
      seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', gScore1: 1, gScore2: 0, format: { mode: 'free' }, updatedAt: NOW_ISO });
      renderApp(['/football/quick']);
      await settleRoute();
      fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Rematch' }));
      expect(historyGo).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Red' }));
      await act(async () => {});
      act(() => globalThis.dispatchEvent(new Event('popstate')));
      expect(screen.getByRole('dialog')).toHaveTextContent('Leave this page?');
    } finally {
      historyGo.mockRestore();
    }
  });

  it('a native Back event after Test Finish does not unwind the consumed scorer guard again', async () => {
    const historyGo = vi.spyOn(globalThis.history, 'go').mockImplementation(() => {});
    const historyBack = vi.spyOn(globalThis.history, 'back').mockImplementation(() => {});
    try {
      Object.entries(cricketFinishSeed('test-quick')).forEach(([key, value]) => seed(key, value));
      globalThis.history.replaceState({ idx: 1 }, '', '/cricket/quick/test-match/300');
      renderApp(['/history', '/cricket/quick/test-match/300']);
      await settleRoute();
      fireEvent.click(await screen.findByRole('button', { name: 'Four runs' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save & Return' }));
      expect(historyGo).toHaveBeenCalled();
      act(() => globalThis.dispatchEvent(new Event('popstate')));
      expect(await screen.findByRole('region', { name: 'Match result' })).toBeInTheDocument();
      expect(currentRoute()).toBe('/cricket/quick?result=300');
      const saved = JSON.parse(localStorage.getItem('se_quickmatches'));
      historyGo.mockClear();
      historyBack.mockClear();
      act(() => globalThis.dispatchEvent(new Event('popstate')));
      expect(historyGo).not.toHaveBeenCalled();
      expect(historyBack).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual(saved);
    } finally {
      historyGo.mockRestore();
      historyBack.mockRestore();
    }
  });

  it('a result query on a nested quick scorer still protects the active match', async () => {
    Object.entries(cricketFinishSeed('test-quick')).forEach(([key, value]) => seed(key, value));
    renderApp(['/cricket/quick/test-match/300?result=300']);
    await settleRoute();
    expect(nativeBack.install).toHaveBeenCalled();
    act(() => globalThis.dispatchEvent(new Event('popstate')));
    expect(screen.getByRole('dialog')).toHaveTextContent('Leave this page?');
  });

  it('Back on an unscored Rematch unwinds the previous guard without a warning', async () => {
    const historyGo = vi.spyOn(globalThis.history, 'go').mockImplementation(() => {});
    const historyBack = vi.spyOn(globalThis.history, 'back').mockImplementation(() => {});
    try {
      seed('se_quickmatch_draft_football', { sport: 'football', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue', gScore1: 1, gScore2: 0, format: { mode: 'free' }, updatedAt: NOW_ISO });
      renderApp(['/football/quick']);
      await settleRoute();
      fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Rematch' }));
      expect(historyGo).not.toHaveBeenCalled();
      expect(historyBack).not.toHaveBeenCalled();
      act(() => globalThis.dispatchEvent(new Event('popstate')));
      expect(historyGo.mock.calls.length + historyBack.mock.calls.length).toBeGreaterThan(0);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      historyGo.mockRestore();
      historyBack.mockRestore();
    }
  });
});
