import { freezeSetsFormat } from '../../../models/setsRules';
import { getSportById } from '../../../models/sportRegistry';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

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
  params: { sport: 'badminton', id: '1', matchId: 'm1' },
  tournaments: [],
  saveSpy: vi.fn(() => true),
  makeTournament: ({ format, ...overrides } = {}) => ({
    id: 1,
    teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
    format: format || { type: 'best-of', sets: 3, points: 21 },
    matches: [{
      id: 'm1',
      team1Id: 1,
      team2Id: 2,
      format: format || { type: 'best-of', sets: 3, points: 21 },
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
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../../../utils/storage', () => ({
  loadSportTournaments: () => h.tournaments,
  saveSportTournament: h.saveSpy,
  loadData: vi.fn((_key, def) => def),
  saveData: vi.fn(() => true),
}));

try { delete globalThis.ontouchstart; } catch { /* ignore */ }
try {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
} catch { /* ignore */ }

const { default: MonoSetsLiveScore } = await import('./MonoSetsLiveScore.jsx');

function arenaButtons() {
  return screen.getAllByRole('button').filter((b) => /points\./.test(b.getAttribute('aria-label') || ''));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Start beyond the scorer's initial lastClickRef=0 guard window.
  vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));
  h.params = { sport: 'badminton', id: '1', matchId: 'm1' };
  h.tournaments = [h.makeTournament()];
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function renderScorer() {
  await act(async () => { render(<MonoSetsLiveScore />); });
  expect(screen.getByText(/points to win/)).toBeTruthy();
}

