import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLiveBroadcast } from './useLiveBroadcast';
import { usePendingLiveFinalizations } from './usePendingLiveFinalizations';
import { loadSession, saveSession } from '../lib/live/liveSession';
import { flushLiveSession } from '../lib/live/recovery';
import { load } from '../lib/live/outbox';

const h = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), scorePoint: vi.fn(), undo: vi.fn(), finalize: vi.fn(), setVisibility: vi.fn(), drainError: null }));
vi.mock('../lib/live/recovery', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, flushLiveSession: (...args) => h.drainError ? Promise.reject(h.drainError) : actual.flushLiveSession(...args) };
});
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
  h.drainError = null;
  h.create.mockResolvedValue({ matchId: session.matchId, token: session.token });
  h.query.mockResolvedValue(session);
  h.scorePoint.mockResolvedValue({});
  h.finalize.mockResolvedValue({ archived: true });
});
afterEach(() => vi.restoreAllMocks());

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
  expect(pending?.pendingFinish).toEqual(expect.objectContaining(finish));
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

it.each([
  ['root', false], ['root', null], ['scorer', false], ['scorer', null],
])('retains a reloaded finish through %s private/absent lookup (%s), then finishes once after a later commit', async (recovery, shared) => {
  const at = 1_800_000_000_000;
  vi.spyOn(Date, 'now').mockReturnValue(at + 1_000);
  // Fresh runtime: only the persisted pending finish survives the unloaded request.
  const pendingFinish = { ...finish, at, publicationDeadline: at + 120_000, clientEventId: `${clientMatchId}:finalize:late-commit` };
  saveSession(clientMatchId, { matchId: session.matchId, seq: 7, isShared: false, pendingFinish });
  h.query.mockResolvedValue(shared === null ? null : { ...session, isShared: false });
  const root = recovery === 'root' ? renderHook(() => usePendingLiveFinalizations()) : null;
  const scorer = recovery === 'scorer' ? renderHook(() => useLiveBroadcast()) : null;
  await act(async () => {
    if (scorer) await scorer.result.current.restore({ clientMatchId });
    else await flushLiveSession(clientMatchId, { ...h, getOwnedSession: () => h.query('getOwnedSession', { clientMatchId }) });
  });
  const retained = loadSession(clientMatchId)?.pendingFinish;
  const lookups = h.query.mock.calls.length;
  await act(async () => { await Promise.resolve(); });
  expect(h.query).toHaveBeenCalledTimes(lookups);
  expect(h.scorePoint).not.toHaveBeenCalled();
  expect(h.finalize).not.toHaveBeenCalled();
  expect(load()).toEqual([]);
  // The original request commits after the reload's first private/null answer.
  h.query.mockResolvedValue(session);
  await act(async () => {
    if (scorer) await scorer.result.current.restore({ clientMatchId });
    else {
      globalThis.dispatchEvent(new Event('focus'));
      await flushLiveSession(clientMatchId, { ...h, getOwnedSession: () => h.query('getOwnedSession', { clientMatchId }) });
    }
  });
  await expectFinalizedOnce();
  expect(retained).toEqual(pendingFinish);
  expect(h.scorePoint.mock.calls[0][0].clientEventId).toBe(pendingFinish.clientEventId);
  expect(h.create).not.toHaveBeenCalled();
  expect(h.setVisibility).not.toHaveBeenCalled();
  scorer?.unmount();
  root?.unmount();
});

