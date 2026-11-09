import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { AuthContext } from '../auth/AuthContext';
import { usePendingMatchSaves } from './usePendingMatchSaves';
import { useLiveBroadcast } from './useLiveBroadcast';
import { usePendingLiveFinalizations } from './usePendingLiveFinalizations';
import { enqueueMatchSave, pendingMatchSaves } from '../utils/pendingMatchSaves';
import { flushLiveSession } from '../lib/live/recovery';
import { loadSession, saveSession } from '../lib/live/liveSession';
import { enqueue, load } from '../lib/live/outbox';
import MatchSyncStatus from '../designs/design1-mono/components/MatchSyncStatus';

const h = vi.hoisted(() => ({ save: vi.fn(), query: vi.fn(), create: vi.fn(), scorePoint: vi.fn(), undo: vi.fn(), finalize: vi.fn(), setVisibility: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => h, useMutation: name => h[name] }));
vi.mock('../../convex/_generated/api', () => ({ api: {
  matches: { save: 'save' }, live: { create: 'create', scorePoint: 'scorePoint', undo: 'undo', finalize: 'finalize', setVisibility: 'setVisibility', getOwnedSession: 'getOwnedSession' },
} }));
vi.mock('../mobile/lifecycle', () => ({ addAppStateChangeListener: async () => () => {} }));
const auth = id => ({ isAuthenticated: Boolean(id), clerkUser: id ? { id } : null, user: id ? { _id: `db-${id}` } : null });
const wrapper = ({ account, children }) => <AuthContext.Provider value={auth(account)}>{children}</AuthContext.Provider>;
const mismatch = () => new ConvexError({ code: 'owner_mismatch', message: 'Queued action belongs to another account' });
const payload = { sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1, clientMatchId: 'bound-result' };
const snapshot = { pointsA: 2, pointsB: 1, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 };
beforeEach(() => {
  localStorage.clear(); vi.resetAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  h.query.mockResolvedValue(null);
});
afterEach(cleanup);

it('retains A\'s submitted save rejected after switching to B, hides its status, and retries automatically for A', async () => {
  let reject;
  h.save.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue('saved');
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...payload, id: 'local-bound', status: 'completed' }]));
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

it.each(['point', 'undo', 'finalize'])('keeps an already-submitted live %s and its finish intent through an account switch', async kind => {
  const cmid = `bound-${kind}`;
  saveSession(cmid, { ownerId: 'A', matchId: 'server-A', isShared: true, seq: 1, finalizeIntent: { shared: true } });
  if (kind !== 'finalize') enqueue({ kind, clientMatchId: cmid, clientEventId: `${cmid}:1`, team: 'A', value: 1, at: 1 });
  let reject;
  const mutation = kind === 'point' ? h.scorePoint : kind === 'undo' ? h.undo : h.finalize;
  mutation.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue({});
  h.finalize.mockResolvedValueOnce({});
  if (kind === 'finalize') h.finalize.mockReset().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue({});
  const worker = renderHook(({ account }) => wrapper({ account, children: null }), { initialProps: { account: 'A' } });
  let request;
  await act(async () => { request = flushLiveSession(cmid, { ...h, ownerId: 'A' }); await Promise.resolve(); });
  expect(mutation.mock.calls[0][0]).toMatchObject({ expectedOwnerId: 'A' });
  worker.rerender({ account: 'B' });
  await act(async () => { reject(mismatch()); await request; });
  expect(loadSession(cmid)).toMatchObject({ ownerId: 'A', finalizeIntent: { shared: true } });
  expect(loadSession(cmid).broadcastError).toBeUndefined();
  expect(load()).toHaveLength(kind === 'finalize' ? 0 : 1);
  mutation.mockClear();
  await act(async () => { await flushLiveSession(cmid, { ...h, ownerId: 'B' }); });
  expect(mutation).not.toHaveBeenCalled();
  await act(async () => { await flushLiveSession(cmid, { ...h, ownerId: 'A' }); });
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(load()).toEqual([]);
  expect(loadSession(cmid)).not.toHaveProperty('finalizeIntent');
});

it('root recovery skips other accounts\' sessions and their errors, then drains when A returns', async () => {
  saveSession('root-bound', { ownerId: 'A', matchId: 'server-A', isShared: true, finalizeIntent: { shared: true } });
  saveSession('error-bound', { ownerId: 'A', broadcastError: { message: 'A only' } });
  const hook = renderHook(() => usePendingLiveFinalizations(), { wrapper: ({ children }) => wrapper({ account: 'B', children }) });
  await act(async () => { await Promise.resolve(); });
  expect(h.finalize).not.toHaveBeenCalled();
  expect(hook.result.current).toEqual([]);
  hook.unmount();
  renderHook(() => usePendingLiveFinalizations(), { wrapper: ({ children }) => wrapper({ account: 'A', children }) });
  await act(async () => { await flushLiveSession('root-bound', { ...h, ownerId: 'A' }); });
  expect(h.finalize).toHaveBeenCalledExactlyOnceWith({ matchId: 'server-A', expectedOwnerId: 'A' });
});

it('captures the live owner before create/publication submission and blocks B from restoring or changing it', async () => {
  h.create.mockResolvedValue({ matchId: 'server-A', token: 'TOKEN' });
  h.setVisibility.mockResolvedValue({ ok: true });
  const hook = renderHook(() => useLiveBroadcast(), { wrapper: ({ children }) => wrapper({ account: 'A', children }) });
  await act(async () => { await hook.result.current.goLive({ clientMatchId: 'new-bound', sport: 'football', scorecardKind: 'goals', teamA: { name: 'A' }, teamB: { name: 'B' }, snapshot }); });
  expect(h.create.mock.calls[0][0]).toMatchObject({ expectedOwnerId: 'A' });
  expect(h.setVisibility.mock.calls[0][0]).toMatchObject({ expectedOwnerId: 'A' });
  expect(loadSession('new-bound')).toMatchObject({ ownerId: 'A' });
  hook.unmount();
  h.query.mockClear(); h.setVisibility.mockClear();
  const other = renderHook(() => useLiveBroadcast(), { wrapper: ({ children }) => wrapper({ account: 'B', children }) });
  await act(async () => { await other.result.current.restore({ clientMatchId: 'new-bound' }); });
  await act(async () => { await other.result.current.setVisibility('private'); });
  expect(h.query).not.toHaveBeenCalled();
  expect(h.setVisibility).not.toHaveBeenCalled();
  expect(other.result.current.token).toBeNull();
});
