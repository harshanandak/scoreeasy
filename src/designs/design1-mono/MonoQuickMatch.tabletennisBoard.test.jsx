import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { contrastReport, deriveTeamColours } from '../../lib/teamColour';
import { sportMarkMaskUrl } from '../../lib/sportMarks';

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

describe('tabletennis team board', () => {
  it('starts from the picked setup colours in either existing format', async () => {
    render(<MonoQuickMatch />);
    const colours = await screen.findByRole('group', { name: 'Team A colour' });
    fireEvent.click(within(colours).getByRole('button', { name: 'More colours for Team A colour' }));
    fireEvent.click(within(colours).getByRole('button', { name: 'Purple' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Team B colour' })).getByRole('button', { name: 'Yellow' }));
    expect(screen.getByRole('button', { name: 'Best of 5' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Single game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start table tennis' }));
    await screen.findByRole('button', { name: 'Add point for Team A' });
    expect(board()).toHaveTextContent('First to 11');
    expect(board().style.getPropertyValue('--team-a-core')).toBe(deriveTeamColours('#6d28d9', '#facc15').A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(deriveTeamColours('#6d28d9', '#facc15').B.core);
    expect(undo()).toBeDisabled();
  });

  it('keeps quick scoring truthful while serve tracking is unavailable', async () => {
    seed(3, 2, { servingTeam: 2 });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    expect(board()).toHaveTextContent('Set 1');
    expect(board()).toHaveTextContent('Sets 0–0');
    expect(board().style.getPropertyValue('--sport-mark')).toBe(sportMarkMaskUrl('tabletennis'));
    expect(screen.queryByText('Serving')).toBeNull();
    expect(board().querySelector('.tsb-mark')).toBeNull();
    fireEvent.click(key('Strikers'));
    expect(ctx.saved.servingTeam).toBe(2);
    expect(undo()).toHaveTextContent('back to 3–2');
    fireEvent.click(undo());
    expect(ctx.saved.servingTeam).toBe(2);
  });

  it.each([[10, 9], [11, 10]])('advances a set from %i–%i and restores score, sets and stored server across refresh and undo', async (score1, score2) => {
    seed(score1, score2);
    const view = render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Royals' }));
    await waitFor(() => expect(board()).toHaveTextContent('Set 2'));
    expect(board()).toHaveTextContent('Sets 1–0');
    expect(undo()).toHaveTextContent(`back to ${score1}–${score2}`);
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    expect(screen.getByLabelText('Completed sets')).toHaveTextContent(`Set 1 ${score1 + 1}–${score2}`);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    ctx.draft = structuredClone(ctx.saved);
    view.unmount();
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    expect(board()).toHaveTextContent('Sets 1–0');
    fireEvent.click(undo());
    expect(board()).toHaveTextContent('Set 1');
    expect(board()).toHaveTextContent('Sets 0–0');
    expect(key('Royals').querySelector('.tsb-big')).toHaveTextContent(String(score1));
    expect(key('Strikers').querySelector('.tsb-big')).toHaveTextContent(String(score2));
    expect(ctx.saved.servingTeam).toBe(1);
    expect(ctx.saved).toMatchObject({ currentSet: 0, team1Color: '#7c3aed', team2Color: '#fbbf24' });
  });

  it('keeps deuce in the same set and undo restores the tied score', async () => {
    seed(10, 10);
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Royals' }));
    expect(board()).toHaveTextContent('Set 1');
    expect(key('Royals').querySelector('.tsb-big')).toHaveTextContent('11');
    fireEvent.click(undo());
    expect(key('Royals').querySelector('.tsb-big')).toHaveTextContent('10');
  });

  it('finishes best-of-five at the existing match-winning score through the existing completion path', async () => {
    seed(0, 0, { sets: [{ score1: 11, score2: 8, completed: true }, { score1: 11, score2: 9, completed: true }, { score1: 10, score2: 9, completed: false }], currentSet: 2 });
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Royals' }));
    await screen.findByRole('region', { name: 'Match result' });
    expect(savedMatch).toHaveBeenCalledWith(expect.objectContaining({ setsWon1: 3, setsWon2: 0, team1Color: '#7c3aed', team2Color: '#fbbf24' }));
    expect(screen.queryByRole('button', { name: 'Undo last action' })).toBeNull();
  });

  it('undoes from a late-set score without losing the completed set or the server', async () => {
    seed(0, 0, { sets: [{ score1: 11, score2: 8, completed: true }, { score1: 9, score2: 8, completed: false }], currentSet: 1, servingTeam: 2 });
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Royals' }));
    expect(key('Royals').querySelector('.tsb-big')).toHaveTextContent('10');
    expect(board()).toHaveTextContent('Sets 1–0');
    fireEvent.click(undo());
    expect(key('Royals').querySelector('.tsb-big')).toHaveTextContent('9');
    expect(ctx.saved.servingTeam).toBe(2);
    expect(board()).toHaveTextContent('Set 2');
    expect(board()).toHaveTextContent('Sets 1–0');
  });

  it('keeps colours and serve attached to the team across a side swap and manual Finish', async () => {
    seed(8, 6, { servingTeam: 2 });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Royals' });
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    const keys = [...document.querySelectorAll('.tsb-key')];
    expect(keys.map(k => k.dataset.team)).toEqual(['b', 'a']);
    expect(keys[0].querySelector('.tsb-mark')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const dialog = screen.getByRole('dialog', { name: 'End match?' });
    expect(dialog).toHaveTextContent('6–8');
    fireEvent.click(within(dialog).getByRole('button', { name: 'End match' }));
    await screen.findByRole('region', { name: 'Match result' });
    expect(savedMatch).toHaveBeenCalledWith(expect.objectContaining({ team1Color: '#7c3aed', team2Color: '#fbbf24', status: 'completed' }));
  });

  it('finishes a single set only with the existing two-point margin', async () => {
    seed(0, 0, { format: { type: 'single', target: 11 }, vScore1: 11, vScore2: 10 });
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Royals' }));
    await screen.findByRole('region', { name: 'Match result' });
    expect(savedMatch).toHaveBeenCalledWith(expect.objectContaining({ score1: 12, score2: 10, winner: 'Royals' }));
  });

  it('offers best of seven and retains the selected format', async () => {
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Best of 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start table tennis' }));
    await screen.findByRole('button', { name: 'Add point for Team A' });
    expect(ctx.saved.format).toMatchObject({ type: 'best-of', sets: 7, points: 11 });
  });

  it.each([['#7c3aed', '#fbbf24'], ['#111111', '#facc15'], ['#ef4444', '#2563eb'], ['#7c3aed', '#7c3aed']])('gates labels over the mark and sheen for %s v %s', (a, b) => {
    const report = contrastReport(deriveTeamColours(a, b));
    expect(report.length).toBeGreaterThan(0);
    expect(report.filter(([, ratio, min]) => ratio < min)).toEqual([]);
  });
});
