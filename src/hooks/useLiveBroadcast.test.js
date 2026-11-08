import { renderHook, act } from '@testing-library/react';
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

describe('useLiveBroadcast', () => {
  it('does not send a restored snapshot after unmount while the drain ack is pending', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility: 'public' });
    let resolvePoint;
    h.get('live:scorePoint').mockReturnValue(new Promise((done) => { resolvePoint = done; }));
    enqueue({ kind: 'point', clientMatchId: 'cm1', clientEventId: 'cm1:7', team: 'A', value: 1, at: 1 });
    const { result, unmount } = setup();
    await act(async () => { await result.current.restore(GO); });
    expect(h.spies['live:scorePoint']).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { resolvePoint({}); });
    expect(h.spies['live:setVisibility']).not.toHaveBeenCalled();
  });

  it.each(['online', 'visibilitychange'])('retries a failed restore snapshot with the CURRENT score on %s', async (event) => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility: 'public' });
    h.get('live:setVisibility').mockRejectedValueOnce(new Error('offline'));
    let snapshot = { ...GO.snapshot, pointsA: 3 };
    const { result } = setup();
    await act(async () => { await result.current.restore({ ...GO, getSnapshot: () => snapshot }); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeTruthy();
    snapshot = { ...snapshot, pointsA: 4 };
    await act(async () => {
      if (event === 'online') window.dispatchEvent(new Event(event));
      else {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValueOnce('visible');
        document.dispatchEvent(new Event(event));
      }
    });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(2);
    expect(h.spies['live:setVisibility']).toHaveBeenLastCalledWith({ matchId: 'mid1', visibility: 'public', snapshot, onlyIfShared: true });
    expect(result.current.error).toBeNull();
  });

  it.each(['online', 'visibilitychange'])('retries a failed owner lookup while broadcasting is disabled on %s', async (event) => {
    h.query.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility: 'public' });
    const { result, rerender } = renderHook(({ enabled }) => useLiveBroadcast({ enabled }), { initialProps: { enabled: false } });
    await act(async () => { await result.current.restore(GO); });
    expect(h.query).toHaveBeenCalledTimes(1);
    await act(async () => {
      if (event === 'online') window.dispatchEvent(new Event(event));
      else {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValueOnce('visible');
        document.dispatchEvent(new Event(event));
      }
    });
    expect(h.query).toHaveBeenCalledTimes(2);
    expect(result.current.isShared).toBe(true);
    await act(async () => { rerender({ enabled: true }); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed reconciliation recoverable if Stop also fails', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility: 'public' });
    h.get('live:setVisibility').mockRejectedValueOnce(new Error('sync offline')).mockRejectedValueOnce(new Error('Stop offline'));
    const { result } = setup();
    await act(async () => { await result.current.restore(GO); });
    await act(async () => { await result.current.setVisibility('private'); });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(3);
    expect(h.spies['live:setVisibility']).toHaveBeenLastCalledWith({ matchId: 'mid1', visibility: 'public', snapshot: GO.snapshot, onlyIfShared: true });
    expect(result.current.error).toBeNull();
  });

  it('does not retry a finalized snapshot on recovery', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility: 'public' });
    h.get('live:setVisibility').mockRejectedValueOnce(Object.assign(new Error('Server Error'), { data: { code: 'match_final' } }));
    const { result } = setup();
    await act(async () => { await result.current.restore(GO); });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(1);
  });

  it.each(['public', 'unlisted'])('syncs the current committed snapshot once after restoring a %s session', async (visibility) => {
    let resolve;
    h.query.mockReturnValue(new Promise((done) => { resolve = done; }));
    let snapshot = GO.snapshot;
    const { result, rerender } = renderHook(({ enabled }) => useLiveBroadcast({ enabled }), {
      initialProps: { enabled: false },
    });
    let restoring;
    act(() => { restoring = result.current.restore({ ...GO, getSnapshot: () => snapshot }); });
    snapshot = { ...GO.snapshot, pointsA: 3, pointsB: 1 };
    await act(async () => {
      await result.current.point({ team: 'A', at: 1, snapshot });
      snapshot = { ...snapshot, pointsA: 2 };
      await result.current.undo({ at: 2, snapshot });
    });
    expect(h.spies['live:setVisibility']).not.toHaveBeenCalled();
    await act(async () => {
      resolve({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility });
      await restoring;
    });
    await act(async () => { rerender({ enabled: true }); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledExactlyOnceWith({ matchId: 'mid1', visibility, snapshot, onlyIfShared: true });
    expect(h.spies['live:create']).not.toHaveBeenCalled();
    await act(async () => { await result.current.point({ team: 'B', at: 3, snapshot: { ...snapshot, pointsB: 2 } }); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(1);
  });

  it('does not publish a private restored session even with a current snapshot', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 0, isShared: false, visibility: 'private' });
    const { result } = setup();
    await act(async () => { await result.current.restore({ ...GO, getSnapshot: () => GO.snapshot }); });
    expect(h.spies['live:setVisibility']).not.toHaveBeenCalled();
    expect(result.current.isShared).toBe(false);
  });

  it('clears restored sharing status if another tab stopped before reconciliation', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 0, isShared: true, visibility: 'public' });
    h.get('live:setVisibility').mockResolvedValue({ ok: false });
    const { result } = setup();
    await act(async () => { await result.current.restore(GO); });
    expect(result.current).toMatchObject({ isShared: false, isLive: false, error: null });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledTimes(1);
  });

  it('does not add a snapshot sync to normal scoring without a restore', async () => {
    h.get('live:create').mockResolvedValue({ matchId: 'mid1', token: 'TOK' });
    const { result } = setup();
    await act(async () => { await result.current.goLive(GO); });
    await act(async () => { await result.current.point({ team: 'A', at: 1, snapshot: { ...GO.snapshot, pointsA: 1 } }); });
    await act(async () => { await result.current.undo({ at: 2, snapshot: GO.snapshot }); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledExactlyOnceWith({ matchId: 'mid1', visibility: 'public', snapshot: GO.snapshot });
  });

  it('drains older queued snapshots before reading the restored current score', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility: 'public' });
    let snapshot = { ...GO.snapshot, pointsA: 2 };
    let resolvePoint;
    h.get('live:scorePoint').mockReturnValue(new Promise((done) => { resolvePoint = done; }));
    enqueue({ kind: 'point', clientMatchId: 'cm1', clientEventId: 'cm1:7', team: 'A', value: 1, at: 1, snapshot: GO.snapshot });
    const { result, rerender } = renderHook(({ enabled }) => useLiveBroadcast({ enabled }), {
      initialProps: { enabled: false },
    });
    await act(async () => { await result.current.restore({ ...GO, getSnapshot: () => snapshot }); });
    act(() => { rerender({ enabled: true }); });
    expect(h.spies['live:setVisibility']).not.toHaveBeenCalled();
    snapshot = { ...snapshot, pointsA: 3 };
    await act(async () => { resolvePoint({}); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledExactlyOnceWith({ matchId: 'mid1', visibility: 'public', snapshot, onlyIfShared: true });
    expect(load()).toEqual([]);
  });

  it('does not re-publish when Stop cancels a restored snapshot waiting on the outbox', async () => {
    h.query.mockResolvedValue({ matchId: 'mid1', token: 'TOK', lastSeq: 7, isShared: true, visibility: 'public' });
    let resolvePoint;
    h.get('live:scorePoint').mockReturnValue(new Promise((done) => { resolvePoint = done; }));
    enqueue({ kind: 'point', clientMatchId: 'cm1', clientEventId: 'cm1:7', team: 'A', value: 1, at: 1 });
    const { result } = setup();
    await act(async () => { await result.current.restore(GO); });
    await act(async () => { await result.current.setVisibility('private'); });
    await act(async () => { resolvePoint({}); });
    expect(h.spies['live:setVisibility']).toHaveBeenCalledExactlyOnceWith({ matchId: 'mid1', visibility: 'private' });
    expect(result.current.isShared).toBe(false);
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
  it('restores true sharing state and Stop before broadcasting reactivates', async () => {
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
