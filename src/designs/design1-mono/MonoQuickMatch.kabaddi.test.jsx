import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createKabaddiMatch } from '../../utils/kabaddiQuickMatch';
import { resolveKabaddiRules } from '../../utils/kabaddiRules';

const ctx = vi.hoisted(() => ({ draft: null, fail: false, failBackup: false, backups: {}, writes: [], results: [] }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined, useConvex: () => ({ query: async () => null }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ sport: 'kabaddi' }), useLocation: () => ({ pathname: '/kabaddi/quick', search: '' }), useSearchParams: () => [new URLSearchParams(''), vi.fn()] }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }) }));
vi.mock('../../utils/storage', () => ({
  listDataKeys: () => [], loadQuickMatch: () => null, saveQuickMatch: data => { ctx.results.push(data); return true; }, clearData: () => true, isStaleQuickMatchDraft: () => false,
  loadData: (key, fallback) => key.includes('_before_') ? ctx.backups[key] || fallback : key.startsWith('se_quickmatch_draft_kabaddi') ? ctx.draft : fallback,
  saveData: (key, data) => {
    if (ctx.fail || (ctx.failBackup && key.includes('_before_'))) return false;
    ctx.writes.push({ key, data: structuredClone(data) });
    if (key.includes('_before_')) ctx.backups[key] = structuredClone(data);
    else if (key.startsWith('se_quickmatch_draft_kabaddi')) ctx.draft = data;
    return true;
  },
}));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');

beforeEach(() => {
  vi.useFakeTimers(); ctx.fail = false; ctx.failBackup = false; ctx.backups = {}; ctx.writes = []; ctx.results = [];
  const format = { kabaddiRules: resolveKabaddiRules('quick') };
  ctx.draft = { phase: 'scoring', sport: 'kabaddi', quickMatchId: 'raid-game', team1Name: 'Royals', team2Name: 'Strikers', format,
    kabaddi: createKabaddiMatch({ format, names: ['Royals', 'Strikers'], colours: [undefined, undefined] }) };
});
afterEach(() => vi.useRealTimers());
const start = () => fireEvent.click(screen.getByRole('button', { name: 'Raid by Royals' }));

describe('kabaddi raid route', () => {
  it('uses the shared abandoned outcome after an early raid-game finish', () => {
    render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(ctx.results).toHaveLength(1);
    expect(ctx.results[0]).toMatchObject({ resultType: 'abandoned', winner: null });
  });

  it('retains the complete original v1 record before replacing the saved draft', async () => {
    const legacy = await import('../../utils/kabaddiLegacyEngine');
    ctx.draft.kabaddi = { state: legacy.startHalf(legacy.createKabaddiState()) };
    const original = structuredClone(ctx.draft);
    render(<MonoQuickMatch />);
    expect(ctx.writes[0].key).toMatch(/_before_kabaddi_v2$/);
    expect(ctx.writes[0].data).toEqual(original);
    expect(Object.values(ctx.backups)).toEqual([original]);
    expect(ctx.writes.find(write => !write.key.includes('_before_')).data.kabaddi.state.version).toBe(2);
    expect(ctx.draft.kabaddi.state.version).toBe(2);
  });

  it('keeps the original v1 record untouched when its backup cannot be saved', async () => {
    const legacy = await import('../../utils/kabaddiLegacyEngine');
    ctx.draft.kabaddi = { state: legacy.startHalf(legacy.createKabaddiState()) };
    const original = structuredClone(ctx.draft);
    ctx.failBackup = true;
    render(<MonoQuickMatch />);
    expect(ctx.draft).toEqual(original);
    expect(ctx.writes).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Raid by Royals' })).toBeNull();
  });

  it('shows no clocks or bonus for Quick casual and scores a one-touch raid in two taps', () => {
    render(<MonoQuickMatch />);
    expect(screen.queryByRole('button', { name: /Bonus line/ })).toBeNull();
    expect(screen.queryByText(/second clock/)).toBeNull();
    expect(screen.queryByRole('button', { name: /clock|0:00/i })).toBeNull();
    start();
    fireEvent.click(within(screen.getByRole('group', { name: 'Quick touch count' })).getByRole('button', { name: '+1' }));
    expect(screen.getByLabelText('Royals score')).toHaveTextContent('1');
    expect(ctx.draft.kabaddi.state.mat.map(m => m.length)).toEqual([5, 5]);
  });

  it('restores live marks and reopens a landed raid after refresh', () => {
    let mounted = render(<MonoQuickMatch />); start();
    fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
    mounted.unmount(); mounted = render(<MonoQuickMatch />);
    expect(screen.getByRole('button', { name: 'Player 1, touched' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Back safe/ }));
    expect(screen.getByLabelText('Royals score')).toHaveTextContent('1');
    mounted.unmount(); render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(screen.getByLabelText('Royals score')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Player 1, touched' })).toBeInTheDocument();
  });

  it('refuses to acknowledge a mark when storage is full', () => {
    render(<MonoQuickMatch />); start(); ctx.fail = true;
    fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
    expect(screen.getByRole('button', { name: 'Player 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/last tap was not accepted/)).toBeInTheDocument();
  });

  it('steps Undo through the live mark and then cancels the raid', () => {
    render(<MonoQuickMatch />); start();
    fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(screen.getByRole('button', { name: 'Player 1' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(screen.getByRole('button', { name: 'Raid by Royals' })).toBeInTheDocument();
  });
});
