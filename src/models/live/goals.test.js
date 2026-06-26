import { describe, expect, it } from 'vitest';
import { appendPoint } from './scoringEvents';
import { goalsState, lineScore } from './goals';

// ─── Test helpers ────────────────────────────────────────────────────────────
//
// These build streams over the REAL `scoringEvents` model: every scoring row is
// `type: 'point'` carrying { team, value, at, meta? }. The sport subtype
// (goal / try / conv / pen / raid / tackle …) lives in `meta.type`; the period a
// row belongs to lives in `meta.periodIndex` when explicit, else it is derived
// from the seconds clock (`at`) by walking cumulative period durations.

let CLOCK = 0;

/** A monotonically increasing seconds clock so the clock-fallback branch works. */
function freshClock() {
  CLOCK = 0;
}

/**
 * Append one scoring event for `team` worth `value` points.
 * `meta` may carry `{ periodIndex, type, label, ... }`.
 * `at` is a real seconds clock (NOT a counter) so duration-based bucketing works.
 */
function score(events, team, { value = 1, at, type, meta } = {}) {
  const clock = at ?? (CLOCK += 30); // default: advance 30s per event
  const fullMeta = { ...(meta ?? {}) };
  if (type !== undefined) fullMeta.type = type;
  return appendPoint(events, {
    team,
    value,
    at: clock,
    meta: Object.keys(fullMeta).length ? fullMeta : undefined,
  });
}

// Period presets (durations in SECONDS, matching sportRegistry timePresets).
const BASKETBALL_QUARTERS = [
  { label: 'Q1', durationSec: 600 },
  { label: 'Q2', durationSec: 600 },
  { label: 'Q3', durationSec: 600 },
  { label: 'Q4', durationSec: 600 },
];
const FOOTBALL_HALVES = [
  { label: 'H1', durationSec: 2700 },
  { label: 'H2', durationSec: 2700 },
];

// ─── lineScore — basketball quarter line score (explicit periodIndex) ────────

