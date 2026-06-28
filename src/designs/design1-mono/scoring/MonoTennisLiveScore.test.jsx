import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { deriveServer } from './MonoTennisLiveScore.jsx';

// Issue #109: tennis scorer UX fixes. These tests cover the pure serve-derivation
// helper plus the render-level fixes (serving indicator, milestone announcement,
// completed-set history strip, distinct Discard button, no-crash guard).

const makeSet = (over = {}) => ({
  games1: 0, games2: 0, points1: 0, points2: 0,
  isDeuce: false, advantage: null, isTiebreak: false,
  tiebreakPoints1: 0, tiebreakPoints2: 0, completed: false, ...over,
});

describe('deriveServer', () => {
  it('team 1 serves the first game of the match', () => {
    expect(deriveServer([makeSet()], 0)).toBe(1);
  });

  it('flips per game (alternates as games accumulate)', () => {
    expect(deriveServer([makeSet({ games1: 1 })], 0)).toBe(2); // 1 game done
    expect(deriveServer([makeSet({ games1: 1, games2: 1 })], 0)).toBe(1); // 2 games done
  });

  it('serve parity is cumulative across sets, not per-set', () => {
    // Set 1 ended 6-4 (10 games, even) -> set 2 first game still team 1.
    const sets = [makeSet({ games1: 6, games2: 4, completed: true }), makeSet()];
    expect(deriveServer(sets, 1)).toBe(1);
    // Set 1 ended 6-3 (9 games, odd) -> set 2 first game flips to team 2.
    const sets2 = [makeSet({ games1: 6, games2: 3, completed: true }), makeSet()];
    expect(deriveServer(sets2, 1)).toBe(2);
  });

  it('tiebreak: serve changes every 2 points after the first point', () => {
    // 12 games before (even) -> first tiebreak server is team 1.
    const base = (tb1, tb2) => [makeSet({ games1: 6, games2: 6, isTiebreak: true, tiebreakPoints1: tb1, tiebreakPoints2: tb2 })];
    expect(deriveServer(base(0, 0), 0)).toBe(1); // p=1 -> firstServer
    expect(deriveServer(base(1, 0), 0)).toBe(2); // p=2 -> other
    expect(deriveServer(base(1, 1), 0)).toBe(2); // p=3 -> other
    expect(deriveServer(base(2, 1), 0)).toBe(1); // p=4 -> firstServer
  });

  it('returns 1 for an out-of-range current set (no crash)', () => {
    expect(deriveServer([makeSet()], 5)).toBe(1);
  });
});

// --- Component-level render tests ---

const h = vi.hoisted(() => ({
  draft: {
    matchId: 'q1', sport: 'tennis', team1Name: 'Alpha', team2Name: 'Beta',
    // 3-set match (best of 3 -> 2 sets to win). Set 1 is done 6-4; sets 2 & 3 are
    // open, so the match is NOT yet complete and the current set (2) is scorable.
    format: { sets: 3 },
    sets: [
      { games1: 6, games2: 4, points1: 0, points2: 0, isDeuce: false, advantage: null, isTiebreak: false, tiebreakPoints1: 0, tiebreakPoints2: 0, completed: true },
      { games1: 0, games2: 0, points1: 0, points2: 0, isDeuce: false, advantage: null, isTiebreak: false, tiebreakPoints1: 0, tiebreakPoints2: 0, completed: false },
      { games1: 0, games2: 0, points1: 0, points2: 0, isDeuce: false, advantage: null, isTiebreak: false, tiebreakPoints1: 0, tiebreakPoints2: 0, completed: false },
    ],
  },
}));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ sport: 'tennis', matchId: 'q1' }),
  useLocation: () => ({ pathname: '/tennis/quick/q1', search: '' }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../utils/storage', () => ({
  loadData: vi.fn(() => h.draft),
  saveData: vi.fn(() => true),
  clearData: vi.fn(),
  isStaleQuickMatchDraft: vi.fn(() => false),
  loadSportTournaments: vi.fn(() => []),
  saveSportTournament: vi.fn(() => true),
  saveQuickMatch: vi.fn(() => true),
}));

try { delete globalThis.ontouchstart; } catch { /* ignore */ }
try {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
} catch { /* ignore */ }

const { default: MonoTennisLiveScore } = await import('./MonoTennisLiveScore.jsx');

const renderScorer = async () => {
  const utils = render(<MonoTennisLiveScore storageMode="quick" />);
  await screen.findByRole('button', { name: /Alpha:/ });
  return utils;
};

describe('MonoTennisLiveScore render', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders a serving indicator dot on the serving team', async () => {
    const { container } = await renderScorer();
    // Set 1 was 6-4 (10 games, even) -> set 2 first game: team 1 (Alpha, left) serves.
    const overlines = container.querySelectorAll('.mono-arena-overline');
    expect(overlines[0].textContent).toContain('●');
    expect(overlines[1].textContent).not.toContain('●');
  });

  it('shows a completed-set history strip', async () => {
    const { container } = await renderScorer();
    const strip = container.querySelector('.mono-score-history-strip');
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain('Set 1: 6-4');
  });

  it('announces a game-won milestone via the aria-live <output> (not direct DOM)', async () => {
    const { container } = await renderScorer();
    const output = container.querySelector('output[aria-live="polite"]');
    expect(output).toBeTruthy();
    // Win a game for Alpha: 4 straight points (0->15->30->40->game). A 150ms
    // click debounce guards the score button, so wait past it between taps.
    for (let i = 0; i < 4; i += 1) {
      const alpha = screen.getByRole('button', { name: /Alpha:/ });
      await act(async () => { fireEvent.click(alpha); await new Promise(r => setTimeout(r, 160)); });
    }
    expect(output.textContent).toMatch(/wins Game/i);
    // No stray direct-DOM toast was appended to document.body.
    expect(document.body.querySelectorAll('body > .mono-set-won').length).toBe(0);
  });

  it('the Discard button is visually distinguished from Finish (destructive class)', async () => {
    await renderScorer();
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(discard.className).toContain('mono-btn-danger');
    const finish = screen.getByRole('button', { name: 'Finish' });
    expect(finish.className).not.toContain('mono-btn-danger');
  });
});
