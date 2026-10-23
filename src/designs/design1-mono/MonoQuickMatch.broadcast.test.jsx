import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { saveQuickMatch, saveData } from '../../utils/storage';

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

// Mutable route and draft fixtures let the same mocked dependencies serve each
// sport. The resume query identifies the per-match snapshot being restored.
const ctx = vi.hoisted(() => ({ sport: 'football', draft: null }));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams(`resume=${ctx.draft?.quickMatchId || 'fixture'}`), vi.fn()],
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
  listDataKeys: () => [],
  loadData: vi.fn((key, def) => (key === `se_quickmatch_draft_${ctx.sport}_${ctx.draft?.quickMatchId || 'fixture'}` ? ctx.draft : def)),
  loadQuickMatch: vi.fn(() => null),
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
  it('scopes a completed lock to its match when another sport draft hydrates in the same mount', () => {
    vi.useFakeTimers();
    try {
      seedGoals();
      const view = render(<MonoQuickMatch />);
      fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Reds' }));
      fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
      fireEvent.click(screen.getByRole('button', { name: 'End match' }));
      expect(live.finalize).toHaveBeenCalledOnce();
      const finished = structuredClone(saveQuickMatch.mock.calls.at(-1)[0]);
      seedVolleyball();
      act(() => vi.advanceTimersByTime(200));
      view.rerender(<MonoQuickMatch />);
      fireEvent.click(screen.getByRole('button', { name: 'Add point for Reds' }));
      const nextDraft = saveData.mock.calls.filter(([key]) => key.startsWith('se_quickmatch_draft_volleyball_')).at(-1)?.[1];
      expect(nextDraft?.sets[0].score1).toBe(1);
      expect(live.point.mock.calls.at(-1)[0].snapshot.pointsA).toBe(1);
      expect(saveQuickMatch.mock.calls.at(-1)[0]).toEqual(finished);
    } finally { vi.useRealTimers(); }
  });

  it('persists the settled winning delivery as a draft if terminal saving fails, including across refresh', () => {
    vi.useFakeTimers();
    try {
      seedCricket();
      ctx.draft.innings = 2;
      ctx.draft.battingTeam = 2;
      ctx.draft.scores.team1.runs = 1;
      ctx.draft.scores.team2.runs = 1;
      ctx.draft.scores.team2.balls = 1;
      const first = render(<MonoQuickMatch />);
      saveQuickMatch.mockReturnValue(false);
      fireEvent.click(screen.getByRole('button', { name: 'Four runs' }));
      const settled = saveData.mock.calls.filter(([key]) => key.startsWith('se_quickmatch_draft_cricket_')).at(-1)[1];
      expect(settled.scores.team2.runs).toBe(5);
      expect(settled.cricketHistory.at(-1)).toMatchObject({ value: 4 });
      expect(live.finalize).not.toHaveBeenCalled();
      first.unmount();
      ctx.draft = structuredClone(settled);
      render(<MonoQuickMatch />);
      const restored = saveData.mock.calls.filter(([key]) => key.startsWith('se_quickmatch_draft_cricket_')).at(-1)[1];
      expect(restored.scores.team2.runs).toBe(5);
      expect(saveQuickMatch.mock.calls.at(-1)[0].team2Score.runs).toBe(5);
      expect(live.finalize).not.toHaveBeenCalled();
    } finally { saveQuickMatch.mockReturnValue(true); vi.useRealTimers(); }
  });

  it('preserves Undo followed by a new delivery in the same batch before completion', () => {
    seedCricket();
    ctx.draft.scores.team1.runs = 4;
    ctx.draft.scores.team1.balls = 1;
    ctx.draft.cricketHistory = [{ type: 'runs', key: 'team1', value: 1, innings: 1, battingTeam: 1 }];
    render(<MonoQuickMatch />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
      fireEvent.click(screen.getByRole('button', { name: 'Four runs' }));
    });
    const draft = saveData.mock.calls.filter(([key]) => key.startsWith('se_quickmatch_draft_cricket_')).at(-1)[1];
    expect(draft.scores.team1.runs).toBe(7);
    expect(live.finalize).not.toHaveBeenCalled();
  });
  it('keeps an unsaved quick result open for retry instead of finalizing it', () => {
    seedGoals();
    render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Reds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    saveQuickMatch.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(live.finalize).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add 1 to Reds' })).toBeInTheDocument();
    expect(screen.getByText(/Save failed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(live.finalize).toHaveBeenCalledOnce();
    expect(saveQuickMatch.mock.calls.at(-1)[0]).toMatchObject({ score1: 1, score2: 0 });
  });
  it('locks a cricket winning ball before a same-turn Undo can change it', () => {
    vi.useFakeTimers();
    try {
      seedCricket();
      ctx.draft.innings = 2;
      ctx.draft.battingTeam = 2;
      ctx.draft.scores.team1.runs = 1;
      ctx.draft.scores.team2.runs = 1;
      ctx.draft.scores.team2.balls = 1;
      ctx.draft.cricketHistory = [{ type: 'runs', key: 'team2', value: 1, innings: 2, battingTeam: 2 }];
      saveQuickMatch.mockClear();
      render(<MonoQuickMatch />);
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Four runs' }));
        fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
      });
      act(() => vi.advanceTimersByTime(350));
      expect(saveQuickMatch.mock.calls.at(-1)[0].team2Score.runs).toBe(5);
      expect(live.undo).not.toHaveBeenCalled();
      expect(live.point.mock.calls.at(-1)[0].snapshot.pointsB).toBe(5);
      expect(live.finalize).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it('auto-completion keeps its winning-point snapshot and removes scoring controls', () => {
    vi.useFakeTimers();
    try {
      seedGoals();
      ctx.draft.format = { mode: 'points', target: 1 };
      saveQuickMatch.mockClear();
      render(<MonoQuickMatch />);
      fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Reds' }));
      const saved = structuredClone(saveQuickMatch.mock.calls.at(-1)[0]);
      const drafts = saveData.mock.calls.length;
      act(() => vi.advanceTimersByTime(350));
      expect(screen.queryByRole('button', { name: 'Add 1 to Reds' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
      expect(saveQuickMatch).toHaveBeenCalledOnce();
      expect(saved).toMatchObject({ score1: 1, score2: 0, winner: 'Reds' });
      expect(saveData).toHaveBeenCalledTimes(drafts);
      expect(live.point.mock.calls.at(-1)[0].snapshot).toMatchObject({ pointsA: saved.score1, pointsB: saved.score2 });
      expect(live.finalize).toHaveBeenCalledOnce();
      expect(live.point.mock.invocationCallOrder.at(-1)).toBeLessThan(live.finalize.mock.invocationCallOrder[0]);
    } finally { vi.useRealTimers(); }
  });
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

    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
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
