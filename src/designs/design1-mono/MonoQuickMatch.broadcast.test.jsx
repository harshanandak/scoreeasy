import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Quick-match live-broadcast wiring (dkt/b0z): scoring a quick match must mirror
// each point to the public watch page via useLiveBroadcast, with an engine-derived
// snapshot. There is no render harness for this scorer, so we drive the REAL
// component seeded straight into the scoring phase, across all THREE snapshot
// branches (goals, cricket, sets) — each reads a different state shape, so a
// per-sport test guards against the snapshot silently emitting zeros.

const live = vi.hoisted(() => ({
  point: vi.fn(() => Promise.resolve()),
  undo: vi.fn(() => Promise.resolve()),
  finalize: vi.fn(() => Promise.resolve()),
  goLive: vi.fn(() => Promise.resolve({ token: 'TOK', matchId: 'mid' })),
  setVisibility: vi.fn(() => Promise.resolve()),
  reset: vi.fn(),
}));

// Mutable route+draft so one mocked module set can serve every sport. loadData
// returns the seeded draft for the active sport's key; no timestamp field, so
// isStaleQuickMatchDraft() stays false and the restore effect lands in 'scoring'.
const ctx = vi.hoisted(() => ({ sport: 'football', draft: null }));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, cloudAuthAvailable: true }),
}));
vi.mock('../../hooks/useLiveBroadcast', () => ({
  useLiveBroadcast: () => ({ ...live, isLive: false, token: null, error: null }),
}));
// Global consent already accepted (captured at sign-in) → liveEnabled starts true.
vi.mock('../../lib/live/liveSession', () => ({
  getConsent: () => 'accepted',
  setConsent: vi.fn(),
  loadSession: () => null,
  saveSession: vi.fn(),
}));
vi.mock('../../utils/storage', () => ({
  loadData: vi.fn((key, def) => (key === `se_quickmatch_draft_${ctx.sport}` ? ctx.draft : def)),
  saveData: vi.fn(() => true),
  clearData: vi.fn(),
  saveQuickMatch: vi.fn(() => true),
  isStaleQuickMatchDraft: () => false,
}));

const { default: MonoQuickMatch } = await import('./MonoQuickMatch.jsx');

const base = { phase: 'scoring', team1Name: 'Reds', team2Name: 'Blues', lastAction: '' };

function seedGoals() {
  ctx.sport = 'football';
  ctx.draft = { ...base, sport: 'football', gScore1: 0, gScore2: 0, gScoreHistory: [], quickMatchId: 1001 };
}
function seedCricket() {
  ctx.sport = 'cricket';
  ctx.draft = {
    ...base, sport: 'cricket', quickMatchId: 2002,
    scores: {
      team1: { runs: 0, balls: 0, wickets: 0, allOut: false },
      team2: { runs: 0, balls: 0, wickets: 0, allOut: false },
    },
    innings: 1, battingTeam: 1, cricketHistory: [],
  };
}
function seedVolleyball() {
  ctx.sport = 'volleyball';
  ctx.draft = {
    ...base, sport: 'volleyball', quickMatchId: 3003,
    format: { type: 'best-of', sets: 3, target: 25, winBy: 2 },
    sets: [{ score1: 0, score2: 0, completed: false }], currentSet: 0,
  };
}

beforeEach(() => {
  live.point.mockClear();
  live.undo.mockClear();
  live.finalize.mockClear();
});

describe('MonoQuickMatch live broadcast wiring', () => {
  it('goals: renders into scoring and mirrors a goal as live.point with the committed snapshot', async () => {
    seedGoals();
    render(<MonoQuickMatch />);

    const redsTap = await screen.findByRole('button', { name: 'Add 1 to Reds' });
    expect(live.point).not.toHaveBeenCalled();

    fireEvent.click(redsTap);

    await waitFor(() => expect(live.point).toHaveBeenCalledTimes(1));
    const arg = live.point.mock.calls[0][0];
    expect(arg.team).toBe('A');
    expect(arg.value).toBe(1);
    expect(arg.snapshot.pointsA).toBe(1); // Reds lead 1–0 (committed score)
    expect(arg.snapshot.pointsB).toBe(0);
    expect(live.finalize).not.toHaveBeenCalled();
  });

  it('goals: mirrors a correction (−1) as live.undo', async () => {
    seedGoals();
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 to Reds' }));
    await waitFor(() => expect(live.point).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Reds' }));
    await waitFor(() => expect(live.undo).toHaveBeenCalledTimes(1));
  });

  it('cricket: mirrors runs as live.point with the cumulative runs snapshot', async () => {
    seedCricket();
    render(<MonoQuickMatch />);

    // Cricket run keys: "Four runs" = +4 to the batting side (team1 → A).
    fireEvent.click(await screen.findByRole('button', { name: 'Four runs' }));

    await waitFor(() => expect(live.point).toHaveBeenCalledTimes(1));
    const arg = live.point.mock.calls[0][0];
    expect(arg.team).toBe('A');
    expect(arg.value).toBe(4);
    expect(arg.snapshot.pointsA).toBe(4); // cumulative team1 runs
    expect(arg.snapshot.pointsB).toBe(0);
    expect(arg.snapshot.currentUnit).toBe(1); // innings 1
  });

  it('sets/volleyball: mirrors a point as live.point with the current-set snapshot', async () => {
    seedVolleyball();
    render(<MonoQuickMatch />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Reds' }));

    await waitFor(() => expect(live.point).toHaveBeenCalledTimes(1));
    const arg = live.point.mock.calls[0][0];
    expect(arg.team).toBe('A');
    expect(arg.snapshot.pointsA).toBe(1); // current-set score1
    expect(arg.snapshot.pointsB).toBe(0);
    expect(arg.snapshot.setsA).toBe(0); // no completed sets yet
    expect(arg.snapshot.currentUnit).toBe(1);
  });

  it('finalizes on manual end, after the last point is mirrored', async () => {
    // Manual-end ordering. (The auto-win race — finalizeMatch called synchronously
    // inside a winning handler — is handled by construction: the finalize effect is
    // declared immediately AFTER the snapshot effect, so React's source-ordered
    // effect flush enqueues the last point before finalize drains + archives.)
    seedGoals();
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 to Reds' }));
    await waitFor(() => expect(live.point).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'End match' }));

    await waitFor(() => expect(live.finalize).toHaveBeenCalledTimes(1));
    expect(live.point.mock.invocationCallOrder[0])
      .toBeLessThan(live.finalize.mock.invocationCallOrder[0]);
  });
});
