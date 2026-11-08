import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { pendingMatchSaves } from '../utils/pendingMatchSaves';
import { useTournamentMatchSync } from './useTournamentMatchSync';
import { usePendingMatchSaves } from './usePendingMatchSaves';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => save }));
let auth;
let sequence = 0;
const tournament = { id: 100, teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }], matches: [{ id: 1, team1Id: 'A', team2Id: 'B', score1: 2, score2: 1, status: 'completed', winner: 'A' }] };
function Worker() { usePendingMatchSaves(); return null; }
const wrapper = ({ children }) => <AuthContext.Provider value={auth}><Worker />{children}</AuthContext.Provider>;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('se_football', JSON.stringify([tournament]));
  auth = { isAuthenticated: true, user: { _id: `hook-owner-${++sequence}` } };
  save.mockReset();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('persists the fixture result before submitting it to the server', async () => {
  save.mockImplementation(async payload => {
    expect(pendingMatchSaves(auth.user._id)[0]).toMatchObject({ payload, tournamentMatch: { storageKey: 'se_football', tournamentId: 100, matchId: 1 } });
    return 'server-id';
  });
  const { result } = renderHook(() => useTournamentMatchSync({ sport: 'football', matchId: '1' }), { wrapper });
  await act(async () => { result.current(tournament); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(pendingMatchSaves(auth.user._id)).toEqual([]));
});

it('recovers an offline result after remount and foreground', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  save.mockResolvedValue('server-id');
  const first = renderHook(() => useTournamentMatchSync({ sport: 'football', matchId: '1' }), { wrapper });
  await act(async () => { first.result.current(tournament); });
  expect(save).not.toHaveBeenCalled();
  expect(pendingMatchSaves(auth.user._id)[0].state).toBe('pending');
  first.unmount();
  renderHook(() => useTournamentMatchSync({ sport: 'football', matchId: '1' }), { wrapper });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(pendingMatchSaves(auth.user._id)).toEqual([]));
  expect(save.mock.calls[0][0].clientMatchId).toBe('tournament:football:100:1');
});

it('queues during account bootstrap and sends only when that owner is ready', async () => {
  auth = { isAuthenticated: true, clerkUser: { id: `clerk-${sequence}` }, user: null };
  save.mockResolvedValue('server-id');
  const { result, rerender } = renderHook(() => useTournamentMatchSync({ sport: 'football', matchId: 1 }), { wrapper });
  await act(async () => { result.current(tournament); });
  expect(save).not.toHaveBeenCalled();
  expect(pendingMatchSaves(auth.clerkUser.id)).toHaveLength(1);
  auth = { ...auth, user: { _id: 'ready-user' } };
  rerender();
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});

it('keeps another account pending fixture private and does not drain it', async () => {
  save.mockRejectedValue(new TypeError('Failed to fetch'));
  const { result, rerender } = renderHook(() => useTournamentMatchSync({ sport: 'football', matchId: 1 }), { wrapper });
  await act(async () => { result.current(tournament); });
  await waitFor(() => expect(pendingMatchSaves(auth.user._id)[0].state).toBe('failed'));
  const originalOwner = auth.user._id;
  auth = { isAuthenticated: true, user: { _id: `other-${sequence}` } };
  rerender();
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(pendingMatchSaves(originalOwner)).toHaveLength(1);
  expect(pendingMatchSaves(auth.user._id)).toEqual([]);
});

it('respects the shared retry deadline on reconnect and foreground', async () => {
  vi.useFakeTimers();
  save.mockRejectedValue(new TypeError('Failed to fetch'));
  const { result } = renderHook(() => useTournamentMatchSync({ sport: 'football', matchId: 1 }), { wrapper });
  await act(async () => { result.current(tournament); });
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(4999);
  });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(save).toHaveBeenCalledTimes(2);
});