it.each([false, null])('expires a private/absent pending publication (%s) only after its two-minute window and a lifecycle trigger', async shared => {
  const at = 1_800_000_000_000;
  const now = vi.spyOn(Date, 'now').mockReturnValue(at + 1_000);
  const pendingFinish = { ...finish, at, publicationDeadline: at + 120_000, clientEventId: `${clientMatchId}:finalize:expires` };
  saveSession(clientMatchId, { matchId: session.matchId, seq: 7, isShared: false, pendingFinish });
  h.query.mockResolvedValue(shared === null ? null : { ...session, isShared: false });
  const root = renderHook(() => usePendingLiveFinalizations());
  await act(async () => { await flushLiveSession(clientMatchId, { ...h, getOwnedSession: () => h.query('getOwnedSession', { clientMatchId }) }); });
  const retained = loadSession(clientMatchId)?.pendingFinish;
  const lookups = h.query.mock.calls.length;
  now.mockReturnValue(at + 120_001);
  await act(async () => { await Promise.resolve(); });
  expect(h.query).toHaveBeenCalledTimes(lookups);
  await act(async () => {
    globalThis.dispatchEvent(new Event('focus'));
    await flushLiveSession(clientMatchId, { ...h, getOwnedSession: () => h.query('getOwnedSession', { clientMatchId }) });
  });
  expect(loadSession(clientMatchId)).not.toHaveProperty('pendingFinish');
  expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  const afterExpiry = h.query.mock.calls.length;
  await act(async () => {
    globalThis.dispatchEvent(new Event('online'));
    globalThis.dispatchEvent(new Event('focus'));
    await flushLiveSession(clientMatchId, h);
  });
  expect(h.query).toHaveBeenCalledTimes(afterExpiry);
  expect(h.scorePoint).not.toHaveBeenCalled();
  expect(h.undo).not.toHaveBeenCalled();
  expect(h.finalize).not.toHaveBeenCalled();
  expect(h.create).not.toHaveBeenCalled();
  expect(h.setVisibility).not.toHaveBeenCalled();
  expect(load()).toEqual([]);
  expect(retained).toEqual(pendingFinish);
  root.unmount();
});

it('finalizes the original publication after Rematch without touching the new match', async () => {
  const publication = deferred();
  h.setVisibility.mockReturnValueOnce(publication.promise);
  const at = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(at);
  const scorer = renderHook(() => useLiveBroadcast());
  let publishing;
  await act(async () => { publishing = scorer.result.current.goLive(go); });
  await waitFor(() => expect(h.setVisibility).toHaveBeenCalledTimes(1));
  await act(async () => { await scorer.result.current.finalize(finish); });
  const savedFinish = loadSession(clientMatchId)?.pendingFinish;
  const nextClientMatchId = 'rematch-publication';
  const next = { matchId: 'live-rematch', token: 'NEXT', lastSeq: 0, isShared: false };
  saveSession(nextClientMatchId, { matchId: next.matchId, token: next.token, seq: 0, isShared: false });
  h.query.mockResolvedValue(next);
  await act(async () => {
    scorer.result.current.reset();
    await scorer.result.current.restore({ clientMatchId: nextClientMatchId });
  });
  const untouched = loadSession(nextClientMatchId);
  await act(async () => { publication.resolve({ ok: true }); await publishing; });
  // No root worker or manual old-session flush can hide a drain through new refs.
  expect(h.finalize).toHaveBeenCalledExactlyOnceWith({ matchId: session.matchId, resultType: 'abandoned' });
  expect(h.scorePoint).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ matchId: session.matchId, snapshot, type: 'correction', value: 0 }));
  expect(h.scorePoint.mock.invocationCallOrder[0]).toBeLessThan(h.finalize.mock.invocationCallOrder[0]);
  expect(loadSession(nextClientMatchId)).toEqual(untouched);
  expect(scorer.result.current.token).toBe(next.token);
  expect(scorer.result.current.isShared).toBe(false);
  expect(loadSession(clientMatchId)).not.toHaveProperty('pendingFinish');
  expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  expect(savedFinish).toHaveProperty('publicationDeadline', at + 120_000);
  await expectFinalizedOnce();
  scorer.unmount();
});

it('keeps an unexpected post-publication drain rejection from escaping goLive', async () => {
  const drainError = new Error('unexpected drain failure');
  h.setVisibility.mockImplementation(async () => { h.drainError = drainError; return { ok: true }; });
  const scorer = renderHook(() => useLiveBroadcast());
  await act(async () => {
    await expect(scorer.result.current.goLive(go)).resolves.toMatchObject({ matchId: session.matchId, token: session.token });
  });
  expect(scorer.result.current.isShared).toBe(true);
  expect(scorer.result.current.error).toBe(drainError);
  expect(loadSession(clientMatchId)).toMatchObject({ matchId: session.matchId, isShared: true });
  scorer.unmount();
});
