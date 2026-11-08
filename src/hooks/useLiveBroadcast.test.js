import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// useLiveBroadcast is the OPERATOR-side mirror: it creates a live match, then
// mirrors each local scoring action to Convex through the offline-first outbox.
// CONTRACT (issue dkt): the mirror is purely ADDITIVE — a failed/offline push
// must NEVER throw into the scorer or break local scoring; events stay queued
// and replay on reconnect; clientEventId is monotonic and survives reload so the
// idempotent backend never double-counts.

// Per-mutation spy registry, addressed by the api.live.* token below.
const h = vi.hoisted(() => {
  const spies = {};
  return {
    spies,
    query: vi.fn(),
    get: (key) => {
      if (!spies[key]) spies[key] = vi.fn().mockResolvedValue(undefined);
      return spies[key];
    },
  };
});

vi.mock('../../convex/_generated/api', () => ({
  api: {
    live: {
      create: 'live:create',
      scorePoint: 'live:scorePoint',
      undo: 'live:undo',
      finalize: 'live:finalize',
      setVisibility: 'live:setVisibility',
      getOwnedSession: 'live:getOwnedSession',
    },
  },
}));

vi.mock('convex/react', () => ({
  useMutation: (ref) => h.get(ref),
  useConvex: () => h,
}));

import { useLiveBroadcast } from './useLiveBroadcast';
import { load, enqueue } from '../lib/live/outbox';
import { loadSession } from '../lib/live/liveSession';

const GO = {
  clientMatchId: 'cm1',
  sport: 'football',
  scorecardKind: 'goals',
  teamA: { name: 'Alpha' },
  teamB: { name: 'Beta' },
  visibility: 'public',
  snapshot: { pointsA: 0, pointsB: 0, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 },
};

beforeEach(() => {
  localStorage.clear();
  h.query.mockReset().mockResolvedValue(null);
  Object.values(h.spies).forEach((s) => s.mockReset());
  h.get('live:setVisibility').mockResolvedValue({ ok: true });
});

function setup(opts) {
  return renderHook(() => useLiveBroadcast(opts));
}

