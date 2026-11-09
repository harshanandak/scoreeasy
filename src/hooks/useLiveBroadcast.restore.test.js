import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLiveBroadcast } from './useLiveBroadcast';
import { usePendingLiveFinalizations } from './usePendingLiveFinalizations';
import { loadSession, saveSession } from '../lib/live/liveSession';
import { enqueue, load } from '../lib/live/outbox';

const h = vi.hoisted(() => ({
  query: vi.fn(), create: vi.fn(), scorePoint: vi.fn(), undo: vi.fn(),
  finalize: vi.fn(), setVisibility: vi.fn(), online: true,
}));
vi.mock('convex/react', () => ({ useConvex: () => h, useMutation: name => h[name] }));
vi.mock('../../convex/_generated/api', () => ({ api: { live: {
  create: 'create', scorePoint: 'scorePoint', undo: 'undo', finalize: 'finalize',
  setVisibility: 'setVisibility', getOwnedSession: 'getOwnedSession',
} } }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { _id: 'owner' } }) }));
vi.mock('../mobile/lifecycle', () => ({ addAppStateChangeListener: async () => () => {} }));

const clientMatchId = 'restore-window';
const restoredSession = { matchId: 'live-restored', token: 'SHARE', lastSeq: 7, isShared: true };
const terminal = { pointsA: 5, pointsB: 3, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 };
const finish = { resultType: 'abandoned', snapshot: terminal };

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  localStorage.clear();
  h.online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => h.online);
  Object.values(h).filter(value => typeof value?.mockReset === 'function').forEach(value => value.mockReset());
  h.query.mockResolvedValue(restoredSession);
  h.scorePoint.mockResolvedValue({});
  h.finalize.mockResolvedValue({ archived: true });
});
afterEach(() => vi.restoreAllMocks());

async function expectRecovered(order) {
  await waitFor(() => {
    expect(h.finalize).toHaveBeenCalledExactlyOnceWith({ matchId: 'live-restored', resultType: 'abandoned' });
    expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  });
  expect(order).toEqual(['point', 'terminal', 'finalize']);
  expect(h.scorePoint.mock.calls.map(([args]) => args.clientEventId)).toEqual([
    `${clientMatchId}:8`, `${clientMatchId}:9`,
  ]);
  expect(h.scorePoint).toHaveBeenLastCalledWith(expect.objectContaining({
    matchId: 'live-restored', value: 0, type: 'correction', snapshot: terminal,
  }));
  expect(load()).toEqual([]);
  await act(async () => {
    globalThis.dispatchEvent(new Event('online'));
    globalThis.dispatchEvent(new Event('focus'));
  });
  expect(h.finalize).toHaveBeenCalledTimes(1);
  expect(h.create).not.toHaveBeenCalled();
  expect(h.setVisibility).not.toHaveBeenCalled();
}

it.each([true, false])('persists finish before shared restore resolves and drains terminal scores once (saved server id: %s)', async (hasMatchId) => {
  saveSession(clientMatchId, { seq: 7, isShared: true, ...(hasMatchId ? { matchId: 'live-restored', token: 'SHARE' } : {}) });
  const pending = deferred();
  h.query.mockReturnValue(pending.promise);
  h.online = false;
  const order = [];
  h.scorePoint.mockRejectedValue(new Error('offline'));
  const root = renderHook(() => usePendingLiveFinalizations());
  const scorer = renderHook(() => useLiveBroadcast());
  let restoring;
  await act(async () => { restoring = scorer.result.current.restore({ clientMatchId }); });
  await act(async () => {
    await scorer.result.current.point({ team: 'A', at: 1 });
    await scorer.result.current.finalize(finish);
  });
  expect(loadSession(clientMatchId)).toHaveProperty('finalizeIntent', { resultType: 'abandoned' });
  h.scorePoint.mockClear().mockImplementation(async ({ snapshot }) => { order.push(snapshot ? 'terminal' : 'point'); });
  h.finalize.mockImplementation(async () => { order.push('finalize'); });
  h.online = true;
  await act(async () => {
    pending.resolve(restoredSession);
    await restoring;
    globalThis.dispatchEvent(new Event('online'));
  });
  await expectRecovered(order);
  scorer.unmount();
  root.unmount();
});

it.each([true, false])('recovers finish after reload before shared restore resolves (enabled: %s)', async (enabled) => {
  // The persisted shared session can outlive its cached server id.
  saveSession(clientMatchId, { seq: 7, isShared: true });
  h.online = false;
  const pending = deferred();
  h.query.mockReturnValueOnce(pending.promise);
  const scorer = renderHook(() => useLiveBroadcast({ enabled }));
  let restoring;
  await act(async () => { restoring = scorer.result.current.restore({ clientMatchId }); });
  // A queued point predates reopening; finishing must append the next identity.
  enqueue({ kind: 'point', team: 'A', value: 1, at: 1, clientMatchId, clientEventId: `${clientMatchId}:8` });
  saveSession(clientMatchId, { ...loadSession(clientMatchId), seq: 8 });
  await act(async () => { await scorer.result.current.finalize(finish); });
  expect(loadSession(clientMatchId)).toHaveProperty('finalizeIntent', { resultType: 'abandoned' });
  scorer.unmount();
  const order = [];
  h.scorePoint.mockImplementation(async ({ snapshot }) => { order.push(snapshot ? 'terminal' : 'point'); });
  h.finalize.mockImplementation(async () => { order.push('finalize'); });
  h.online = true;
  const root = renderHook(() => usePendingLiveFinalizations());
  await expectRecovered(order);
  expect(h.query).toHaveBeenLastCalledWith('getOwnedSession', { clientMatchId });
  await act(async () => { pending.resolve(restoredSession); await restoring; });
  expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  root.unmount();
});

it.each([true, false])('does not write finish intent for a never-shared match while restore is pending (enabled: %s)', async (enabled) => {
  const pending = deferred();
  h.query.mockReturnValue(pending.promise);
  const scorer = renderHook(() => useLiveBroadcast({ enabled }));
  let restoring;
  await act(async () => { restoring = scorer.result.current.restore({ clientMatchId }); });
  await act(async () => {
    await scorer.result.current.point({ team: 'A', at: 1 });
    await scorer.result.current.finalize(finish);
  });
  expect(loadSession(clientMatchId)?.finalizeIntent).toBeUndefined();
  expect(load().some(item => item.snapshot === terminal || item.type === 'correction')).toBe(false);
  await act(async () => { pending.resolve(null); await restoring; });
  expect(h.finalize).not.toHaveBeenCalled();
  scorer.unmount();
});
