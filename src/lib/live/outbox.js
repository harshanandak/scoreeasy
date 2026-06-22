// Offline-first broadcast OUTBOX for live matches.
//
// Design refs: §3.1 (localStorage stays AUTHORITATIVE — a failed/offline
// Convex write must NEVER block local scoring), §3.4 (persisted `se_outbox`
// of unsynced events, each keyed by `${matchId}:${seq}`, replayed on reconnect
// through the idempotent scorePoint mutation), §12.2 (Convex dedups on
// clientEventId via the `by_match_client` index → reconnect storms never
// double-count).
//
// This module is PURE and STATELESS: every operation reads the queue fresh
// from localStorage and persists it back, so the queue survives app-kill /
// reload for free and localStorage is always the single source of truth.
// It performs NO Convex calls itself — the caller injects a `sendFn`.

import { loadData, saveData } from '../../utils/storage';

// Persisted FIFO queue key (se_ prefix per project convention, §3.4).
export const OUTBOX_KEY = 'se_outbox';

/**
 * Stable idempotency key for a live event: `${matchId}:${seq}`.
 * Convex dedups on this via the `by_match_client` index, so replaying the
 * same key is safe (the mutation no-ops). Format only — agnostic about
 * whether `matchId` is a Convex Id or a local id.
 */
export function clientEventIdFor(matchId, seq) {
  return `${matchId}:${seq}`;
}

/**
 * Load the persisted queue (oldest-first). Public accessor — also the
 * "restore after app-kill/reload" entry point. Always returns an array.
 */
export function load() {
  const queue = loadData(OUTBOX_KEY, []);
  return Array.isArray(queue) ? queue : [];
}

/** Number of items currently queued. */
export function size() {
  return load().length;
}

/** Next item to drain (front of FIFO) without removing it, or null. */
export function peek() {
  return load()[0] ?? null;
}

/** Remove every queued item. */
export function clear() {
  return saveData(OUTBOX_KEY, []);
}

/**
 * Append one item to the END of the persisted FIFO queue (oldest-first;
 * drain from the front). A plain append — NO dedup here. Idempotency is
 * Convex's job on `clientEventId`; deduping at enqueue would hide the real
 * "re-enqueue an unacked seq, replay, server no-ops" path.
 *
 * If `item.clientEventId` is absent but `matchId`/`seq` are present, the
 * key is derived for the caller.
 *
 * @returns {object[]} the persisted queue after the append.
 */
export function enqueue(item) {
  if (!item || typeof item !== 'object') {
    return load();
  }

  const clientEventId =
    item.clientEventId ??
    (item.matchId !== undefined && item.seq !== undefined
      ? clientEventIdFor(item.matchId, item.seq)
      : undefined);

  const queue = load();
  queue.push({ ...item, clientEventId });
  saveData(OUTBOX_KEY, queue);
  return queue;
}

/**
 * Replay queued items IN ORDER through `sendFn`, removing each from the
 * persisted queue on success and STOPPING at the first failure (the failed
 * item and the entire tail are kept, in order, for the next attempt).
 *
 * - Loads fresh from storage (app-kill safe).
 * - `await sendFn(item)` per item; a rejected promise (or throw) = failure.
 * - On success, persists the remaining tail immediately, so a mid-drain
 *   app-kill leaves already-acked items gone and the rest intact.
 * - Idempotent by construction: replaying the same `clientEventId` is safe
 *   because Convex dedups — this function does not need to track seen keys.
 *
 * @param {(item: object) => Promise<unknown>} sendFn
 * @returns {Promise<{ sent: number, remaining: number, error: Error|null }>}
 */
export async function reconcile(sendFn) {
  let sent = 0;

  // Re-load fresh each iteration so a point enqueued DURING a network drain
  // (the scorer never stops, §3.1) is not clobbered by a stale slice. enqueue
  // is append-only, so the head we just acked is always index 0.
   
  while (true) {
    const queue = load();

    // Empty queue is a no-op — never even call sendFn.
    if (queue.length === 0) {
      return { sent, remaining: 0, error: null };
    }

    const item = queue[0];
    try {
       
      await sendFn(item);
    } catch (error) {
      // STOP on the first failure: keep this item + the tail, in order.
      return {
        sent,
        remaining: queue.length,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }

    // Ack: re-load (picks up anything enqueued during the await), drop the
    // head we just sent, and persist immediately so a crash here cannot
    // replay an already-acked event.
    const after = load();
    after.shift();
    saveData(OUTBOX_KEY, after);
    sent += 1;
  }
}
