import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLiveBroadcast } from './useLiveBroadcast';
import { usePendingLiveFinalizations } from './usePendingLiveFinalizations';
import { loadSession, saveSession } from '../lib/live/liveSession';
import { flushLiveSession } from '../lib/live/recovery';
import { load } from '../lib/live/outbox';

const h = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), scorePoint: vi.fn(), undo: vi.fn(), finalize: vi.fn(), setVisibility: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => h, useMutation: name => h[name] }));
vi.mock('../../convex/_generated/api', () => ({ api: { live: {
  create: 'create', scorePoint: 'scorePoint', undo: 'undo', finalize: 'finalize',
  setVisibility: 'setVisibility', getOwnedSession: 'getOwnedSession',
} } }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { _id: 'owner' } }) }));
vi.mock('../mobile/lifecycle', () => ({ addAppStateChangeListener: async () => () => {} }));

const clientMatchId = 'publication-finish';
const session = { matchId: 'live-publication', token: 'SHARE', lastSeq: 7, isShared: true };
const snapshot = { pointsA: 5, pointsB: 3, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 };
const finish = { resultType: 'abandoned', snapshot };
const go = { clientMatchId, sport: 'football', scorecardKind: 'goals', teamA: { name: 'Alpha' }, teamB: { name: 'Beta' }, snapshot: { ...snapshot, pointsA: 4 } };

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  h.create.mockResolvedValue({ matchId: session.matchId, token: session.token });
  h.query.mockResolvedValue(session);
  h.scorePoint.mockResolvedValue({});
  h.finalize.mockResolvedValue({ archived: true });
});

async function expectFinalizedOnce() {
  await act(async () => { await flushLiveSession(clientMatchId, { ...h, getOwnedSession: () => h.query('getOwnedSession', { clientMatchId }) }); });
  await waitFor(() => {
    expect(h.finalize).toHaveBeenCalledExactlyOnceWith({ matchId: session.matchId, resultType: 'abandoned' });
    expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  });
  expect(loadSession(clientMatchId)).not.toHaveProperty('pendingFinish');
  expect(h.scorePoint).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    matchId: session.matchId, value: 0, type: 'correction', snapshot,
  }));
  expect(h.scorePoint.mock.invocationCallOrder[0]).toBeLessThan(h.finalize.mock.invocationCallOrder[0]);
  expect(load()).toEqual([]);
  await act(async () => {
    globalThis.dispatchEvent(new Event('online'));
    globalThis.dispatchEvent(new Event('focus'));
    await flushLiveSession(clientMatchId, h);
  });
  expect(h.finalize).toHaveBeenCalledTimes(1);
  expect(h.scorePoint).toHaveBeenCalledTimes(1);
}

it.each(['create', 'setVisibility'])('holds a finish during delayed %s, then publishes the terminal score before finalizing once', async boundary => {
  const publication = deferred();
  h[boundary].mockReturnValueOnce(publication.promise);
  const root = renderHook(() => usePendingLiveFinalizations());
  const scorer = renderHook(() => useLiveBroadcast());
  let publishing;
  await act(async () => { publishing = scorer.result.current.goLive(go); });
  await waitFor(() => expect(h[boundary]).toHaveBeenCalledTimes(1));
  await act(async () => { await scorer.result.current.finalize(finish); });
  const pending = loadSession(clientMatchId);
  // Finish is durable, but it does not yet authorize any public write.
  expect(pending).toHaveProperty('pendingFinish', expect.objectContaining(finish));
  expect(pending).not.toHaveProperty('finalizeIntent');
  expect(load()).toEqual([]);
  await act(async () => {
    globalThis.dispatchEvent(new Event('online'));
    await flushLiveSession(clientMatchId, h);
  });
  expect(h.query).not.toHaveBeenCalled();
  expect(h.scorePoint).not.toHaveBeenCalled();
  expect(h.finalize).not.toHaveBeenCalled();
  scorer.unmount();
  await act(async () => {
    publication.resolve(boundary === 'create' ? { matchId: session.matchId, token: session.token } : { ok: true });
    await publishing;
  });
  await expectFinalizedOnce();
  expect(h.create).toHaveBeenCalledTimes(1);
  expect(h.setVisibility).toHaveBeenCalledTimes(1);
  root.unmount();
});

