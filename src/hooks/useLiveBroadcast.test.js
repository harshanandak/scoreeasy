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
    },
  },
}));

vi.mock('convex/react', () => ({
  useMutation: (ref) => h.get(ref),
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
};

beforeEach(() => {
  localStorage.clear();
  Object.values(h.spies).forEach((s) => s.mockReset());
});

function setup(opts) {
  return renderHook(() => useLiveBroadcast(opts));
}

describe('useLiveBroadcast', () => {
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
        visibility: 'public',
      }),
    );
    expect(result.current.isLive).toBe(true);
    expect(result.current.token).toBe('TOK123');
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
      at: 1000,
    });
    expect(load()).toEqual([]);
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
      await result.current.setVisibility('public'); // resume
    });
    // Must NOT be a no-op just because enabled is false — a match exists.
    expect(h.spies['live:setVisibility']).toHaveBeenCalledWith({ matchId: 'mid1', visibility: 'public' });
  });
});
