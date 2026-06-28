import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Issue #108 — MonoSetsLiveScore UX fixes. There is no existing render harness
// for this scorer, so these tests drive the real component to verify:
//   1. set-won notification shows the COMPLETED set number,
//   2. a side-out serve switch broadcasts (value 0),
//   3. loading vs not-found are distinct (recovery surface on not-found),
//   4. undo reverses a side-out serve switch + broadcasts an undo,
//   5. per-team correction (-1) decrements, floors at 0, and broadcasts value -1,
//   7. the broadcast descriptor carries the engine-derived scorecard kind.

const broadcast = vi.hoisted(() => ({
  point: vi.fn(() => Promise.resolve(null)),
  undo: vi.fn(() => Promise.resolve(null)),
  finalize: vi.fn(() => Promise.resolve(null)),
  goLive: vi.fn(() => Promise.resolve(null)),
  setVisibility: vi.fn(() => Promise.resolve(null)),
  reset: vi.fn(),
  isLive: false,
  token: null,
  error: null,
}));

const h = vi.hoisted(() => ({
  params: { sport: 'volleyball', id: '1', matchId: 'm1' },
  tournaments: [],
  saveSpy: vi.fn(() => true),
  makeTournament: ({ format, ...overrides } = {}) => ({
    id: 1,
    teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
    // effectiveFormat reads the TOURNAMENT-level format for non-knockout matches.
    format: format || { type: 'best-of', sets: 3, points: 25 },
    matches: [{
      id: 'm1',
      team1Id: 1,
      team2Id: 2,
      format: format || { type: 'best-of', sets: 3, points: 25, scoringModes: ['rally', 'side-out'] },
      ...overrides,
    }],
    knockoutMatches: [],
  }),
}));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => h.params,
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => broadcast }));
vi.mock('../../../lib/live/liveSession', () => ({ getConsent: () => 'accepted' }));
// Capture the descriptor handed to the broadcast bar so we can assert the
// scorecardKind that would be sent on goLive.
const liveBarProps = vi.hoisted(() => ({ last: null }));
vi.mock('../live/LiveBroadcastBar', () => ({
  default: (props) => { liveBarProps.last = props; return null; },
}));
vi.mock('../../../utils/storage', () => ({
  loadSportTournaments: () => h.tournaments,
  saveSportTournament: h.saveSpy,
  loadData: vi.fn((_key, def) => def),
  saveData: vi.fn(() => true),
}));

// Force a non-touch environment so the keyboard handler / hints attach in jsdom.
try { delete globalThis.ontouchstart; } catch { /* ignore */ }
try {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
} catch { /* ignore */ }

const { default: MonoSetsLiveScore } = await import('./MonoSetsLiveScore.jsx');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function arenaButtons() {
  // The two big score halves are the first two buttons with aria-labels ending
  // in the scoring hint.
  return screen.getAllByRole('button').filter((b) => /points\./.test(b.getAttribute('aria-label') || ''));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.params = { sport: 'volleyball', id: '1', matchId: 'm1' };
  h.tournaments = [h.makeTournament()];
});

