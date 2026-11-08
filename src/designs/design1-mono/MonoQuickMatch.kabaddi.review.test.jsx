import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { applyRaid, startHalf, timeUp } from '../../utils/kabaddiEngine';
import { createKabaddiMatch } from '../../utils/kabaddiQuickMatch';
import { resolveKabaddiRules } from '../../utils/kabaddiRules';
import { clearData, listDataKeys, loadData, loadQuickMatch, saveData, saveQuickMatch } from '../../utils/storage';
import { loadQuickMatchDrafts } from '../../utils/appEntry';

const ctx = vi.hoisted(() => ({ search: '' }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined, useConvex: () => ({ query: async () => null }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ sport: 'kabaddi' }), useLocation: () => ({ pathname: '/kabaddi/quick', search: ctx.search }), useSearchParams: () => [new URLSearchParams(ctx.search), vi.fn()] }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }) }));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');

const ID = 'review-game';
const KEY = `se_quickmatch_draft_kabaddi_${ID}`;
const OLD_BACKUP = `${KEY}_before_kabaddi_v2`;
const BACKUP = `se_kabaddi_backup_kabaddi_${ID}_before_kabaddi_v2`;
const HALF_MS = 60000;
const names = ['Royals', 'Strikers'];
const finish = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  fireEvent.click(screen.getByRole('button', { name: 'End match' }));
};
const store = (match) => {
  const draft = { phase: 'scoring', sport: 'kabaddi', quickMatchId: ID, team1Name: names[0], team2Name: names[1], format: { kabaddiRules: match.state.rules }, kabaddi: match };
  expect(saveData(KEY, draft)).toBe(true);
  ctx.search = `?resume=${ID}`;
  return draft;
};
const secondHalf = () => {
  const rules = resolveKabaddiRules('custom', { ...resolveKabaddiRules('standard'), end: { kind: 'timed', halves: 2, halfMs: HALF_MS, intervalMs: 0 } });
  const match = createKabaddiMatch({ format: { kabaddiRules: rules }, names });
  let state = startHalf(match.state, { atMs: Date.now() - HALF_MS });
  state = applyRaid(state, { id: 'first-half-point', type: 'touch', count: 1, atMs: Date.now() - HALF_MS });
  return { ...match, state: startHalf(timeUp(state), { atMs: Date.now() }) };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
  listDataKeys().forEach(clearData);
  ctx.search = '';
});
afterEach(() => vi.useRealTimers());

describe('kabaddi scorer review regressions with durable storage', () => {
  it('records early Call full time as abandoned with no winner, even after refresh', () => {
    store(secondHalf());
    let mounted = render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Call full time' }));
    mounted.unmount();
    mounted = render(<MonoQuickMatch />);
    finish();
    expect(loadQuickMatch(ID)).toMatchObject({ resultType: 'abandoned', winner: null, score1: 1, score2: 0 });
  });

  it('records Call full time after the configured half expires as decided', () => {
    store(secondHalf());
    render(<MonoQuickMatch />);
    act(() => vi.advanceTimersByTime(HALF_MS));
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Call full time' }));
    finish();
    expect(loadQuickMatch(ID)).toMatchObject({ resultType: 'decided', winner: 'Royals', score1: 1, score2: 0 });
  });

  it('keeps the migration original outside draft discovery after finish and bare-route reopen', async () => {
    const legacy = await import('../../utils/kabaddiLegacyEngine');
    const original = store({ state: legacy.startHalf(legacy.createKabaddiState({ names })) });
    let mounted = render(<MonoQuickMatch />);
    const backupKey = listDataKeys().find(key => key !== KEY && key.includes('before_kabaddi_v2'));
    expect(loadData(backupKey)).toEqual(original);
    finish();
    mounted.unmount();
    ctx.search = '';
    mounted = render(<MonoQuickMatch />);
    expect(loadData(backupKey)).toEqual(original);
    expect(backupKey).toBe(BACKUP);
    expect(loadQuickMatchDrafts().filter(draft => draft.sport === 'kabaddi')).toEqual([]);
  });

  it('relocates an already-written old-prefix backup before completed-match hydration', async () => {
    const legacy = await import('../../utils/kabaddiLegacyEngine');
    const original = { phase: 'scoring', sport: 'kabaddi', quickMatchId: ID, team1Name: names[0], team2Name: names[1], kabaddi: { state: legacy.startHalf(legacy.createKabaddiState({ names })) } };
    saveData(OLD_BACKUP, original);
    saveQuickMatch({ id: ID, sport: 'kabaddi', status: 'completed', resultType: 'abandoned', winner: null, team1: names[0], team2: names[1], score1: 0, score2: 0 });
    render(<MonoQuickMatch />);
    expect(loadData(BACKUP)).toEqual(original);
    expect(loadData(OLD_BACKUP)).toBeNull();
    expect(loadQuickMatchDrafts().filter(draft => draft.sport === 'kabaddi')).toEqual([]);
  });

  it('hides Stepped out when the boundary rule is none', () => {
    const rules = resolveKabaddiRules('custom', { ...resolveKabaddiRules('quick'), boundary: 'none' });
    store(createKabaddiMatch({ format: { kabaddiRules: rules }, names }));
    render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Raid by Royals' }));
    expect(screen.queryByRole('button', { name: 'Stepped out' })).toBeNull();
  });

  it('reopens a completed legacy goals-format result without changing its stored outcome', () => {
    saveQuickMatch({ id: ID, sport: 'kabaddi', status: 'completed', team1: names[0], team2: names[1], score1: 23, score2: 17, winner: names[0], format: { mode: 'free' } });
    const original = loadQuickMatch(ID);
    ctx.search = `?result=${ID}`;
    render(<MonoQuickMatch />);
    const result = screen.getByRole('region', { name: 'Match result' });
    expect(within(result).getByText('Royals won. Won by 6 points. Royals 23, Strikers 17.')).toBeInTheDocument();
    expect(within(result).getByRole('heading', { name: 'Winner: Royals' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Raid by Royals' })).toBeNull();
    expect(loadQuickMatch(ID)).toEqual(original);
    expect(loadQuickMatchDrafts().filter(draft => draft.sport === 'kabaddi')).toEqual([]);
  });
});