describe('lineScore — basketball quarters', () => {
  it('buckets points into quarters by explicit meta.periodIndex', () => {
    freshClock();
    let e = [];
    // Q1: A +2, B +3 (one trey)
    e = score(e, 'A', { value: 2, meta: { periodIndex: 0 } });
    e = score(e, 'B', { value: 3, meta: { periodIndex: 0 } });
    // Q2: A +2, A +2, B +2
    e = score(e, 'A', { value: 2, meta: { periodIndex: 1 } });
    e = score(e, 'A', { value: 2, meta: { periodIndex: 1 } });
    e = score(e, 'B', { value: 2, meta: { periodIndex: 1 } });
    // Q3: B +3
    e = score(e, 'B', { value: 3, meta: { periodIndex: 2 } });
    // Q4: A +1 (FT), A +2
    e = score(e, 'A', { value: 1, meta: { periodIndex: 3 } });
    e = score(e, 'A', { value: 2, meta: { periodIndex: 3 } });

    const ls = lineScore(e, BASKETBALL_QUARTERS);

    expect(ls.periods.map((p) => p.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(ls.periods.map((p) => [p.a, p.b])).toEqual([
      [2, 3], // Q1
      [4, 2], // Q2
      [0, 3], // Q3
      [3, 0], // Q4
    ]);
    expect(ls.totalA).toBe(9);
    expect(ls.totalB).toBe(8);
  });

  it('still produces empty cells for periods with no scoring', () => {
    freshClock();
    let e = [];
    e = score(e, 'A', { value: 2, meta: { periodIndex: 0 } });
    const ls = lineScore(e, BASKETBALL_QUARTERS);
    expect(ls.periods.map((p) => [p.a, p.b])).toEqual([
      [2, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(ls.totalA).toBe(2);
    expect(ls.totalB).toBe(0);
  });
});

// ─── goalsState — football half timeline (clock-fallback bucketing) ──────────

describe('goalsState — football halves timeline', () => {
  it('derives a minute/period-stamped timeline and totals via the seconds clock', () => {
    let e = [];
    // First half (0–2700s): A scores at 34', B equalises at 44'.
    e = score(e, 'A', { at: 34 * 60, type: 'goal' });
    e = score(e, 'B', { at: 44 * 60, type: 'goal' });
    // Second half (2700–5400s): A scores at 72' (= 4320s).
    e = score(e, 'A', { at: 72 * 60, type: 'goal' });

    const state = goalsState(e, { periods: FOOTBALL_HALVES });

    // Timeline carries structured rows (no display strings).
    expect(state.timeline).toHaveLength(3);
    expect(state.timeline.map((r) => r.periodIndex)).toEqual([0, 0, 1]);
    expect(state.timeline.map((r) => r.team)).toEqual(['A', 'B', 'A']);
    expect(state.timeline.map((r) => r.type)).toEqual(['goal', 'goal', 'goal']);
    // Running totals accumulate across the whole match.
    expect(state.timeline.map((r) => [r.runningA, r.runningB])).toEqual([
      [1, 0],
      [1, 1],
      [2, 1],
    ]);
    // Clock + derived minute on each row.
    expect(state.timeline.map((r) => r.minute)).toEqual([34, 44, 72]);

    // Per-team totals.
    expect(state.totalA).toBe(2);
    expect(state.totalB).toBe(1);

    // Line score reflects half-by-half split.
    expect(state.lineScore.periods.map((p) => [p.a, p.b])).toEqual([
      [1, 1], // H1
      [1, 0], // H2
    ]);
  });
});

// ─── goalsState — rugby +5 / +2 / +3 totals & per-type breakdown ─────────────

describe('goalsState — rugby weighted scoring', () => {
  it('sums +N values and breaks down points by meta.type per team', () => {
    freshClock();
    let e = [];
    // Team A: try (5) + conversion (2), then a penalty (3).
    e = score(e, 'A', { value: 5, type: 'try' });
    e = score(e, 'A', { value: 2, type: 'conv' });
    e = score(e, 'A', { value: 3, type: 'pen' });
    // Team B: penalty (3) + drop goal (3).
    e = score(e, 'B', { value: 3, type: 'pen' });
    e = score(e, 'B', { value: 3, type: 'dg' });

    const state = goalsState(e, {});

    expect(state.totalA).toBe(10); // 5 + 2 + 3
    expect(state.totalB).toBe(6); //  3 + 3

    // Per-team, per-type point breakdown — one generic mechanism, no sport code.
    expect(state.breakdown.A).toEqual({ try: 5, conv: 2, pen: 3 });
    expect(state.breakdown.B).toEqual({ pen: 3, dg: 3 });

    // Without a `periods` config, line score is a single bucket = the match total.
    expect(state.lineScore.periods).toHaveLength(1);
    expect(state.lineScore.periods[0]).toMatchObject({ a: 10, b: 6 });
  });
});

// ─── goalsState — kabaddi raid / tackle points ───────────────────────────────

describe('goalsState — kabaddi raid & tackle points', () => {
  it('aggregates raid and tackle point types per team', () => {
    freshClock();
    let e = [];
    // Team A: raid +2 (touch x2), tackle +1, all-out +2.
    e = score(e, 'A', { value: 2, type: 'raid' });
    e = score(e, 'A', { value: 1, type: 'tackle' });
    e = score(e, 'A', { value: 2, type: 'allout' });
    // Team B: raid +1, super-tackle +2.
    e = score(e, 'B', { value: 1, type: 'raid' });
    e = score(e, 'B', { value: 2, type: 'tackle' });

    const state = goalsState(e, {});

    expect(state.totalA).toBe(5); // 2 + 1 + 2
    expect(state.totalB).toBe(3); // 1 + 2
    expect(state.breakdown.A).toEqual({ raid: 2, tackle: 1, allout: 2 });
    expect(state.breakdown.B).toEqual({ raid: 1, tackle: 2 });
  });
});

// ─── goalsState — custom +N game (the generic-engine guard) ──────────────────

describe('goalsState — custom +N game', () => {
  it('handles arbitrary +N values & user-defined types with no sport branching', () => {
    freshClock();
    let e = [];
    // A silly game: "trick shot" worth 7, "bonus" worth 4, plain +1.
    e = score(e, 'A', { value: 7, type: 'trickshot' });
    e = score(e, 'B', { value: 4, type: 'bonus' });
    e = score(e, 'A', { value: 1 }); // no meta.type → falls under 'point'
    e = score(e, 'B', { value: 4, type: 'bonus' });

    const state = goalsState(e, {});

    expect(state.totalA).toBe(8); // 7 + 1
    expect(state.totalB).toBe(8); // 4 + 4
    expect(state.breakdown.A).toEqual({ trickshot: 7, point: 1 });
    expect(state.breakdown.B).toEqual({ bonus: 8 });

    // Timeline preserves the custom value & type, running totals intact.
    expect(state.timeline.map((r) => [r.team, r.value, r.type])).toEqual([
      ['A', 7, 'trickshot'],
      ['B', 4, 'bonus'],
      ['A', 1, 'point'],
      ['B', 4, 'bonus'],
    ]);
    expect(state.timeline.map((r) => [r.runningA, r.runningB])).toEqual([
      [7, 0],
      [7, 4],
      [8, 4],
      [8, 8],
    ]);
  });

  it('untimed custom game auto-buckets into equal-count segments when periods omitted but bucketCount given', () => {
    freshClock();
    let e = [];
    for (let i = 0; i < 4; i += 1) e = score(e, i % 2 === 0 ? 'A' : 'B', { value: 1 });
    const ls = lineScore(e, 2); // numeric → split ordered events into 2 equal-count buckets
    expect(ls.periods).toHaveLength(2);
    expect(ls.periods.map((p) => [p.a, p.b])).toEqual([
      [1, 1],
      [1, 1],
    ]);
    expect(ls.segmentedBy).toBe('count');
  });
});

// ─── goalsState — undo / correction signed values ────────────────────────────

describe('goalsState — undo & correction', () => {
  it('respects signed adjustments without crashing', () => {
    freshClock();
    let e = [];
    e = score(e, 'A', { value: 5, type: 'try' });
    // A correction event carrying a negative value (model emits these).
    e = [
      ...e,
      {
        seq: e.length + 1,
        type: 'correction',
        team: 'A',
        value: -5,
        at: 100,
        meta: { type: 'try' },
      },
    ];
    const state = goalsState(e, {});
    expect(state.totalA).toBe(0);
    expect(state.breakdown.A).toEqual({ try: 0 });
  });
});