describe('MonoSetsLiveScore — issue #108', () => {
  it('shows a recovery surface (not "Loading…") when the match is not found', async () => {
    h.tournaments = []; // no tournament for this id
    render(<MonoSetsLiveScore />);
    expect(await screen.findByText('Match not found')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('renders the live scorer when the match is found', async () => {
    render(<MonoSetsLiveScore />);
    expect(await screen.findByText(/points to win/)).toBeTruthy();
    expect(screen.queryByText('Match not found')).toBeNull();
  });

  it('broadcasts the engine-derived scorecard kind (volleyball) for a non-volleyball sets sport', async () => {
    h.params = { sport: 'badminton', id: '1', matchId: 'm1' };
    h.tournaments = [h.makeTournament({
      format: { type: 'best-of', sets: 3, points: 21, scoringModes: ['rally', 'side-out'] },
    })];
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);
    // The descriptor flows into LiveBroadcastBar; the kind resolves to
    // 'volleyball' (engine-derived) even though the sport id is 'badminton'.
    expect(liveBarProps.last.descriptor.sport).toBe('badminton');
    expect(liveBarProps.last.descriptor.scorecardKind).toBe('volleyball');
  });

  it('shows the COMPLETED set number in the set-won notice (match-ending set)', async () => {
    // Best-of-1 (single): the very first set completing ends the match without
    // advancing currentSet — the buggy code rendered "Set 0".
    h.tournaments = [h.makeTournament({
      format: { type: 'single', sets: 1, points: 1, scoringModes: ['rally'] },
    })];
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);
    const [left] = arenaButtons();
    // target=1, win-by-2 (volleyball): need 2-0 to satisfy both. Two taps with a
    // wait between to clear the 150ms rapid-click guard.
    fireEvent.click(left);
    await wait(160);
    fireEvent.click(left);
    expect(await screen.findByText(/wins Set 1!/)).toBeTruthy();
  });

  it('shows the COMPLETED set number when a non-final set ends and the next opens', async () => {
    // Best-of-3, target 1, win-by-2: 2-0 closes set 1 and opens set 2, so
    // currentSet advances to index 1 — the notice must still say "Set 1".
    h.tournaments = [h.makeTournament({
      format: { type: 'best-of', sets: 3, points: 1 },
    })];
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);
    const [left] = arenaButtons();
    fireEvent.click(left);
    await wait(160);
    fireEvent.click(left);
    expect(await screen.findByText(/wins Set 1!/)).toBeTruthy();
    // The top badge confirms the scorer advanced to set 2 of 3.
    expect(screen.getByText('Set 2 of 3')).toBeTruthy();
  });

  it('side-out serve switch broadcasts a value:0 point and undo reverses it', async () => {
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);

    // Switch to side-out mode.
    fireEvent.click(screen.getByTitle('Toggle scoring model'));

    // servingTeam defaults to 1 (team Alpha = left). Tapping the RIGHT half
    // (team Beta, the non-serving team) switches serve without scoring.
    const [, right] = arenaButtons();
    fireEvent.click(right);

    // A serve switch broadcasts a value:0 point for team B.
    expect(broadcast.point).toHaveBeenCalledTimes(1);
    const arg = broadcast.point.mock.calls[0][0];
    expect(arg.team).toBe('B');
    expect(arg.value).toBe(0);
    // Score did NOT change.
    expect(arg.snapshot.pointsA).toBe(0);
    expect(arg.snapshot.pointsB).toBe(0);
    // Serving moved to B.
    expect(arg.snapshot.servingTeam).toBe('B');

    // Undo reverses the serve switch and broadcasts an undo.
    await wait(160); // clear rapid-click guard
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(broadcast.undo).toHaveBeenCalledTimes(1);
    expect(broadcast.undo.mock.calls[0][0].snapshot.servingTeam).toBe('A');
  });

  it('per-team correction (-1) decrements, broadcasts value -1, and floors at 0', async () => {
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);

    const [left] = arenaButtons();
    fireEvent.click(left); // Alpha 1
    await wait(160);

    // -1 Alpha button corrects the score back to 0.
    const minusAlpha = screen.getByRole('button', { name: 'Correct Alpha: remove one point' });
    fireEvent.click(minusAlpha);

    const correctionCall = broadcast.point.mock.calls.find((c) => c[0].value === -1);
    expect(correctionCall).toBeTruthy();
    expect(correctionCall[0].team).toBe('A');
    expect(correctionCall[0].snapshot.pointsA).toBe(0);

    // At 0 the button is disabled (floors at 0, no negative scores).
    await wait(160);
    expect(minusAlpha.disabled).toBe(true);
  });

  // Reads the serving team from the left overline's leading dot. The serving dot
  // ('● ') prefixes the serving side's name in the arena overline.
  function servingTeamFromDom() {
    const overlines = Array.from(document.querySelectorAll('.mono-arena-overline'));
    const leftServing = (overlines[0]?.textContent || '').startsWith('●');
    return leftServing ? 'A' : 'B';
  }

  async function tapServer() {
    // Always tap the currently serving half so a point is scored (rally mode),
    // never a side-out switch. The serving team is whoever has the leading dot.
    const serving = servingTeamFromDom();
    const [left, right] = arenaButtons();
    fireEvent.click(serving === 'A' ? left : right);
    await wait(160);
  }

  it('table tennis (uncapped) switches serve every 2 points, then every point at deuce', async () => {
    h.params = { sport: 'tabletennis', id: '1', matchId: 'm1' };
    h.tournaments = [h.makeTournament({
      format: { type: 'best-of', sets: 5, points: 11 },
    })];
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);

    // Pre-deuce: serve changes every 2 points (serviceRotation = 2).
    expect(servingTeamFromDom()).toBe('A');
    await tapServer(); // total 1 → no switch
    expect(servingTeamFromDom()).toBe('A');
    await tapServer(); // total 2 → switch to B
    expect(servingTeamFromDom()).toBe('B');
  });

  it('badminton (capped) never mis-fires the deuce branch — serve still rotates every point', async () => {
    h.params = { sport: 'badminton', id: '1', matchId: 'm1' };
    h.tournaments = [h.makeTournament({
      format: { type: 'best-of', sets: 3, points: 21 },
    })];
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);

    // serviceRotation = 1 → switch on every point regardless of deuce.
    expect(servingTeamFromDom()).toBe('A');
    await tapServer();
    expect(servingTeamFromDom()).toBe('B');
    await tapServer();
    expect(servingTeamFromDom()).toBe('A');
  });
});
