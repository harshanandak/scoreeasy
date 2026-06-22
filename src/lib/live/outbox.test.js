import {
  OUTBOX_KEY,
  clientEventIdFor,
  load,
  size,
  peek,
  clear,
  enqueue,
  reconcile,
} from './outbox';
import { loadData } from '../../utils/storage';

// jsdom provides a real localStorage; clearing it before each test IS the
// repo's "mock" (mirrors storage.test.js). saveData/loadData go through it.
beforeEach(() => {
  localStorage.clear();
});

function makeItem(matchId, seq, team = 'A') {
  return {
    matchId,
    seq,
    clientEventId: clientEventIdFor(matchId, seq),
    team,
    at: 1000 + seq,
  };
}

describe('clientEventIdFor', () => {
  it('formats `${matchId}:${seq}`', () => {
    expect(clientEventIdFor('m1', 7)).toBe('m1:7');
  });
});

describe('enqueue / load (persistence + restore after reload)', () => {
  it('persists an item under the se_outbox key', () => {
    enqueue(makeItem('m1', 1));
    // Read raw storage, not the in-memory result, to prove persistence.
    const raw = loadData(OUTBOX_KEY, null);
    expect(Array.isArray(raw)).toBe(true);
    expect(raw).toHaveLength(1);
    expect(raw[0].clientEventId).toBe('m1:1');
  });

  it('load() restores the queue after a simulated reload (no in-memory cache)', () => {
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 2));
    // Simulate app-kill/reload: nothing in memory, only storage survives.
    // load() reads storage fresh each call.
    const restored = load();
    expect(restored.map((i) => i.clientEventId)).toEqual(['m1:1', 'm1:2']);
  });

  it('appends to the END (FIFO, oldest-first)', () => {
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 2));
    enqueue(makeItem('m1', 3));
    expect(load().map((i) => i.seq)).toEqual([1, 2, 3]);
  });

  it('does NOT dedup on enqueue (idempotency is Convex/sendFn job)', () => {
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 1)); // same clientEventId again
    expect(load()).toHaveLength(2);
    expect(load().map((i) => i.clientEventId)).toEqual(['m1:1', 'm1:1']);
  });

  it('derives clientEventId from matchId/seq when absent', () => {
    enqueue({ matchId: 'm9', seq: 4, team: 'B', at: 5 });
    expect(peek().clientEventId).toBe('m9:4');
  });

  it('ignores non-object input', () => {
    enqueue(null);
    enqueue(undefined);
    enqueue(42);
    expect(size()).toBe(0);
  });

  it('size / peek / clear behave', () => {
    expect(size()).toBe(0);
    expect(peek()).toBeNull();
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 2));
    expect(size()).toBe(2);
    expect(peek().seq).toBe(1);
    clear();
    expect(size()).toBe(0);
  });

  it('load() returns [] when storage holds a non-array', () => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify({ not: 'an array' }));
    expect(load()).toEqual([]);
  });
});

describe('reconcile', () => {
  it('empty queue is a no-op (never calls sendFn)', async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const result = await reconcile(sendFn);
    expect(sendFn).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, remaining: 0, error: null });
  });

  it('drains the whole queue IN ORDER, emptying storage', async () => {
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 2));
    enqueue(makeItem('m1', 3));

    const seen = [];
    const sendFn = vi.fn(async (item) => {
      seen.push(item.clientEventId);
    });

    const result = await reconcile(sendFn);

    expect(seen).toEqual(['m1:1', 'm1:2', 'm1:3']);
    expect(result).toEqual({ sent: 3, remaining: 0, error: null });
    expect(load()).toEqual([]);
  });

  it('persists progress so an acked item is gone even mid-drain', async () => {
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 2));
    enqueue(makeItem('m1', 3));

    // After item #1 acks, inspect raw storage from inside sendFn.
    let storageAfterFirstAck = null;
    const sendFn = vi.fn(async (item) => {
      if (item.seq === 2) {
        storageAfterFirstAck = load().map((i) => i.seq);
      }
    });

    await reconcile(sendFn);
    // When processing seq 2, seq 1 is already removed from storage.
    expect(storageAfterFirstAck).toEqual([2, 3]);
  });

  it('keeps items enqueued DURING the drain (scorer never stops, §3.1)', async () => {
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 2));

    const sendFn = vi.fn(async (item) => {
      // A point is scored mid-drain while item 1 is in flight.
      if (item.seq === 1) enqueue(makeItem('m1', 3));
    });

    await reconcile(sendFn);

    // All three are sent in order — the late item is not clobbered.
    expect(sendFn.mock.calls.map((c) => c[0].seq)).toEqual([1, 2, 3]);
    expect(load()).toEqual([]);
  });

  it('STOPS on the first failure, keeping that item + the tail in order', async () => {
    enqueue(makeItem('m1', 1));
    enqueue(makeItem('m1', 2));
    enqueue(makeItem('m1', 3));

    const sendFn = vi.fn(async (item) => {
      if (item.seq === 2) throw new Error('offline');
    });

    const result = await reconcile(sendFn);

    // sendFn attempted item1 (ok) then item2 (fail) — never item3.
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(1);
    expect(result.remaining).toBe(2);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('offline');

    // Persisted queue keeps the failed item + tail, in order; item1 gone.
    expect(load().map((i) => i.seq)).toEqual([2, 3]);
  });

  it('a rejected (non-Error) value is wrapped into an Error', async () => {
    enqueue(makeItem('m1', 1));
    const sendFn = vi.fn(async () => {
       
      return Promise.reject('boom');
    });
    const result = await reconcile(sendFn);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('boom');
    expect(load()).toHaveLength(1);
  });

  it('a failed drain never throws — local scoring is never blocked (§3.1)', async () => {
    enqueue(makeItem('m1', 1));
    const sendFn = vi.fn(async () => {
      throw new Error('network down');
    });
    await expect(reconcile(sendFn)).resolves.toMatchObject({ sent: 0, remaining: 1 });
  });
});

describe('idempotent replay (Convex dedups on clientEventId)', () => {
  it('replaying the same clientEventId twice yields ONE effect', async () => {
    // sendFn models the idempotent Convex mutation: it tracks seen keys and
    // only counts an effect the first time a clientEventId is observed.
    const seen = new Set();
    let effects = 0;
    const sendFn = vi.fn(async (item) => {
      if (!seen.has(item.clientEventId)) {
        seen.add(item.clientEventId);
        effects += 1;
      }
      // Already-seen key: no-op (the server dedup), still resolves OK.
    });

    // First drain: item is sent and acked → 1 effect.
    enqueue(makeItem('m1', 1));
    await reconcile(sendFn);
    expect(effects).toBe(1);
    expect(load()).toEqual([]);

    // Re-enqueue the SAME unacked seq (e.g. an earlier ack was lost) and
    // drain again. The server has already seen the key → no second effect.
    enqueue(makeItem('m1', 1));
    await reconcile(sendFn);

    expect(sendFn).toHaveBeenCalledTimes(2); // attempted twice
    expect(effects).toBe(1); // but only ONE real effect
    expect(load()).toEqual([]); // and the queue drains cleanly
  });
});
