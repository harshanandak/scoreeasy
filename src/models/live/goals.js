// Pure goals/period-sports derivation over the shared `scoringEvents` stream
// (design §6.6, research §4.D). This is the GENERIC +N engine: football,
// basketball, hockey, handball, futsal, rugby, kabaddi — and any custom/silly
// "+N" game — all flow through it with ZERO per-sport branching. Sports differ
// only by their `periods` config and by the `value` / `meta.type` carried on
// each event.
//
// MODEL (see scoringEvents.js): every scoring row is `type: 'point'` carrying
// `{ team: 'A'|'B', value: number, at: number, meta? }`. `value` may be +N
// (rugby try=5/conv=2/pen=3/dg=3; kabaddi raid/tackle; custom). The sport
// subtype lives in `event.meta.type`; the period in `event.meta.periodIndex`
// when explicit, else derived from the `at` seconds clock. `undo`/`correction`
// rows carry a signed `value` (negative) that we sum like reduceState does.
//
// All derivations are a single O(n) pass; running totals are accumulated here
// (we never trust stored runningA/runningB — fixtures may not populate them).

/** Event types that contribute a (possibly signed) value to the score. */
const VALUE_TYPES = new Set(['point', 'undo', 'correction']);

/** Default bucket label for the synthetic single period (no `periods` config). */
const FULL_LABEL = 'FINAL';

/** Default `meta.type` when an event carries a value but no explicit subtype. */
const DEFAULT_TYPE = 'point';

/**
 * Returns the scoring rows (those carrying a value) in stream order. Non-scoring
 * rows (serve_change, timeout, note, set_end) are skipped.
 *
 * @param {ReadonlyArray<object>} events
 * @returns {object[]}
 */
function valueRows(events) {
  return events.filter((e) => VALUE_TYPES.has(e.type));
}

/**
 * Assigns a period index to a scoring row.
 *   1. `event.meta.periodIndex` wins when present (survives stoppage / OT).
 *   2. else walk cumulative period durations against the `at` seconds clock.
 *   3. clamp into [0, periods.length-1]; with no periods → 0.
 *
 * @param {object} event
 * @param {Array<{durationSec?: number}>} periods
 * @returns {number}
 */
function periodIndexFor(event, periods) {
  const explicit = event.meta?.periodIndex;
  if (explicit !== undefined && explicit !== null) {
    return clamp(Number(explicit), 0, Math.max(0, periods.length - 1));
  }
  if (periods.length === 0) return 0;

  const clock = Number(event.at ?? 0);
  let elapsed = 0;
  for (let i = 0; i < periods.length; i += 1) {
    elapsed += Number(periods[i].durationSec ?? 0);
    if (clock < elapsed) return i;
  }
  return periods.length - 1; // past the final boundary (stoppage / OT) → last period
}

