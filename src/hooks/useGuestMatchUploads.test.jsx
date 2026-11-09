import { withMatchStorageScope, setMatchStorageScope } from '../utils/accountStorage';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGuestMatchUploads } from './useGuestMatchUploads';
import { usePendingMatchSaves } from './usePendingMatchSaves';
import { loadQuickMatch, saveQuickMatch } from '../utils/storage';

const h = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => h.save }));
const account = id => ({ isAuthenticated: Boolean(id), clerkUser: id ? { id } : null, user: id ? { _id: `db-${id}` } : null });
beforeEach(() => {
  localStorage.clear(); setMatchStorageScope(null); h.save.mockReset();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name, run) => Promise.resolve().then(run) } });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  saveQuickMatch({ id: 'hook-guest', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, status: 'completed', completedAt: '2026-11-01' });
});
afterEach(cleanup);
it('automatically claims on sign-in and announces only the server acknowledgement for the active account', async () => {
  let resolve;
  h.save.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result, rerender } = renderHook(({ id }) => useGuestMatchUploads(usePendingMatchSaves(account(id))), { initialProps: { id: null } });
  expect(result.current).toBe('');
  rerender({ id: 'X' });
  await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
  expect(result.current).toBe('');
  await act(async () => { resolve('saved'); });
  await waitFor(() => expect(result.current).toBe('1 match saved to your account'));
  rerender({ id: 'Y' });
  expect(result.current).toBe('');
  rerender({ id: null });
  expect(result.current).toBe('');
  expect(h.save).toHaveBeenCalledTimes(1);
});
it('recovers an offline claim after refresh and reconnects once for its owner', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  h.save.mockResolvedValue('saved');
  const first = renderHook(() => useGuestMatchUploads(usePendingMatchSaves(account('X'))));
  await waitFor(() => expect(withMatchStorageScope('X', () => loadQuickMatch('hook-guest')).syncOwnerId).toBe('X'));
  expect(h.save).not.toHaveBeenCalled(); first.unmount();
  const second = renderHook(() => useGuestMatchUploads(usePendingMatchSaves(account('X'))));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await act(async () => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(second.result.current).toBe('1 match saved to your account'));
  expect(h.save).toHaveBeenCalledTimes(1);
});
