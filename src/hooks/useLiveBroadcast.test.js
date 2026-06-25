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
import { load } from '../lib/live/outbox';

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
});
