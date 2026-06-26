// Shared live-event model for ball-by-ball history and broadcast scorecards.
//
// A `scoringEvent` is a self-describing row in an append-only log:
//   { seq, type, team, value, playerId?, runningA, runningB,
//     setsA, setsB, servingAfter?, at, meta? }
//
// `type` ∈ point | set_end | serve_change | timeout | undo | correction | note.
//
// Running totals (`runningA`/`runningB`) are stored ON each event at write time
// so any timeline row is self-describing and every derivation is a single O(n)
// pass with no recompute. Undo is modeled as a NEW appended compensating event
// (design §3.6) — prior events are never mutated or deleted.

/** Event types that move the score and can be reversed by an undo. */
const SCORING_TYPE = 'point';

/**
 * Reads the running/sets snapshot carried by the most recent event.
 * Returns zeros for an empty stream.
 *
 * @param {ReadonlyArray<object>} events
 * @returns {{ seq: number, runningA: number, runningB: number, setsA: number, setsB: number }}
 */
function tail(events) {
  if (events.length === 0) {
    return { seq: 0, runningA: 0, runningB: 0, setsA: 0, setsB: 0 };
  }
  const last = events[events.length - 1];
  return {
    seq: Number(last.seq ?? 0),
    runningA: Number(last.runningA ?? 0),
    runningB: Number(last.runningB ?? 0),
    setsA: Number(last.setsA ?? 0),
    setsB: Number(last.setsB ?? 0),
  };
}

/**
 * Appends a scoring point and returns a NEW events array with running totals
 * computed onto the new event. Never mutates the input.
 *
 * @param {ReadonlyArray<object>} events
 * @param {{ team: 'A'|'B', value?: number, at: number, playerId?: string, meta?: any }} input
 * @returns {Array<object>} new events array
 */
export function appendPoint(events, { team, value = 1, at, playerId, meta } = {}) {
  const prev = tail(events);
  const delta = Number(value);

  const event = {
    seq: prev.seq + 1,
    type: SCORING_TYPE,
    team,
    value: delta,
    runningA: prev.runningA + (team === 'A' ? delta : 0),
    runningB: prev.runningB + (team === 'B' ? delta : 0),
    setsA: prev.setsA,
    setsB: prev.setsB,
    at,
  };
  if (playerId !== undefined) event.playerId = playerId;
  if (meta !== undefined) event.meta = meta;

  return [...events, event];
}

/**
 * Finds the last still-active scoring point — i.e. the most recent `point`
 * event that has not already been reversed by a later `undo`. Returns null
 * when there is nothing left to undo.
 *
 * @param {ReadonlyArray<object>} events
 * @returns {object|null}
 */
function lastActivePoint(events) {
  let pendingUndos = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type === 'undo') {
      pendingUndos += 1;
    } else if (event.type === SCORING_TYPE) {
      if (pendingUndos === 0) return event;
      pendingUndos -= 1;
    }
  }
  return null;
}

/**
 * Appends a COMPENSATING undo event that reverses the last still-active scoring
 * point. Prior events are never mutated or deleted (design §3.6). Running totals
 * on the undo event reflect the reversal. No-op (returns a copy) when there is
 * no active point to undo.
 *
 * @param {ReadonlyArray<object>} events
 * @param {{ at: number }} input
 * @returns {Array<object>} new events array
 */
export function appendUndo(events, { at } = {}) {
  const target = lastActivePoint(events);
  if (!target) return [...events];

  const prev = tail(events);
  const delta = Number(target.value);

  const event = {
    seq: prev.seq + 1,
    type: 'undo',
    team: target.team,
    value: -delta,
    runningA: prev.runningA - (target.team === 'A' ? delta : 0),
    runningB: prev.runningB - (target.team === 'B' ? delta : 0),
    setsA: prev.setsA,
    setsB: prev.setsB,
    at,
    meta: { undoSeq: target.seq },
  };

  return [...events, event];
}

/**
 * Derives the current match state from the event stream in one O(n) pass.
 *
 * @param {ReadonlyArray<object>} events
 * @returns {{ pointsA: number, pointsB: number, setsA: number, setsB: number, lastSeq: number }}
 */
export function reduceState(events) {
  let pointsA = 0;
  let pointsB = 0;
  let setsA = 0;
  let setsB = 0;
  let lastSeq = 0;

  for (const event of events) {
    lastSeq = Number(event.seq ?? lastSeq);
    switch (event.type) {
      case 'point': {
        const value = Number(event.value ?? 0);
        if (event.team === 'A') pointsA += value;
        else if (event.team === 'B') pointsB += value;
        break;
      }
      case 'undo':
      case 'correction': {
        // `value` already carries the signed adjustment (negative for an undo).
        const value = Number(event.value ?? 0);
        if (event.team === 'A') pointsA += value;
        else if (event.team === 'B') pointsB += value;
        break;
      }
      case 'set_end': {
        if (event.team === 'A') setsA += 1;
        else if (event.team === 'B') setsB += 1;
        break;
      }
      // serve_change | timeout | note: no score effect.
      default:
        break;
    }
  }

  return { pointsA, pointsB, setsA, setsB, lastSeq };
}
