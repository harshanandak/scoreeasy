import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// scoreeasy-m39: a Test match must NOT end on the first scoring stroke of the
// 3rd innings just because the side batting third already leads on aggregate.
// The match only completes at the END of the 3rd innings, and only when the
// side due to bat last is already ahead (a follow-on innings victory). These
// tests drive the REAL component's checkResult/advanceInnings path by rendering
// it and recording a single delivery from a pre-seeded 3rd-innings draftState —
// they are not calls to getTestMatchResult.

const h = vi.hoisted(() => ({
  saveSpy: vi.fn(() => true),
  CURRENT_DRAFT: null,
  makeTournament: (draftState) => ({
    id: 1,
    teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
    matches: [{
      id: 'm1', team1Id: 1, team2Id: 2,
      format: {
        preset: 'test', overs: null, players: 11, solo: false,
        totalInnings: 4, trackOvers: true, freeHit: false,
        powerplay: [], lastManStands: false, trialBall: false,
        oneTipOneHand: false, declaration: true, followOn: true,
      },
      draftState,
    }],
    knockoutMatches: [],
  }),
}));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ sport: 'cricket', id: '1', matchId: 'm1' }),
  useLocation: () => ({ pathname: '/cricket/1/m1', search: '' }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../utils/storage', () => ({
  loadSportTournaments: () => [h.makeTournament(h.CURRENT_DRAFT)],
  saveSportTournament: h.saveSpy,
  saveQuickMatch: vi.fn(() => true),
  loadQuickMatch: vi.fn(),
  deleteQuickMatch: vi.fn(),
  // The live-broadcast path (useLiveBroadcast/outbox + getConsent) reads these;
  // returning the default keeps consent unset so broadcasting stays OFF in tests.
  loadData: vi.fn((_key, def) => def),
  saveData: vi.fn(() => true),
}));

// The scorer computes isTouchDevice once at module load; force a non-touch
// environment so the keyboard handler attaches in jsdom.
try { delete globalThis.ontouchstart; } catch { /* ignore */ }
try {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
} catch { /* ignore */ }

const { default: MonoCricketTestLiveScore } = await import('./MonoCricketTestLiveScore.jsx');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function renderScorer() {
  const utils = render(<MonoCricketTestLiveScore />);
  // Load effect restored draftState -> currentInningsIndex 2 -> the active
  // scoring UI shows the "3rd Innings" live badge.
  await screen.findByText('3rd Innings');
  const hero = () => utils.container.querySelector('.mono-scorer-score-value')?.textContent;
  return { ...utils, hero };
}

// Scenario A: the side batting in the 3rd innings already leads on aggregate.
// Normal (non-follow-on) order: slots [t1, t2, t1, t2].
// Alpha 220 + 40 = 260 already > Beta 150 — the exact pre-fix trap.
const SCENARIO_A_DRAFT = {
  innings: [
    { teamId: 1, runs: 220, balls: 600, wickets: 10, allOut: true, declared: false },
    { teamId: 2, runs: 150, balls: 480, wickets: 10, allOut: true, declared: false },
    { teamId: 1, runs: 40, balls: 90, wickets: 3, allOut: false, declared: false },
    { teamId: 2, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
  ],
  currentInningsIndex: 2,
  followOnEnforced: false,
  history: [],
};

// Scenario B: FOLLOW-ON layout — slots [t1, t2, t2, t1].
// Alpha (strong) enforced the follow-on and will NOT bat again; it sits in
// slot[3]. Beta is batting its 2nd innings (slot[2]) one wicket from all-out.
// At the 3rd-innings boundary: lastBatTeamId = innings[3].teamId = 1 (Alpha),
// lastBatTotal = 400 + 0 = 400, oppTotal = 150 + 200 = 350, 400 > 350 TRUE ->
// innings victory, 4th innings NOT played.
const SCENARIO_B_DRAFT = {
  innings: [
    { teamId: 1, runs: 400, balls: 900, wickets: 10, allOut: true, declared: false },
    { teamId: 2, runs: 150, balls: 480, wickets: 10, allOut: true, declared: false },
    { teamId: 2, runs: 200, balls: 540, wickets: 9, allOut: false, declared: false },
    { teamId: 1, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
  ],
  currentInningsIndex: 2,
  followOnEnforced: true,
  history: [],
};

describe('cricket Test 3rd-innings boundary (scoreeasy-m39)', () => {
  it('A: a scoring stroke mid-3rd-innings does NOT complete the match when the third-batting side already leads', async () => {
    h.CURRENT_DRAFT = SCENARIO_A_DRAFT;
    const { hero } = await renderScorer();

    // Pre-condition: 40/3 in the 3rd innings, match still in progress.
    expect(hero()).toContain('40/3');
    expect(screen.queryByText('Match Complete')).toBeNull();

    // Record ONE scoring stroke via keyboard ('1' -> addRuns(1)).
    fireEvent.keyDown(globalThis, { key: '1' });

    // The stroke registered (41/3) but the match must NOT have completed:
    // checkResult short-circuits at currentInningsIndex < 3, so no setTimeout
    // / advanceInnings is scheduled and play stays in the 3rd innings.
    expect(hero()).toContain('41/3');
    expect(screen.getByText('3rd Innings')).toBeInTheDocument();
    expect(screen.queryByText('Match Complete')).toBeNull();
    // Active scoring keypad still present (not the result screen).
    expect(screen.getByText('OUT')).toBeInTheDocument();

    // Wait longer than the 300ms advance timer to prove nothing fires later.
    await wait(350);
    expect(screen.getByText('3rd Innings')).toBeInTheDocument();
    expect(screen.queryByText('Match Complete')).toBeNull();
    expect(screen.getByText('OUT')).toBeInTheDocument();
  });

  it('B: the 3rd innings ends immediately as an innings victory when the side due to bat last already leads (follow-on)', async () => {
    h.CURRENT_DRAFT = SCENARIO_B_DRAFT;
    await renderScorer();

    // Beta is 200/9 in its 2nd innings, one wicket from all-out.
    expect(screen.queryByText('Match Complete')).toBeNull();

    // Record ONE wicket -> Beta all-out -> end of 3rd innings boundary fires.
    fireEvent.click(screen.getByText('OUT'));

    // Completion is deferred 300ms via setTimeout -> use async findByText.
    await screen.findByText('Match Complete');

    // Innings victory for Alpha; the /innings/i wording proves the 4th innings
    // was skipped (Alpha batted once -> innings victory shape).
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByText(/Won by an innings and 50 runs/i)).toBeInTheDocument();

    // The active scoring UI is gone — we are on the result screen.
    expect(screen.queryByText('OUT')).toBeNull();
    expect(screen.queryByText('3rd Innings')).toBeNull();
    expect(screen.getByText('Save & Return')).toBeInTheDocument();
  });
});
