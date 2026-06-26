import { describe, expect, it } from 'vitest';
import { appendPoint, appendUndo, reduceState } from './scoringEvents';

// ─── appendPoint ─────────────────────────────────────────────────────────────

describe('appendPoint', () => {
  it('appends a self-describing point event onto an empty stream', () => {
    const events = appendPoint([], { team: 'A', at: 1000 });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'point',
      team: 'A',
      value: 1,
      runningA: 1,
      runningB: 0,
      setsA: 0,
      setsB: 0,
      at: 1000,
    });
  });

  it('does not mutate the input array (append-only)', () => {
    const original = [];
    const next = appendPoint(original, { team: 'A', at: 1 });

    expect(original).toHaveLength(0);
    expect(next).not.toBe(original);
  });

  it('computes running totals across a rally for both teams', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', at: 1 });
    events = appendPoint(events, { team: 'B', at: 2 });
    events = appendPoint(events, { team: 'A', at: 3 });

    expect(events.map(e => [e.runningA, e.runningB])).toEqual([
      [1, 0],
      [1, 1],
      [2, 1],
    ]);
  });

  it('monotonically increments seq from the last event, not the array index', () => {
    const seeded = [{ seq: 41, type: 'note', at: 0 }];
    const events = appendPoint(seeded, { team: 'B', at: 5 });

    expect(events[events.length - 1].seq).toBe(42);
  });

  it('supports custom +N values for rugby/kabaddi/custom games', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', value: 5, at: 1 }); // try
    events = appendPoint(events, { team: 'A', value: 2, at: 2 }); // conversion
    events = appendPoint(events, { team: 'B', value: 3, at: 3 }); // penalty

    expect(events.at(-1)).toMatchObject({ runningA: 7, runningB: 3 });
  });

  it('carries setsA/setsB forward unchanged and stores optional fields', () => {
    const seeded = [
      { seq: 1, type: 'point', team: 'A', value: 1, runningA: 1, runningB: 0, setsA: 2, setsB: 1, at: 1 },
    ];
    const events = appendPoint(seeded, { team: 'B', at: 2, playerId: 'p9', meta: { kind: 'ace' } });

    expect(events.at(-1)).toMatchObject({
      setsA: 2,
      setsB: 1,
      playerId: 'p9',
      meta: { kind: 'ace' },
    });
  });
});

// ─── appendUndo ──────────────────────────────────────────────────────────────

describe('appendUndo', () => {
  it('appends a compensating undo event without deleting prior events', () => {
    let events = appendPoint([], { team: 'A', at: 1 });
    const before = events.length;
    events = appendUndo(events, { at: 2 });

    expect(events).toHaveLength(before + 1);
    expect(events[0].type).toBe('point'); // original preserved
    expect(events.at(-1).type).toBe('undo');
  });

  it('reverses the last scoring point in the running totals', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', at: 1 });
    events = appendPoint(events, { team: 'B', at: 2 });
    events = appendUndo(events, { at: 3 });

    // The undo reverses B's point (the last active point) → score returns to 1-0.
    // The undo row records the team whose point was reversed.
    expect(events.at(-1)).toMatchObject({ team: 'B', runningA: 1, runningB: 0 });
  });

  it('reverses a custom +N point by the right magnitude', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', value: 5, at: 1 });
    events = appendUndo(events, { at: 2 });

    expect(events.at(-1)).toMatchObject({ runningA: 0, runningB: 0, value: -5 });
  });

  it('is a no-op on an empty stream', () => {
    const events = appendUndo([], { at: 1 });
    expect(events).toEqual([]);
  });

  it('skips non-point events and reverses the most recent still-active point', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', at: 1 });
    // a note carries score forward, never undone
    events = [...events, { seq: 2, type: 'note', runningA: 1, runningB: 0, setsA: 0, setsB: 0, at: 2 }];
    events = appendUndo(events, { at: 3 });

    expect(events.at(-1)).toMatchObject({ type: 'undo', team: 'A', runningA: 0, runningB: 0 });
  });

  it('does not re-undo a point already compensated by an earlier undo', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', at: 1 }); // A: 1-0
    events = appendPoint(events, { team: 'A', at: 2 }); // A: 2-0
    events = appendUndo(events, { at: 3 });             // -> 1-0
    events = appendUndo(events, { at: 4 });             // -> 0-0 (undo the first A point)

    expect(events.at(-1)).toMatchObject({ runningA: 0, runningB: 0 });
    expect(reduceState(events)).toMatchObject({ pointsA: 0, pointsB: 0 });
  });

  it('is a no-op when every point has already been undone', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', at: 1 });
    events = appendUndo(events, { at: 2 });
    const compensated = events.length;
    events = appendUndo(events, { at: 3 });

    expect(events).toHaveLength(compensated); // nothing left to undo
  });
});

// ─── reduceState ─────────────────────────────────────────────────────────────

describe('reduceState', () => {
  it('returns a zeroed state for an empty stream', () => {
    expect(reduceState([])).toEqual({
      pointsA: 0,
      pointsB: 0,
      setsA: 0,
      setsB: 0,
      lastSeq: 0,
    });
  });

  it('derives points and sets in a single pass', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', at: 1 });
    events = appendPoint(events, { team: 'A', at: 2 });
    events = appendPoint(events, { team: 'B', at: 3 });

    expect(reduceState(events)).toEqual({
      pointsA: 2,
      pointsB: 1,
      setsA: 0,
      setsB: 0,
      lastSeq: 3,
    });
  });

  it('reflects undo reversals in the derived state', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', at: 1 });
    events = appendPoint(events, { team: 'B', at: 2 });
    events = appendUndo(events, { at: 3 });

    expect(reduceState(events)).toMatchObject({ pointsA: 1, pointsB: 0 });
  });

  // ── KEYSTONE: reduceState must agree with the running totals stored on the
  //    last event after ANY mix of points and undos. Catches append/reduce drift.
  it('agrees with the running totals stored on the last event (keystone)', () => {
    let events = [];
    events = appendPoint(events, { team: 'A', value: 3, at: 1 });
    events = appendPoint(events, { team: 'B', at: 2 });
    events = appendPoint(events, { team: 'B', at: 3 });
    events = appendUndo(events, { at: 4 });
    events = appendPoint(events, { team: 'A', at: 5 });
    events = appendUndo(events, { at: 6 });

    const state = reduceState(events);
    const last = events.at(-1);
    expect(state.pointsA).toBe(last.runningA);
    expect(state.pointsB).toBe(last.runningB);
    expect(state.lastSeq).toBe(last.seq);
  });
});
