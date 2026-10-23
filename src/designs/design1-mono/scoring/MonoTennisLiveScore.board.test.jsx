import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { contrastReport, deriveTeamColours } from '../../../lib/teamColour';
import { sportMarkMaskUrl } from '../../../lib/sportMarks';

const ctx = vi.hoisted(() => ({ draft: null, saved: null, navigate: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => ctx.navigate, useParams: () => ({ sport: 'tennis', matchId: 'g7' }), useLocation: () => ({ pathname: '/tennis/quick/live/g7', search: '' }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), isLive: false }) }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../../../utils/storage', () => ({
  loadData: () => ctx.draft, loadQuickMatch: () => null, clearData: vi.fn(),
  saveData: (_key, value) => { ctx.saved = structuredClone(value); return true; },
  saveQuickMatch: () => true, isStaleQuickMatchDraft: () => false,
  loadSportTournaments: () => [], saveSportTournament: () => true,
}));
const { default: Scorer } = await import('./MonoTennisLiveScore');
const blank = (extra = {}) => ({ games1: 0, games2: 0, points1: 0, points2: 0, isDeuce: false, advantage: null, isTiebreak: false, tiebreakPoints1: 0, tiebreakPoints2: 0, completed: false, ...extra });
const seed = (set = {}, previous = []) => {
  ctx.draft = { id: 'g7', sport: 'tennis', team1Name: 'Anya', team2Name: 'Ravi', team1Color: '#2563eb', team2Color: '#facc15', format: { sets: 3 }, sets: [...previous, blank(set), ...Array.from({ length: 2 - previous.length }, () => blank())] };
};
const key = name => screen.getByRole('button', { name: new RegExp(`^${name}:`) });
const score = name => key(name).querySelector('.tsb-big').textContent;
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
beforeEach(() => { seed(); ctx.saved = null; ctx.navigate.mockClear(); });

it('uses picked colours, serve dot and tennis mark, saves 15–0 and restores it with Undo after remount', async () => {
  const first = render(<Scorer storageMode="quick" />);
  await screen.findByRole('button', { name: /^Anya:/ });
  const board = () => document.querySelector('[data-tennis-board]');
  expect(board()).not.toBeNull();
  expect(board().style.getPropertyValue('--team-a-core')).toBe(deriveTeamColours('#2563eb', '#facc15').A.core);
  expect(board().style.getPropertyValue('--sport-mark')).toBe(sportMarkMaskUrl('tennis'));
  expect(key('Anya').querySelector('.tsb-mark')).not.toBeNull();
  expect(key('Anya').querySelector('.tennis-server')).toHaveTextContent('●');
  fireEvent.click(key('Anya'));
  expect(score('Anya')).toBe('15');
  expect(screen.getByRole('button', { name: 'Undo last action' })).toHaveTextContent('0–0');
  await waitFor(() => expect(ctx.saved.draftState.sets[0].points1).toBe(1));
  ctx.draft = ctx.saved; first.unmount(); render(<Scorer storageMode="quick" />);
  await screen.findByRole('button', { name: /^Anya:/ });
  expect(score('Anya')).toBe('15'); undo(); expect(score('Anya')).toBe('0');
});

it('labels deuce, advantage and game win, and undoes the game and advantage with serve restored', async () => {
  seed({ points1: 3, points2: 3, isDeuce: true });
  render(<Scorer storageMode="quick" />); await screen.findByRole('button', { name: /^Anya:/ });
  expect(screen.getByText('Deuce')).toBeVisible();
  let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now += 200);
  fireEvent.click(key('Anya')); expect(score('Anya')).toBe('AD');
  fireEvent.click(key('Anya')); expect(key('Anya')).toHaveTextContent('1 game');
  expect(document.querySelector('.mono-set-won')).toHaveTextContent('Anya wins Game 1');
  expect(key('Ravi').querySelector('.tsb-mark')).not.toBeNull();
  undo(); expect(score('Anya')).toBe('AD'); expect(key('Anya').querySelector('.tsb-mark')).not.toBeNull();
  undo(); expect(screen.getByText('Deuce')).toBeVisible();
  vi.restoreAllMocks();
});

it('shows the set strip and restores games, points and set number when undoing the set win', async () => {
  seed({ games1: 5, games2: 4, points1: 3 });
  render(<Scorer storageMode="quick" />); await screen.findByRole('button', { name: /^Anya:/ });
  fireEvent.click(key('Anya'));
  expect(screen.getByText('Set 1: 6-4')).toBeVisible(); expect(screen.getByText('Set 2 of 3')).toBeVisible();
  undo(); expect(screen.queryByText('Set 1: 6-4')).toBeNull(); expect(screen.getByText('Set 1 of 3')).toBeVisible();
  expect(score('Anya')).toBe('40'); expect(key('Anya')).toHaveTextContent('5 games');
});

it('distinguishes a tiebreak, restores its point and serve, and undoes entry into it', async () => {
  seed({ games1: 6, games2: 5, points2: 3 });
  render(<Scorer storageMode="quick" />); await screen.findByRole('button', { name: /^Anya:/ });
  let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now += 200);
  fireEvent.click(key('Ravi')); expect(screen.getByText('Tiebreak')).toBeVisible();
  fireEvent.click(key('Anya')); expect(score('Anya')).toBe('1');
  expect(key('Ravi').querySelector('.tsb-mark')).not.toBeNull(); undo(); expect(score('Anya')).toBe('0');
  expect(key('Anya').querySelector('.tsb-mark')).not.toBeNull(); undo(); expect(screen.queryByText('Tiebreak')).toBeNull();
  expect(score('Ravi')).toBe('40'); vi.restoreAllMocks();
});

it('keeps match complete undoable until Finish uses the shared result navigation', async () => {
  seed({ games1: 5, points1: 3 }, [blank({ games1: 6, completed: true })]);
  render(<Scorer storageMode="quick" />); await screen.findByRole('button', { name: /^Anya:/ });
  fireEvent.click(key('Anya')); expect(screen.getByText('Match Complete')).toBeVisible(); expect(key('Anya')).toBeDisabled();
  undo(); expect(key('Anya')).toBeEnabled(); expect(score('Anya')).toBe('40');
  let now = Date.now(); vi.spyOn(Date, 'now').mockImplementation(() => now += 200);
  fireEvent.click(key('Anya')); fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(ctx.navigate).toHaveBeenCalledWith('/tennis/quick?result=g7', { replace: true }); vi.restoreAllMocks();
});

it.each([['#2563eb', '#facc15'], ['#111111', '#facc15'], ['#ef4444', '#2563eb'], ['#c6e83a', '#c6e83a']])('gates every label with the tennis mark under it: %s / %s', (a, b) => {
  expect(contrastReport(deriveTeamColours(a, b)).filter(([, ratio, min]) => ratio < min)).toEqual([]);
});
