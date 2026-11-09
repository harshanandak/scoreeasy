import { matchStorageKey, setMatchStorageScope } from '../utils/accountStorage';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { AuthContext } from '../auth/AuthContext';
import { usePendingMatchSaves } from './usePendingMatchSaves';
import { enqueueMatchSave, pendingMatchSaves } from '../utils/pendingMatchSaves';
import MatchSyncStatus from '../designs/design1-mono/components/MatchSyncStatus';

const h = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => h, useMutation: name => h[name] }));
vi.mock('../../convex/_generated/api', () => ({ api: {
  matches: { save: 'save' },
} }));
vi.mock('../mobile/lifecycle', () => ({ addAppStateChangeListener: async () => () => {} }));
const auth = id => ({ isAuthenticated: Boolean(id), clerkUser: id ? { id } : null, user: id ? { _id: `db-${id}` } : null });
const wrapper = ({ account, children }) => <AuthContext.Provider value={auth(account)}>{children}</AuthContext.Provider>;
const mismatch = () => new ConvexError({ code: 'owner_mismatch', message: 'Queued action belongs to another account' });
const payload = { sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1, clientMatchId: 'bound-result' };
beforeEach(() => {
  localStorage.clear(); setMatchStorageScope('A'); vi.resetAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('retains A\'s submitted save rejected after switching to B, hides its status, and retries automatically for A', async () => {
  let reject;
  h.save.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue('saved');
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ ...payload, id: 'local-bound', status: 'completed' }]));
  enqueueMatchSave('A', payload, 'local-bound');
  const worker = renderHook(({ account }) => usePendingMatchSaves(auth(account)), { initialProps: { account: 'A' } });
  await act(async () => { await Promise.resolve(); });
  expect(h.save).toHaveBeenCalledExactlyOnceWith({ ...payload, expectedOwnerId: 'A' });
  worker.rerender({ account: 'B' });
  await act(async () => { reject(mismatch()); });
  expect(pendingMatchSaves('A')).toMatchObject([{ ownerId: 'A', state: 'pending', terminal: false }]);
  render(wrapper({ account: 'B', children: <MatchSyncStatus clientMatchId={payload.clientMatchId} quickMatchId="local-bound" /> }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => { globalThis.dispatchEvent(new Event('focus')); });
  expect(h.save).toHaveBeenCalledTimes(1);
  worker.rerender({ account: null });
  worker.rerender({ account: 'A' });
  await act(async () => { await Promise.resolve(); });
  expect(h.save).toHaveBeenCalledTimes(2);
  expect(h.save.mock.calls[1][0].expectedOwnerId).toBe('A');
  expect(pendingMatchSaves('A')).toEqual([]);
});

it.each(['acknowledge', 'reject'])('handles a same-account signout/signin with a late save %s', async outcome => {
  const samePayload = { ...payload, clientMatchId: `same-account-${outcome}` };
  let settle;
  h.save.mockImplementationOnce(() => new Promise((resolve, reject) => { settle = outcome === 'acknowledge' ? resolve : reject; })).mockResolvedValue('saved');
  enqueueMatchSave('same-A', samePayload);
  const worker = renderHook(({ account }) => usePendingMatchSaves(auth(account)), { initialProps: { account: 'same-A' } });
  await act(async () => { await Promise.resolve(); });
  worker.rerender({ account: null });
  await act(async () => { settle(outcome === 'acknowledge' ? 'saved' : mismatch()); });
  worker.rerender({ account: 'same-A' });
  await waitFor(() => expect(pendingMatchSaves('same-A')).toEqual([]));
  expect(h.save).toHaveBeenCalledTimes(outcome === 'acknowledge' ? 1 : 2);
  for (const [args] of h.save.mock.calls) expect(args.expectedOwnerId).toBe('same-A');
});

it('retries a late owner mismatch with normal backoff when A returned before B rejection arrived', async () => {
  vi.useFakeTimers();
  const latePayload = { ...payload, clientMatchId: 'late-mismatch-after-return' };
  let reject;
  h.save.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue('saved');
  enqueueMatchSave('late-A', latePayload);
  const worker = renderHook(({ account }) => usePendingMatchSaves(auth(account)), { initialProps: { account: 'late-A' } });
  await act(async () => { await Promise.resolve(); });
  expect(h.save).toHaveBeenCalledExactlyOnceWith({ ...latePayload, expectedOwnerId: 'late-A' });
  worker.rerender({ account: 'B' });
  worker.rerender({ account: 'late-A' });
  const rejectedAt = Date.now();
  await act(async () => { reject(mismatch()); });
  expect(pendingMatchSaves('late-A')).toMatchObject([{
    ownerId: 'late-A', state: 'pending', terminal: false, ownerMismatch: false,
    attempts: 1, nextAttemptAt: rejectedAt + 5000,
  }]);
  await act(async () => {
    globalThis.dispatchEvent(new Event('focus'));
    globalThis.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(4999);
  });
  expect(h.save).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(h.save).toHaveBeenCalledTimes(2);
  expect(h.save.mock.calls[1][0]).toEqual({ ...latePayload, expectedOwnerId: 'late-A' });
  expect(pendingMatchSaves('late-A')).toEqual([]);
});