describe('durable live finalization', () => {
  const terminal = { ...GO.snapshot, pointsA: 3, pointsB: 2 };

  async function shared() {
    h.get('live:create').mockResolvedValue({ matchId: 'mid1', token: 'TOK' });
    h.get('live:scorePoint').mockResolvedValue({});
    h.get('live:finalize').mockResolvedValue({ archived: true });
    const hook = setup();
    await act(async () => { await hook.result.current.goLive(GO); });
    return hook;
  }

  async function finishOffline(hook) {
    h.get('live:scorePoint').mockRejectedValue(new Error('offline'));
    await act(async () => {
      await hook.result.current.point({ team: 'A', at: 1 });
      await hook.result.current.finalize({ resultType: 'abandoned', snapshot: terminal });
    });
    expect(h.get('live:finalize')).not.toHaveBeenCalled();
    expect(load()).toHaveLength(2);
  }

  it('drains offline scores and the terminal snapshot before finalizing once on reconnect', async () => {
    const hook = await shared();
    await finishOffline(hook);
    h.get('live:scorePoint').mockClear().mockResolvedValue({});
    const order = [];
    h.get('live:scorePoint').mockImplementation(async ({ snapshot }) => {
      order.push(snapshot ? 'terminal' : 'point');
    });
    h.get('live:finalize').mockImplementation(async () => { order.push('finalize'); });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(h.get('live:finalize')).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['point', 'terminal', 'finalize']);
    expect(h.get('live:finalize')).toHaveBeenCalledWith({ matchId: 'mid1', resultType: 'abandoned' });
    expect(load()).toEqual([]);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(h.get('live:finalize')).toHaveBeenCalledTimes(1);
  });

  it('recovers an offline finish after scorer reload even before the restore query resolves', async () => {
    const first = await shared();
    await finishOffline(first);
    first.unmount();
    // A reload starts disabled; the server query may wait for connectivity.
    h.query.mockReturnValue(new Promise(() => {}));
    const second = setup({ enabled: false });
    await act(async () => { void second.result.current.restore(GO); });
    expect(load()).toHaveLength(2);
    h.get('live:scorePoint').mockClear().mockResolvedValue({});
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(h.get('live:finalize')).toHaveBeenCalledTimes(1));
    expect(h.get('live:scorePoint').mock.calls.map(([args]) => args.clientEventId)).toEqual(['cm1:1', 'cm1:2']);
    expect(h.get('live:scorePoint')).toHaveBeenLastCalledWith(expect.objectContaining({ snapshot: terminal }));
    expect(h.get('live:finalize')).toHaveBeenCalledWith({ matchId: 'mid1', resultType: 'abandoned' });
    expect(load()).toEqual([]);
    expect(h.get('live:create')).toHaveBeenCalledTimes(1);
    expect(h.get('live:setVisibility')).toHaveBeenCalledTimes(1);
  });

  it('retries a transport failure on foreground, including after a reload with an empty event queue', async () => {
    const first = await shared();
    h.get('live:finalize').mockRejectedValue(new Error('connection lost'));
    await act(async () => { await first.result.current.finalize({ resultType: 'decided', snapshot: terminal }); });
    expect(load()).toEqual([]);
    expect(h.get('live:finalize')).toHaveBeenCalledTimes(1);
    first.unmount();
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 1, isShared: true });
    const second = setup({ enabled: false });
    await act(async () => { await second.result.current.restore(GO); });
    h.get('live:finalize').mockClear().mockResolvedValue({ archived: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(h.get('live:finalize')).toHaveBeenCalledTimes(1));
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(h.get('live:finalize')).toHaveBeenCalledTimes(1);
  });

  it('stops retrying a permanent structured rejection and retains it as a broadcast error', async () => {
    const hook = await shared();
    const rejection = Object.assign(new Error('Server Error'), { data: { code: 'not_authorized' } });
    h.get('live:finalize').mockRejectedValue(rejection);
    await act(async () => { await hook.result.current.finalize({ snapshot: terminal }); });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(h.get('live:finalize')).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toBe(rejection);
    expect(loadSession(GO.clientMatchId)).not.toHaveProperty('finalizeIntent');
  });

  it('keeps online finish ordered and clears the persisted intent after success', async () => {
    const hook = await shared();
    await act(async () => { await hook.result.current.finalize({ resultType: 'decided', snapshot: terminal }); });
    expect(h.get('live:finalize')).toHaveBeenCalledTimes(1);
    expect(h.get('live:scorePoint')).toHaveBeenLastCalledWith(expect.objectContaining({ snapshot: terminal }));
    expect(h.get('live:scorePoint').mock.invocationCallOrder.at(-1)).toBeLessThan(h.get('live:finalize').mock.invocationCallOrder[0]);
    expect(load()).toEqual([]);
    expect(loadSession(GO.clientMatchId)).not.toHaveProperty('finalizeIntent');
  });
});

