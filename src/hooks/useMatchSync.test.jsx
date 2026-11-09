import { matchStorageKey } from '../utils/accountStorage';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMatchSync } from './useMatchSync';
import { ConvexError } from 'convex/values';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => save }));

const options = { sport: 'football', isAuthenticated: true, user: { _id: 'owner' }, team1Players: [], team2Players: [] };
const match = { id: 'm1', team1: 'North', team2: 'South', score1: 2, score2: 1, winner: 'North', date: '2026-11-01T12:00:00Z' };
const key = 'se_pending_match:owner:quick%3Afootball%3Am1';
beforeEach(() => { localStorage.clear(); save.mockReset(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('keeps a durable pending record when a save fails', async () => {
  save.mockRejectedValue(new Error('Unavailable'));
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  expect(result.current.syncState).toBe('failed');
  expect(JSON.parse(localStorage.getItem(matchStorageKey(key)))).toMatchObject({ payload: { clientMatchId: 'quick:football:m1' }, state: 'failed' });
});

it('reconnect retries the same clientMatchId and removes only the confirmed record', async () => {
  save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('server-id');
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  vi.spyOn(Date, 'now').mockReturnValue(JSON.parse(localStorage.getItem(matchStorageKey(key))).nextAttemptAt);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0].clientMatchId).toBe(save.mock.calls[0][0].clientMatchId);
  await waitFor(() => expect(localStorage.getItem(matchStorageKey(key))).toBeNull());
  expect(result.current.syncState).toBe('synced');
});

it('recovers a pending save after the hook unmounts and remounts', async () => {
  save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('server-id');
  const first = renderHook(() => useMatchSync(options));
  await act(async () => { await first.result.current.syncMatch(match); });
  vi.spyOn(Date, 'now').mockReturnValue(JSON.parse(localStorage.getItem(matchStorageKey(key))).nextAttemptAt);
  first.unmount();
  renderHook(() => useMatchSync(options));
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(localStorage.getItem(matchStorageKey(key))).toBeNull();
});

it('leaves guest results local without sync status or pending records', async () => {
  const { result } = renderHook(() => useMatchSync({ ...options, isAuthenticated: false, user: null }));
  await act(async () => { await result.current.syncMatch(match); });
  expect(result.current.syncState).toBe('idle');
  expect(localStorage.getItem(matchStorageKey(key))).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it('does not retry another account pending records', async () => {
  save.mockRejectedValue(new Error('Unavailable'));
  const { result, rerender } = renderHook((props) => useMatchSync(props), { initialProps: options });
  await act(async () => { await result.current.syncMatch(match); });
  rerender({ ...options, user: { _id: 'other-owner' } });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(matchStorageKey(key))).not.toBeNull();
});

it('backs off failed requests instead of retrying in a tight loop', async () => {
  vi.useFakeTimers();
  save.mockRejectedValue(new TypeError('Failed to fetch'));
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(save).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
  expect(save).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(save).toHaveBeenCalledTimes(3);
});

it('retries on foreground and retains the local score after a failure', async () => {
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ ...match, sport: 'football', status: 'completed' }]));
  save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('server-id');
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  vi.spyOn(Date, 'now').mockReturnValue(JSON.parse(localStorage.getItem(matchStorageKey(key))).nextAttemptAt);
  expect(JSON.parse(localStorage.getItem(matchStorageKey('se_quickmatches')))[0]).toMatchObject({ score1: 2, score2: 1 });
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(JSON.parse(localStorage.getItem(matchStorageKey('se_quickmatches')))[0].sync.status).toBe('synced');
});

it('queues during account bootstrap and sends when that same account is ready', async () => {
  const initialProps = { ...options, user: null, clerkUser: { id: 'clerk-owner' } };
  save.mockResolvedValue('server-id');
  const { result, rerender } = renderHook((props) => useMatchSync(props), { initialProps });
  await act(async () => { await result.current.syncMatch(match); });
  expect(save).not.toHaveBeenCalled();
  expect(localStorage.getItem(matchStorageKey('se_pending_match:clerk-owner:quick%3Afootball%3Am1'))).not.toBeNull();
  rerender({ ...initialProps, user: options.user });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});

it('preserves a dedicated scorer clientMatchId on every retry', async () => {
  save.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue('server-id');
  const { result } = renderHook(() => useMatchSync({ ...options, sport: 'tennis' }));
  await act(async () => { await result.current.syncMatch({ ...match, clientMatchId: 'tennis:quick:m1' }); });
  await act(async () => { await result.current.retrySync(); });
  expect(save.mock.calls.map(([payload]) => payload.clientMatchId)).toEqual(['tennis:quick:m1', 'tennis:quick:m1']);
});

it.each([
  new ConvexError('Result rejected'),
  new Error('[CONVEX M(matches:save)] ArgumentValidationError: invalid score'),
  new Error('[CONVEX M(matches:save)] Unauthenticated'),
])('retains terminal server rejections for manual Retry only: %s', async (error) => {
  vi.useFakeTimers();
  save.mockRejectedValue(error);
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  expect(JSON.parse(localStorage.getItem(matchStorageKey(key)))).toMatchObject({ state: 'failed', terminal: true });
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(600000);
  });
  expect(save).toHaveBeenCalledTimes(1);
  save.mockResolvedValue('server-id');
  await act(async () => { await result.current.retrySync(); });
  expect(save).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem(matchStorageKey(key))).toBeNull();
});

it('foreground and reconnect respect the deadline; only manual Retry overrides it', async () => {
  vi.useFakeTimers();
  save.mockRejectedValue(new TypeError('Failed to fetch'));
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(4999);
  });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.retrySync(); });
  expect(save).toHaveBeenCalledTimes(2);
});
