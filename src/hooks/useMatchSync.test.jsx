import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMatchSync } from './useMatchSync';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => save }));

const options = { sport: 'football', isAuthenticated: true, user: { _id: 'owner' }, team1Players: [], team2Players: [] };
const match = { id: 'm1', team1: 'North', team2: 'South', score1: 2, score2: 1, winner: 'North', date: '2026-11-01T12:00:00Z' };
const key = 'se_pending_match:owner:quick%3Afootball%3Am1';
beforeEach(() => { localStorage.clear(); save.mockReset(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
afterEach(cleanup);

it('keeps a durable pending record when a save fails', async () => {
  save.mockRejectedValue(new Error('Unavailable'));
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  expect(result.current.syncState).toBe('failed');
  expect(JSON.parse(localStorage.getItem(key))).toMatchObject({ payload: { clientMatchId: 'quick:football:m1' }, state: 'failed' });
});

it('reconnect retries the same clientMatchId and removes only the confirmed record', async () => {
  save.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue('server-id');
  const { result } = renderHook(() => useMatchSync(options));
  await act(async () => { await result.current.syncMatch(match); });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0].clientMatchId).toBe(save.mock.calls[0][0].clientMatchId);
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  expect(result.current.syncState).toBe('synced');
});

it('recovers a pending save after the hook unmounts and remounts', async () => {
  save.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue('server-id');
  const first = renderHook(() => useMatchSync(options));
  await act(async () => { await first.result.current.syncMatch(match); });
  first.unmount();
  renderHook(() => useMatchSync(options));
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(localStorage.getItem(key)).toBeNull();
});

it('leaves guest results local without sync status or pending records', async () => {
  const { result } = renderHook(() => useMatchSync({ ...options, isAuthenticated: false, user: null }));
  await act(async () => { await result.current.syncMatch(match); });
  expect(result.current.syncState).toBe('idle');
  expect(localStorage.getItem(key)).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it('does not retry another account pending records', async () => {
  save.mockRejectedValue(new Error('Unavailable'));
  const { result, rerender } = renderHook((props) => useMatchSync(props), { initialProps: options });
  await act(async () => { await result.current.syncMatch(match); });
  rerender({ ...options, user: { _id: 'other-owner' } });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(key)).not.toBeNull();
});