describe('useLiveBroadcast', () => {
  it('publishes the fresh kabaddi journal with its snapshot after queued writes drain', async () => {
    h.get('live:create').mockResolvedValue({ matchId: 'm1', token: 'ABC123' });
    let history = [{ id: 'old-raid' }];
    h.get('live:scorePoint').mockImplementation(async () => { history = [{ id: 'replacement-raid' }]; });
    enqueue({ kind: 'point', clientMatchId: GO.clientMatchId, clientEventId: 'queued-before-stop', team: 'A', value: 0, at: 100 });
    const { result } = setup({ enabled: true });
    const snapshot = { ...GO.snapshot, kabaddi: { version: 1 } };
    await act(async () => {
      await result.current.goLive({ ...GO, sport: 'kabaddi', snapshot, kabaddiHistory: history, getKabaddiHistory: () => history });
    });
    expect(h.get('live:create').mock.calls[0][0]).not.toHaveProperty('kabaddiHistory');
    expect(h.get('live:setVisibility')).toHaveBeenLastCalledWith({ matchId: 'm1', visibility: 'public', snapshot, kabaddiHistory: [{ id: 'replacement-raid' }] });
  });

  it('ignores a delayed restore after the scorer resets to a different match', async () => {
    let resolve;
    h.query.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = setup({ enabled: false });
    await act(async () => {
      const restoring = result.current.restore(GO);
      result.current.reset();
      resolve({ matchId: 'old', token: 'OLD', lastSeq: 9, isShared: true });
      await restoring;
    });
    expect(result.current).toMatchObject({ isShared: false, isLive: false, token: null });
  });

  it('allows only one publication while a share request is in flight', async () => {
    let resolve;
    h.get('live:create').mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = setup();
    await act(async () => {
      const sharing = result.current.goLive(GO);
      await result.current.goLive(GO);
      resolve({ matchId: 'mid1', token: 'TOK' });
      await sharing;
    });
    expect(h.spies['live:create']).toHaveBeenCalledTimes(1);
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(1);
  });
  it('restores true sharing state and Stop after reopening without creating or publishing', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true });
    const { result } = setup({ enabled: false });
    await act(async () => { await result.current.restore(GO); });
    expect(result.current).toMatchObject({ isShared: true, token: 'TOK' });
    expect(h.spies['live:create']).not.toHaveBeenCalled();
    expect(h.spies['live:setVisibility']).not.toHaveBeenCalled();
    await act(async () => { await result.current.setVisibility('private'); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledWith({ matchId: 'mid1', visibility: 'private' });
    expect(result.current.isShared).toBe(false);
  });

  it('publishes the latest private score and reshares current progress instead of a stale descriptor', async () => {
    h.get('live:create').mockResolvedValue({ matchId: 'mid1', token: 'TOK' });
    let snapshot = { ...GO.snapshot, pointsA: 2 };
    const { result, rerender } = renderHook(({ enabled }) => useLiveBroadcast({ enabled }), { initialProps: { enabled: false } });
    await act(async () => { await result.current.point({ team: 'A', at: 1, snapshot }); });
    expect(h.spies['live:scorePoint']).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await act(async () => { await result.current.goLive({ ...GO, getSnapshot: () => snapshot }); });
    expect(h.spies['live:setVisibility']).toHaveBeenLastCalledWith({ matchId: 'mid1', visibility: 'public', snapshot });
    await act(async () => { await result.current.setVisibility('private'); });
    snapshot = { ...snapshot, pointsA: 5 };
    await act(async () => { await result.current.goLive({ ...GO, getSnapshot: () => snapshot }); });
    expect(h.spies['live:setVisibility']).toHaveBeenLastCalledWith({ matchId: 'mid1', visibility: 'public', snapshot });
  });

  it('does not publish while older queued scores are still failing', async () => {
    h.get('live:create').mockResolvedValue({ matchId: 'mid1', token: 'TOK' });
    h.get('live:scorePoint').mockRejectedValue(new Error('offline'));
    enqueue({ kind: 'point', clientMatchId: 'cm1', clientEventId: 'cm1:old', team: 'A', value: 1, at: 1 });
    const { result } = setup();
    await act(async () => { await result.current.goLive(GO); });
    expect(h.spies['live:setVisibility']).not.toHaveBeenCalled();
    expect(load()).toHaveLength(1);
  });
  it('does not announce a stopped/legacy match as live until explicit publishing succeeds', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:setVisibility').mockRejectedValue(new Error('offline'));
    const { result } = setup();
    await act(async () => { await result.current.goLive(GO); });
    expect(result.current.isLive).toBe(false);
    expect(result.current.error).toBeTruthy();
    h.get('live:setVisibility').mockResolvedValue({ ok: true });
    await act(async () => { await result.current.goLive(GO); });
    expect(result.current.isLive).toBe(true);
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(2);
  });
  it('goLive creates a live match and exposes token + isLive', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK123', matchId: 'mid1' });
    const { result } = setup();

    await act(async () => {
      await result.current.goLive(GO);
    });

    expect(h.spies['live:create']).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMatchId: 'cm1',
        sport: 'football',
        scorecardKind: 'goals',
        teamA: { name: 'Alpha' },
        teamB: { name: 'Beta' },
        visibility: 'private',
      }),
    );
    expect(result.current.isLive).toBe(true);
    expect(result.current.token).toBe('TOK123');
    expect(h.spies['live:setVisibility']).toHaveBeenCalledWith({ matchId: 'mid1', visibility: 'public', snapshot: GO.snapshot });
  });

  it('point() sends scorePoint with matchId + derived clientEventId and drains the outbox', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});
    const { result } = setup();

    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1000 });
    });

    expect(h.spies['live:scorePoint']).toHaveBeenCalledWith({
      matchId: 'mid1',
      clientEventId: 'cm1:1',
      team: 'A',
      value: 1,
      type: 'point',
      at: 1000,
    });
    expect(load()).toEqual([]);
  });

  it('point() forwards the event type (serve_change / correction) to scorePoint', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});
    const { result } = setup();

    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'B', value: 0, at: 1000, type: 'serve_change' });
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: -1, at: 2000, type: 'correction' });
    });

    const calls = h.spies['live:scorePoint'].mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatchObject({ team: 'B', value: 0, type: 'serve_change' });
    expect(calls[1]).toMatchObject({ team: 'A', value: -1, type: 'correction' });
  });

  it('replays a legacy queued item that predates the `type` field (forwards undefined -> mutation defaults to point)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});

    // A pre-PR outbox item has NO `type` field. Seed it directly, then go live and
    // drain: sendFn must forward `type: undefined` (the backend defaults it to
    // "point") rather than crashing or dropping the legacy event. Use seq 0 so it
    // can't collide with the live point() below (which derives cm1:1).
    enqueue({ kind: 'point', team: 'A', value: 1, at: 1, clientMatchId: 'cm1', clientEventId: 'cm1:0' });

    const { result } = setup();
    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'B', value: 1, at: 2, type: 'point' });
    });

    const legacy = h.spies['live:scorePoint'].mock.calls
      .map((c) => c[0])
      .find((c) => c.clientEventId === 'cm1:0');
    expect(legacy).toBeTruthy();
    expect(legacy.type).toBeUndefined();
    expect(legacy).toMatchObject({ team: 'A', value: 1 });
    expect(load()).toEqual([]); // both the legacy item and the live point drained
  });

  it('keeps the event queued and never throws when the push fails (local scoring unaffected)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockRejectedValue(new Error('offline'));
    const { result } = setup();

    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      // Must resolve (not reject) even though the underlying mutation rejected.
      await result.current.point({ team: 'B', value: 2, at: 2000 });
    });

    expect(load()).toHaveLength(1);
    expect(load()[0]).toMatchObject({ kind: 'point', team: 'B', value: 2, clientEventId: 'cm1:1' });
  });

  it('undo() sends the undo mutation with the next clientEventId', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});
    h.get('live:undo').mockResolvedValue({});
    const { result } = setup();

    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1000 });
    });
    await act(async () => {
      await result.current.undo({ at: 1500 });
    });

    expect(h.spies['live:undo']).toHaveBeenCalledWith({
      matchId: 'mid1',
      clientEventId: 'cm1:2',
      at: 1500,
    });
    expect(load()).toEqual([]);
  });

  it('finalize() drains queued events then finalizes the match', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});
    h.get('live:finalize').mockResolvedValue({ matchId: 'arch1', archived: true });
    const { result } = setup();

    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1000 });
    });
    await act(async () => {
      await result.current.finalize();
    });

    expect(h.spies['live:finalize']).toHaveBeenCalledWith({ matchId: 'mid1' });
  });

  it('finalize drains an in-flight point before archiving (no stale final score)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    const order = [];
    let resolvePoint;
    h.get('live:scorePoint').mockImplementation(
      () =>
        new Promise((res) => {
          resolvePoint = () => {
            order.push('scorePoint');
            res({});
          };
        }),
    );
    h.get('live:finalize').mockImplementation(async () => {
      order.push('finalize');
      return { matchId: 'arch1', archived: true };
    });

    const { result } = setup();
    await act(async () => {
      await result.current.goLive(GO);
    });

    await act(async () => {
      result.current.point({ team: 'A', value: 1, at: 1 }); // optimistic flush hangs on scorePoint
      const finalizing = result.current.finalize();
      await new Promise((r) => setTimeout(r, 0)); // let the point reach scorePoint
      // finalize must be WAITING for the drain, not have archived yet.
      expect(order).toEqual([]);
      resolvePoint();
      await finalizing;
    });

    // The point was sent BEFORE the match was finalized — archive is complete.
    expect(order).toEqual(['scorePoint', 'finalize']);
  });

  it('restores the session for the same clientMatchId after remount (seq continues)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});

    const first = setup();
    await act(async () => {
      await first.result.current.goLive(GO);
    });
    await act(async () => {
      await first.result.current.point({ team: 'A', value: 1, at: 1 });
    });
    first.unmount();

    const second = setup();
    await act(async () => {
      await second.result.current.goLive(GO); // idempotent create returns same matchId
    });
    await act(async () => {
      await second.result.current.point({ team: 'B', value: 1, at: 2 });
    });

    // Continues from seq 1 -> cm1:2, not restarting at cm1:1.
    expect(h.spies['live:scorePoint']).toHaveBeenLastCalledWith({
      matchId: 'mid1',
      clientEventId: 'cm1:2',
      team: 'B',
      value: 1,
      type: 'point',
      at: 2,
    });
  });

  it('does nothing when broadcasting is disabled (kill-switch / opt-out)', async () => {
    const { result } = setup({ enabled: false });

    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1 });
    });

    expect(h.spies['live:create']).not.toHaveBeenCalled();
    expect(load()).toEqual([]);
    expect(result.current.isLive).toBe(false);
  });

  it('forwards the engine snapshot through to scorePoint/undo (non-flat sports)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});
    h.get('live:undo').mockResolvedValue({});
    const { result } = setup();
    await act(async () => {
      await result.current.goLive(GO);
    });

    const snap = { pointsA: 25, pointsB: 23, setsA: 1, setsB: 0, setScores: [{ a: 25, b: 23 }], servingTeam: 'B', currentUnit: 2, periodLabel: 'Set 2' };
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1000, snapshot: snap });
    });
    expect(h.spies['live:scorePoint']).toHaveBeenCalledWith(
      expect.objectContaining({ matchId: 'mid1', clientEventId: 'cm1:1', team: 'A', value: 1, at: 1000, snapshot: snap }),
    );

    const undoSnap = { pointsA: 24, pointsB: 23, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 };
    await act(async () => {
      await result.current.undo({ at: 2000, snapshot: undoSnap });
    });
    expect(h.spies['live:undo']).toHaveBeenCalledWith(
      expect.objectContaining({ matchId: 'mid1', clientEventId: 'cm1:2', at: 2000, snapshot: undoSnap }),
    );
  });

  it('drops a queued event that belongs to a DIFFERENT match (no cross-match contamination)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockResolvedValue({});
    // A stale event from a previous match left in the shared outbox.
    enqueue({ kind: 'point', team: 'A', value: 1, at: 0, clientMatchId: 'OTHER', clientEventId: 'OTHER:1' });

    const { result } = setup();
    await act(async () => {
      await result.current.goLive(GO); // clientMatchId cm1
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1 });
    });

    // The foreign event was DROPPED, never sent to cm1's matchId — assert the
    // EXACT send set (one call, only cm1:1), so a future rehydrate that re-keys
    // the stale item with a fresh clientEventId can't slip through unnoticed.
    expect(h.spies['live:scorePoint']).toHaveBeenCalledTimes(1);
    const sentEventIds = h.spies['live:scorePoint'].mock.calls.map((c) => c[0].clientEventId);
    expect(sentEventIds).toEqual(['cm1:1']);
    expect(load()).toEqual([]); // queue fully drained (foreign dropped, cm1 sent)
  });

  it('drops a finalized-match rejection even when prod REDACTS the error message', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    // Simulate Convex production: the Error message is redacted to a generic
    // "Server Error" + request id, but the ConvexError `data` IS delivered. The
    // drop MUST key off data.code (the /final/ message check alone would miss it).
    h.get('live:scorePoint').mockRejectedValue(
      Object.assign(new Error('[Request ID: 7b3] Server Error'), { data: { code: 'match_final' } }),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1 });
    });
    // Terminal rejection → dropped, not poison-looping in the queue.
    expect(load()).toEqual([]);
  });

  it('also drops a finalized-match rejection via the message fallback (dev/edge-runtime)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:scorePoint').mockRejectedValue(new Error('Match is final'));
    const { result } = setup();
    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1 });
    });
    expect(load()).toEqual([]);
  });

  it('finalize does NOT archive when the outbox could not fully drain', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    // Transient (non-final) failure: the event stays queued, so the drain can't
    // complete. finalize must NOT archive a final score missing that tail.
    h.get('live:scorePoint').mockRejectedValue(new Error('network down'));
    const { result } = setup();
    await act(async () => {
      await result.current.goLive(GO);
    });
    await act(async () => {
      await result.current.point({ team: 'A', value: 1, at: 1 });
    });
    expect(load().length).toBeGreaterThan(0); // still queued

    await act(async () => {
      await result.current.finalize();
    });
    expect(h.spies['live:finalize']).not.toHaveBeenCalled();
    expect(load().length).toBeGreaterThan(0); // tail preserved for replay
  });

  it('setVisibility still works after enabled flips false (resume after Stop)', async () => {
    h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
    h.get('live:setVisibility').mockResolvedValue({ ok: true });
    const { result, rerender } = renderHook(({ enabled }) => useLiveBroadcast({ enabled }), {
      initialProps: { enabled: true },
    });
    await act(async () => {
      await result.current.goLive(GO);
    });
    // Operator pressed "Stop" → the scorer flips enabled off.
    rerender({ enabled: false });
    await act(async () => {
      await result.current.setVisibility('public', GO); // resume
    });
    // Must NOT be a no-op just because enabled is false — a match exists.
    expect(h.spies['live:setVisibility']).toHaveBeenCalledWith({ matchId: 'mid1', visibility: 'public', snapshot: GO.snapshot });
  });
});


it('publishes the frozen terminal clock through the snapshot path before archiving', async () => {
  h.get('live:create').mockResolvedValue({ token: 'TOK', matchId: 'mid1' });
  h.get('live:scorePoint').mockResolvedValue({});
  h.get('live:finalize').mockResolvedValue({ archived: true });
  const { result } = setup();
  await act(async () => { await result.current.goLive(GO); });
  const snapshot = { ...GO.snapshot, periodLabel: '1st half', periodClock: { sport: 'football', phase: 'playing', elapsed: 30, startedAt: null, duration: 60, periodIndex: 0, regulationCount: 2, playedSeconds: 30 } };
  await act(async () => { await result.current.finalize({ resultType: 'abandoned', snapshot }); });
  expect(h.spies['live:scorePoint']).toHaveBeenCalledWith(expect.objectContaining({ snapshot, type: 'correction', value: 0 }));
  expect(h.spies['live:scorePoint'].mock.invocationCallOrder.at(-1)).toBeLessThan(h.spies['live:finalize'].mock.invocationCallOrder.at(-1));
});
