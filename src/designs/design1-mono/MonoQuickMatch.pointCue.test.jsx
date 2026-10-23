import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { contrastRatio, paletteHex, paletteDarkHex } from './theme/palette';

const ctx = vi.hoisted(() => ({ sport: 'volleyball', draft: null, saved: null }));
vi.mock('convex/react', () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams('resume=3003'), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn(), isLive: false }) }));
vi.mock('../../lib/live/liveSession', () => ({ getConsent: () => 'declined', loadSession: () => null, saveSession: vi.fn() }));
vi.mock('../../utils/storage', () => ({
  loadData: (key, fallback) => key === `se_quickmatch_draft_${ctx.sport}_3003` ? ctx.draft : fallback,
  loadQuickMatch: () => null, clearData: vi.fn(), saveQuickMatch: () => true,
  isStaleQuickMatchDraft: () => false,
  saveData: (key, value) => { if (key === `se_quickmatch_draft_${ctx.sport}_3003`) ctx.saved = structuredClone(value); return true; },
}));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');
const cue = () => document.querySelector('.tsb-point-cue');
let now;
const point = (name = 'Royals') => {
  now += 200;
  fireEvent.click(screen.getByRole('button', { name: `Add point for ${name}` }));
};
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
function seed(sport, score1, score2, extra = {}) {
  ctx.sport = sport;
  ctx.draft = { phase: 'scoring', sport, quickMatchId: 3003, team1Name: 'Royals', team2Name: 'Strikers',
    format: { type: 'best-of', sets: sport === 'badminton' ? 3 : 5 },
    sets: [{ score1, score2, completed: false }], currentSet: 0, ...extra };
}
beforeEach(() => {
  ctx.draft = null; ctx.saved = null;
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

describe('sets board point cue', () => {
  it.each([['volleyball', 24, 'Set'], ['badminton', 20, 'Game'], ['tabletennis', 10, 'Set']])('updates %s words on points, Undo and remount', async (sport, edge, unit) => {
    seed(sport, edge - 1, edge - 1);
    const view = render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    expect(cue()).toBeNull();
    point();
    expect(cue()).toHaveTextContent(`${unit} point · Royals`);
    expect(cue().closest('.tsb-meta')).not.toBeNull();
    ctx.draft = structuredClone(ctx.saved);
    view.unmount();
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    expect(cue()).toHaveTextContent(`${unit} point · Royals`);
    undo();
    expect(cue()).toBeNull();
    point();
    point('Strikers');
    expect(cue()).toBeNull();
    undo();
    expect(cue()).toHaveTextContent(`${unit} point · Royals`);
  });

  it('names match point at 2–1 sets, undoes out of it and keeps the team after swapping sides', async () => {
    seed('volleyball', 0, 0, { currentSet: 3, sets: [
      { score1: 25, score2: 20, completed: true }, { score1: 20, score2: 25, completed: true },
      { score1: 25, score2: 20, completed: true }, { score1: 23, score2: 22, completed: false },
    ] });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    point();
    expect(cue()).toHaveTextContent('Match point · Royals');
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect(cue()).toHaveTextContent('Match point · Royals');
    undo();
    expect(cue()).toBeNull();
  });

  it.each([
    [0, 'Next point wins the game'], [1, 'Next point wins the game'], [2, 'Next point wins the match'],
  ])('names both teams truthfully at 29–29 with %i completed games', async (completed, expected) => {
    const done = [{ score1: 21, score2: 18, completed: true }, { score1: 18, score2: 21, completed: true }];
    seed('badminton', 0, 0, { currentSet: completed, sets: [...done.slice(0, completed), { score1: 29, score2: 29, completed: false }] });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    expect(cue()).toHaveTextContent(expected);
    point();
    if (completed === 0) {
      await waitFor(() => expect(cue()).toBeNull());
      undo();
      expect(cue()).toHaveTextContent(expected);
    } else {
      await screen.findByRole('region', { name: 'Match result' });
      expect(cue()).toBeNull();
    }
  });

  it.each(['volleyball', 'badminton', 'tabletennis'])('single %s shows match point and undoes out', async (sport) => {
    seed(sport, 0, 0, { format: { type: 'single', target: 7 }, vScore1: 5, vScore2: 5 });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    point();
    expect(cue()).toHaveTextContent('Match point · Royals');
    undo();
    expect(cue()).toBeNull();
  });

  it('uses warning token pairs with at least 6:1 contrast in both themes', () => {
    for (const palette of [paletteHex, paletteDarkHex]) {
      const channel = (hex, i) => Number.parseInt(hex.slice(i, i + 2), 16);
      const foreground = '#' + [1, 3, 5].map(i => Math.round(channel(palette.warning, i) * 0.99 + channel(palette.ink, i) * 0.01).toString(16).padStart(2, '0')).join('');
      expect(contrastRatio(foreground, palette.warningSoft)).toBeGreaterThanOrEqual(6);
    }
  });
});