function clamp(n, lo, hi) {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Signed value carried by a scoring row (`undo`/`correction` are negative). */
function valueOf(event) {
  return Number(event.value ?? 0);
}

/** The sport subtype of a row, defaulting to `'point'`. */
function typeOf(event) {
  return event.meta?.type ?? DEFAULT_TYPE;
}

/**
 * Per-period team totals (the LINE SCORE table, research §4.D).
 *
 * `periods` may be:
 *   • an array of `{ label?, durationSec? }` — one bucket per period; events are
 *     placed by `meta.periodIndex` (explicit) or by the seconds clock.
 *   • a positive integer N — auto-segment the ordered scoring rows into N
 *     equal-count buckets (custom/untimed games, research §4.E). `segmentedBy`
 *     reports `'count'`.
 *   • omitted / empty — a single `FINAL` bucket equal to the match total.
 *
 * @param {ReadonlyArray<object>} events
 * @param {Array<{label?: string, durationSec?: number}>|number} [periods]
 * @returns {{ periods: Array<{label: string, a: number, b: number}>,
 *   totalA: number, totalB: number, segmentedBy: 'period'|'count'|'whole' }}
 */
export function lineScore(events, periods) {
  const rows = valueRows(events);

  // ── Equal-count auto-segmentation (custom/untimed) ─────────────────────────
  if (typeof periods === 'number') {
    const n = Math.max(1, Math.floor(periods));
    const buckets = Array.from({ length: n }, (_, i) => ({
      label: `S${i + 1}`,
      a: 0,
      b: 0,
    }));
    rows.forEach((row, idx) => {
      const bucket = buckets[Math.min(n - 1, Math.floor((idx * n) / rows.length))];
      addTo(bucket, row);
    });
    return finishLine(buckets, 'count');
  }

  const periodList = Array.isArray(periods) ? periods : [];

  // ── Single whole-match bucket (no periods) ─────────────────────────────────
  if (periodList.length === 0) {
    const bucket = { label: FULL_LABEL, a: 0, b: 0 };
    rows.forEach((row) => addTo(bucket, row));
    return finishLine([bucket], 'whole');
  }

  // ── Period buckets (explicit periodIndex or clock fallback) ────────────────
  const buckets = periodList.map((p, i) => ({
    label: p.label ?? `P${i + 1}`,
    a: 0,
    b: 0,
  }));
  rows.forEach((row) => {
    const idx = periodIndexFor(row, periodList);
    addTo(buckets[idx], row);
  });
  return finishLine(buckets, 'period');
}

/** Adds a signed scoring row's value to a bucket's per-team total. */
function addTo(bucket, row) {
  const value = valueOf(row);
  if (row.team === 'A') bucket.a += value;
  else if (row.team === 'B') bucket.b += value;
}

/** Sums bucket totals into the line-score result. */
function finishLine(buckets, segmentedBy) {
  let totalA = 0;
  let totalB = 0;
  for (const bucket of buckets) {
    totalA += bucket.a;
    totalB += bucket.b;
  }
  return { periods: buckets, totalA, totalB, segmentedBy };
}

/**
 * Full goals/period match state from the event stream in one logical pass.
 *
 * @param {ReadonlyArray<object>} events
 * @param {{ periods?: Array<{label?: string, durationSec?: number}>|number }} [config]
 * @returns {{
 *   totalA: number, totalB: number,
 *   breakdown: { A: Record<string, number>, B: Record<string, number> },
 *   timeline: Array<{ seq: number, at: number, minute: number, periodIndex: number,
 *     team: 'A'|'B', value: number, type: string, runningA: number, runningB: number }>,
 *   lineScore: { periods: Array<{label: string, a: number, b: number}>,
 *     totalA: number, totalB: number, segmentedBy: string },
 * }}
 */
export function goalsState(events = [], config = {}) {
  const periods = config.periods;
  const periodList = Array.isArray(periods) ? periods : [];
  const rows = valueRows(events);

  let totalA = 0;
  let totalB = 0;
  let runningA = 0;
  let runningB = 0;
  const breakdown = { A: {}, B: {} };
  const timeline = [];

  for (const event of rows) {
    const value = valueOf(event);
    const type = typeOf(event);
    const teamKey = event.team === 'A' ? 'A' : event.team === 'B' ? 'B' : null;

    if (teamKey === 'A') {
      totalA += value;
      runningA += value;
    } else if (teamKey === 'B') {
      totalB += value;
      runningB += value;
    }

    if (teamKey) {
      breakdown[teamKey][type] = (breakdown[teamKey][type] ?? 0) + value;
    }

    const at = Number(event.at ?? 0);
    timeline.push({
      seq: Number(event.seq ?? timeline.length + 1),
      at,
      minute: Math.floor(at / 60),
      periodIndex: periodIndexFor(event, periodList),
      team: event.team,
      value,
      type,
      runningA,
      runningB,
    });
  }

  return {
    totalA,
    totalB,
    breakdown,
    timeline,
    lineScore: lineScore(events, periods),
  };
}