describe('shared sets rules regressions', () => {
  it('keeps frozen side-out mode authoritative over a stale draft mode', async () => {
    h.params.sport = 'volleyball';
    h.tournaments = [h.makeTournament({
      format: freezeSetsFormat(getSportById('volleyball'), { type: 'best-of', sets: 3, points: 25, scoringMode: 'side-out', initialServer: 1 }),
      scoringMode: 'rally',
      draftState: { currentSet: 0, sets: [{ score1: 0, score2: 0, completed: false }], servingTeam: 2, scoringMode: 'rally', history: [] },
    })];
    await act(async () => { render(<MonoSetsLiveScore />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add point for Alpha' })); });
    expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState).toMatchObject({ scoringMode: 'side-out', servingTeam: 1, sets: [{ score1: 0, score2: 0, completed: false }] });
  });

  it('keeps frozen side-out mode through undo of a stale rally history entry', async () => {
    h.params.sport = 'volleyball';
    h.tournaments = [h.makeTournament({
      format: freezeSetsFormat(getSportById('volleyball'), { type: 'best-of', sets: 3, points: 25, scoringMode: 'side-out', initialServer: 1 }),
      draftState: {
        currentSet: 0,
        sets: [{ score1: 1, score2: 0, completed: false }],
        servingTeam: 1,
        scoringMode: 'rally',
        history: [{ sets: [{ score1: 0, score2: 0, completed: false }], currentSet: 0, servingTeam: 1, scoringMode: 'rally' }],
      },
    })];
    await act(async () => { render(<MonoSetsLiveScore />); });
    await act(async () => { vi.advanceTimersByTime(160); fireEvent.click(screen.getByRole('button', { name: /^undo$/i })); });
    await act(async () => { vi.advanceTimersByTime(160); fireEvent.click(screen.getByRole('button', { name: 'Add point for Beta' })); });
    expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState).toMatchObject({ scoringMode: 'side-out', servingTeam: 2, sets: [{ score1: 0, score2: 0, completed: false }] });
  });

  it.each([null, 1])('inherits tournament side-out mode on first open and restore (first server %s)', async (initialServer) => {
    h.params.sport = 'volleyball';
    const tournament = h.makeTournament();
    tournament.format = { type: 'best-of', sets: 3, points: 25, scoringMode: 'side-out', initialServer };
    delete tournament.matches[0].format;
    h.tournaments = [tournament];
    const view = render(<MonoSetsLiveScore />);
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add point for Beta' })); });
    if (initialServer === null) {
      expect(screen.getByRole('alert')).toHaveTextContent('Choose the serving team');
      expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState).toBeUndefined();
    } else {
      const saved = structuredClone(h.saveSpy.mock.calls.at(-1)[1]);
      expect(saved.matches[0].draftState).toMatchObject({ scoringMode: 'side-out', servingTeam: 2, sets: [{ score1: 0, score2: 0, completed: false }] });
      h.tournaments = [saved];
      view.unmount();
      await act(async () => { render(<MonoSetsLiveScore />); vi.advanceTimersByTime(160); });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add point for Alpha' })); });
      expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState).toMatchObject({ scoringMode: 'side-out', servingTeam: 1, sets: [{ score1: 0, score2: 0, completed: false }] });
    }
  });

  async function point(team) {
    await act(async () => {
      vi.advanceTimersByTime(160);
      fireEvent.click(arenaButtons()[team - 1]);
    });
  }

  it('badminton tournament cap ends at 30-29 before checking the two-point margin', async () => {
    h.tournaments = [h.makeTournament({ format: { type: 'best-of', sets: 3, points: 21, initialServer: 1 } })];
    await renderScorer();
    for (let score = 0; score < 29; score++) {
      await point(1);
      await point(2);
    }
    expect(arenaButtons()[0]).toHaveAttribute('aria-label', expect.stringContaining(': 29 points.'));
    await point(1);
    expect(screen.getByText(/wins (Set|Game) 1!/)).toBeTruthy();
    expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState.sets[0]).toMatchObject({ score1: 30, score2: 29, completed: true });
  });

  it('badminton tournament gives the next serve to the rally winner, like quick match', async () => {
    h.tournaments = [h.makeTournament({ format: { type: 'best-of', sets: 3, points: 21, initialServer: 1 } })];
    await renderScorer();
    await point(1);
    expect(broadcast.point.mock.calls.at(-1)[0].snapshot.servingTeam).toBe('A');
    await point(1);
    expect(broadcast.point.mock.calls.at(-1)[0].snapshot.servingTeam).toBe('A');
    await point(2);
    expect(broadcast.point.mock.calls.at(-1)[0].snapshot.servingTeam).toBe('B');
  });

  it('undo restores the server and score before the previous rally', async () => {
    h.tournaments = [h.makeTournament({ format: { type: 'best-of', sets: 3, points: 21, initialServer: 1 } })];
    await renderScorer();
    await point(2);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^undo$/i })); });
    expect(broadcast.undo.mock.calls.at(-1)[0].snapshot).toMatchObject({ pointsA: 0, pointsB: 0 });
    expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState.servingTeam).toBe(1);
  });

  it('restores unknown service through undo and saves it for a refresh', async () => {
    await renderScorer();
    expect(screen.getByText('Server unknown', { selector: 'p' })).toBeTruthy();
    await point(2);
    expect(broadcast.point.mock.calls.at(-1)[0].snapshot.servingTeam).toBe('B');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^undo$/i })); });
    expect(broadcast.undo.mock.calls.at(-1)[0].snapshot.servingTeam).toBeUndefined();
    expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState.servingTeam).toBeNull();
  });

  it('a new-profile game boundary restores service, score and ends after refresh and undo', async () => {
    const format = freezeSetsFormat(getSportById('badminton'), { type: 'best-of', sets: 3, points: 21, initialServer: 2 });
    h.tournaments = [h.makeTournament({ format, draftState: { currentSet: 0, sets: [{ score1: 20, score2: 18, completed: false }], servingTeam: 1, scoringMode: 'rally', history: [] } })];
    const view = render(<MonoSetsLiveScore />);
    await act(async () => {});
    await point(1);
    const saved = structuredClone(h.saveSpy.mock.calls.at(-1)[1]);
    expect(saved.matches[0].draftState).toMatchObject({ currentSet: 1, servingTeam: 1, sidesSwapped: true });
    h.tournaments = [saved];
    view.unmount();
    await renderScorer();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^undo$/i })); });
    expect(h.saveSpy.mock.calls.at(-1)[1].matches[0].draftState).toMatchObject({ currentSet: 0, servingTeam: 1, sidesSwapped: false, sets: [{ score1: 20, score2: 18, completed: false }] });
  });

});
