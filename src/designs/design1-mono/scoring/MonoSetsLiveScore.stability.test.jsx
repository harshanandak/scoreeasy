import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Stability audit 2026-10-21 (docs/plans/2026-10-21-stability-audit.md).
// Each `it.fails` encodes the CORRECT behaviour and currently fails against
// master. When the named fix PR lands, flip `it.fails` to `it` — vitest will
// start reporting the `it.fails` as an error the moment the bug is fixed, so the
// marker cannot silently outlive the fix.

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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function arenaButtons() {
  return screen.getAllByRole('button').filter((b) => /points\./.test(b.getAttribute('aria-label') || ''));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.params = { sport: 'badminton', id: '1', matchId: 'm1' };
  h.tournaments = [h.makeTournament()];
});

describe('MonoSetsLiveScore — stability audit 2026-10-21', () => {
  // SA-01 (P0): the tournament scorer checks win-by-2 BEFORE the 30-point cap, so
  // a badminton game at 30-29 never ends (quick match ends it — quickMatchSets.js).
  // Fix PR: "fix(sets): tournament scorer uses quickMatchSets.isSetComplete".
  it.fails('SA-01 badminton tournament game ends at the 30-point cap (30-29)', async () => {
    h.tournaments = [h.makeTournament({
      draftState: {
        currentSet: 0,
        sets: [{ score1: 29, score2: 29, completed: false }],
        history: [{ sets: [{ score1: 29, score2: 28, completed: false }], currentSet: 0, servingTeam: 2 }],
        servingTeam: 1,
        scoringMode: 'rally',
      },
    })];
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);
    const [left] = arenaButtons();
    // Guard: the draft really restored 29-29, so a failure below is the cap bug.
    expect(left.getAttribute('aria-label')).toMatch(/: 29 points\./);
    fireEvent.click(left);
    expect(await screen.findByText(/wins Set 1!/, {}, { timeout: 1500 })).toBeTruthy();
  });

  // SA-07 (P1): the autosave effect returns early when history is empty, so
  // undoing back to the start of the match never persists — a refresh brings the
  // undone point back. Reproduced in the browser sweep (badminton tournament).
  // Fix PR: "fix(scorers): persist the draft after undo-to-empty".
  it.fails('SA-07 undo back to 0-0 persists, so a refresh cannot resurrect the point', async () => {
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);
    const [left] = arenaButtons();
    fireEvent.click(left);
    await wait(200);
    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
    await wait(200);
    const lastSaved = h.saveSpy.mock.calls.at(-1)?.[1];
    const savedMatch = lastSaved?.matches?.find((m) => m.id === 'm1');
    const savedSets = savedMatch?.draftState?.sets;
    // Either the draft is cleared or it records 0-0 — never the undone 1-0.
    expect(savedSets ? savedSets[0].score1 : 0).toBe(0);
  });

  // SA-11 (P1): one 150 ms window is shared by BOTH teams' buttons, so a tap on
  // Team B within 150 ms of a tap on Team A is silently dropped.
  // Fix PR: "fix(scorers): per-target tap guard + visible ignored-tap feedback".
  it.fails('SA-11 a tap on the other team inside 150 ms still scores', async () => {
    render(<MonoSetsLiveScore />);
    await screen.findByText(/points to win/);
    const [left, right] = arenaButtons();
    fireEvent.click(left);
    await wait(60);
    fireEvent.click(right);
    await wait(100);
    const [, rightAfter] = arenaButtons();
    expect(rightAfter.getAttribute('aria-label')).toMatch(/: 1 points?\./);
  });
});