it.each(['offline', 'not_authorized'])('drops the pending finish after publication rejects (%s), without score or finalize calls', async code => {
  const publication = deferred();
  h.setVisibility.mockReturnValueOnce(publication.promise);
  const root = renderHook(() => usePendingLiveFinalizations());
  const scorer = renderHook(() => useLiveBroadcast());
  let publishing;
  await act(async () => { publishing = scorer.result.current.goLive(go); });
  await waitFor(() => expect(h.setVisibility).toHaveBeenCalledTimes(1));
  await act(async () => { await scorer.result.current.finalize(finish); });
  const pending = loadSession(clientMatchId)?.pendingFinish;
  await act(async () => {
    publication.reject(Object.assign(new Error('publication rejected'), { data: { code } }));
    await publishing;
    await flushLiveSession(clientMatchId, h);
  });
  expect(loadSession(clientMatchId)).not.toHaveProperty('pendingFinish');
  expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  expect(loadSession(clientMatchId).isShared).toBe(false);
  expect(scorer.result.current.error?.message).toBe('publication rejected');
  await act(async () => {
    globalThis.dispatchEvent(new Event('online'));
    globalThis.dispatchEvent(new Event('focus'));
    await flushLiveSession(clientMatchId, h);
  });
  expect(h.query).not.toHaveBeenCalled();
  expect(h.scorePoint).not.toHaveBeenCalled();
  expect(h.undo).not.toHaveBeenCalled();
  expect(h.finalize).not.toHaveBeenCalled();
  expect(load()).toEqual([]);
  // Keep this assertion last so red CI also exercises rejection cleanup.
  expect(pending).toEqual(expect.objectContaining(finish));
  scorer.unmount();
  root.unmount();
});

it.each(['root', 'scorer'])('resolves persisted pending publication through %s recovery before promoting a shared finish', async recovery => {
  saveSession(clientMatchId, { matchId: session.matchId, token: session.token, seq: 7, isShared: false,
    pendingFinish: { ...finish, clientEventId: `${clientMatchId}:finalize:reload`, at: 1 } });
  const lookup = deferred();
  h.query.mockReturnValue(lookup.promise);
  const root = renderHook(() => usePendingLiveFinalizations());
  const scorer = recovery === 'scorer' ? renderHook(() => useLiveBroadcast()) : null;
  let restoring;
  if (scorer) await act(async () => { restoring = scorer.result.current.restore({ clientMatchId }); });
  await act(async () => { globalThis.dispatchEvent(new Event('online')); });
  expect(h.scorePoint).not.toHaveBeenCalled();
  expect(h.finalize).not.toHaveBeenCalled();
  await act(async () => {
    lookup.resolve(session);
    if (restoring) await restoring;
  });
  await expectFinalizedOnce();
  expect(h.query).toHaveBeenCalledWith('getOwnedSession', { clientMatchId });
  expect(h.create).not.toHaveBeenCalled();
  expect(h.setVisibility).not.toHaveBeenCalled();
  scorer?.unmount();
  root.unmount();
});

it.each([false, null])('drops a reloaded pending finish when owned-session lookup is private/absent (%s)', async shared => {
  saveSession(clientMatchId, { matchId: session.matchId, seq: 7, isShared: false,
    pendingFinish: { ...finish, clientEventId: `${clientMatchId}:finalize:reload`, at: 1 } });
  h.query.mockResolvedValue(shared === null ? null : { ...session, isShared: false });
  const root = renderHook(() => usePendingLiveFinalizations());
  await act(async () => { await flushLiveSession(clientMatchId, { ...h, getOwnedSession: () => h.query('getOwnedSession', { clientMatchId }) }); });
  expect(loadSession(clientMatchId)).not.toHaveProperty('pendingFinish');
  expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  expect(load()).toEqual([]);
  const lookups = h.query.mock.calls.length;
  expect(lookups).toBeGreaterThan(0);
  await act(async () => {
    globalThis.dispatchEvent(new Event('online'));
    globalThis.dispatchEvent(new Event('focus'));
    await flushLiveSession(clientMatchId, h);
  });
  expect(h.query).toHaveBeenCalledTimes(lookups);
  expect(h.scorePoint).not.toHaveBeenCalled();
  expect(h.undo).not.toHaveBeenCalled();
  expect(h.finalize).not.toHaveBeenCalled();
  expect(h.create).not.toHaveBeenCalled();
  expect(h.setVisibility).not.toHaveBeenCalled();
  root.unmount();
});
