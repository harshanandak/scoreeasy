import { freezeSetsFormat } from '../../models/setsRules';
import { getSportById } from '../../models/sportRegistry';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const ctx = vi.hoisted(() => ({ draft: null, saved: null }));
const savedMatch = vi.hoisted(() => vi.fn(() => true));
vi.mock('convex/react', () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: 'tabletennis' }),
  useLocation: () => ({ pathname: '/tabletennis/quick', search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn(), isLive: false }) }));
vi.mock('../../lib/live/liveSession', () => ({ getConsent: () => 'declined', loadSession: () => null, saveSession: vi.fn() }));
vi.mock('../../utils/storage', () => ({
  listDataKeys: () => [],
  loadData: (key, fallback) => key === 'se_quickmatch_draft_tabletennis' ? ctx.draft : fallback,
  loadQuickMatch: () => null, clearData: vi.fn(), saveQuickMatch: savedMatch,
  isStaleQuickMatchDraft: () => false,
  saveData: (key, value) => { if (key.startsWith('se_quickmatch_draft_tabletennis_')) ctx.saved = structuredClone(value); return true; },
}));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');
const board = () => document.querySelector('[data-team-board]');
const key = (name) => screen.getByRole('button', { name: `Add point for ${name}` });
const undo = () => screen.getByRole('button', { name: 'Undo last action' });
function seed(score1 = 0, score2 = 0, extra = {}) {
  ctx.draft = {
    phase: 'scoring', sport: 'tabletennis', quickMatchId: 3003,
    team1Name: 'Royals', team2Name: 'Strikers', team1Color: '#7c3aed', team2Color: '#fbbf24',
    format: { type: 'best-of', sets: 5, points: 11 },
    sets: [{ score1, score2, completed: false }], currentSet: 0, servingTeam: 1,
    ...extra,
  };
}
beforeEach(() => { ctx.draft = null; ctx.saved = null; savedMatch.mockClear(); });


describe('quick match shared service rules', () => {
  const format = (initialServer = null) => freezeSetsFormat(getSportById('tabletennis'), { type: 'best-of', sets: 5, points: 11, initialServer });

  it('keeps unknown service through a point and refresh without inventing a marker', async () => {
    seed(0, 0, { format: format(), servingTeam: null });
    const view = render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    expect(board()).toHaveTextContent('Server unknown');
    expect(screen.queryByText('Serving')).toBeNull();
    fireEvent.click(key('Royals'));
    expect(ctx.saved.servingTeam).toBeNull();
    ctx.draft = structuredClone(ctx.saved);
    view.unmount();
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    expect(board()).toHaveTextContent('Server unknown');
    fireEvent.click(undo());
    expect(ctx.saved.servingTeam).toBeNull();
    expect(ctx.saved.sets[0].score1).toBe(0);
  });

  it('switches at 10-all, and undo restores the previous service and score', async () => {
    seed(10, 9, { format: format(1), servingTeam: 2 });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Strikers' });
    expect(within(key('Strikers')).getByText('Serving')).toBeTruthy();
    fireEvent.click(key('Strikers'));
    expect(ctx.saved.sets[0]).toMatchObject({ score1: 10, score2: 10 });
    expect(ctx.saved.servingTeam).toBe(1);
    expect(within(key('Royals')).getByText('Serving')).toBeTruthy();
    fireEvent.click(undo());
    expect(ctx.saved.servingTeam).toBe(2);
    expect(ctx.saved.sets[0]).toMatchObject({ score1: 10, score2: 9 });
  });

  it('restores the game boundary, first server and ends after refresh and undo', async () => {
    seed(10, 8, { format: format(2), servingTeam: 1 });
    const view = render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Royals' }));
    await waitFor(() => expect(board()).toHaveTextContent('Game 2'));
    expect(ctx.saved.servingTeam).toBe(1);
    expect(ctx.saved.sidesSwapped).toBe(true);
    ctx.draft = structuredClone(ctx.saved);
    view.unmount();
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    fireEvent.click(undo());
    expect(ctx.saved).toMatchObject({ currentSet: 0, servingTeam: 1, sidesSwapped: false });
    expect(ctx.saved.sets).toEqual([{ score1: 10, score2: 8, completed: false }]);
  });
});
