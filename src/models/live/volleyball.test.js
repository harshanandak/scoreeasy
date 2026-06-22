import { describe, expect, it } from 'vitest';
import { appendPoint, appendUndo } from './scoringEvents';
import { volleyballState } from './volleyball';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Append a single point for `team`. */
function point(events, team) {
  return appendPoint(events, { team, at: events.length + 1 });
}

/**
 * Append an INTERLEAVED partial rally that reaches the live score (a, b) WITHOUT
 * closing the set. Strictly alternates A,B up to min(a,b) — keeping the gap <= 1
 * so the set never satisfies win-by — then the leader scores the remainder.
 *
 * Use this for in-progress states (setPoint / sideSwitched / pointState) where
 * the assertion expects an open set whose live score is exactly (a, b). The
 * caller is responsible for keeping (a, b) below the win condition.
 */
function interleave(events, a, b) {
  let next = events;
  const shared = Math.min(a, b);
  for (let i = 0; i < shared; i += 1) {
    next = point(next, 'A');
    next = point(next, 'B');
  }
  const leader = a >= b ? 'A' : 'B';
  for (let i = 0; i < Math.abs(a - b); i += 1) {
    next = point(next, leader);
  }
  return next;
}

/**
 * Append ONE COMPLETE set ending exactly (a, b) with the higher scorer winning
 * on the FINAL appended point — realistic interleaving, never a sequential block.
 *
 * Construction: strictly alternate A,B up to min(a,b) [gap stays <= 1, so no win
 * can fire early even in a deuce past the target], THEN the winner scores the
 * remaining |a - b| points — the clinching point lands exactly last. Because the
 * winning point is the last event, a single undo re-opens the set at (a-1, b).
 *
 * Returns the events array so calls chain to build multi-set fixtures.
 */
function playSet(events, a, b) {
  return interleave(events, a, b);
}

/** Append a stored serve_change event (engine state, not a scoring row). */
function serveChange(events, team, at) {
  const seq = events.length === 0 ? 1 : Number(events[events.length - 1].seq ?? 0) + 1;
  return [...events, { seq, type: 'serve_change', team, servingAfter: team, at }];
}

const VB = { pointsPerSet: 25, deciderPoints: 15, winBy: 2, bestOf: 5 };

// ─── Fresh / empty stream ────────────────────────────────────────────────────

describe('volleyballState — empty stream', () => {
  it('returns a zeroed, in-progress state for no events', () => {
    expect(volleyballState([], VB)).toMatchObject({
      currentSet: 1,
      pointsA: 0,
      pointsB: 0,
      completedSets: [],
      setsA: 0,
      setsB: 0,
      isMatchOver: false,
      winner: null,
      pointState: 'normal',
      servingTeam: null,
      sideSwitched: false,
    });
  });

  it('uses config.initialServer when no serve_change has occurred', () => {
    expect(volleyballState([], { ...VB, initialServer: 'B' }).servingTeam).toBe('B');
  });

  it('applies config defaults when config is omitted', () => {
    const state = volleyballState([]);
    expect(state).toMatchObject({ currentSet: 1, pointsA: 0, pointsB: 0, isMatchOver: false });
  });
});

// ─── Set ends at the target with win-by-2 ────────────────────────────────────

describe('volleyballState — set ends at 25', () => {
  it('ends a set when a team reaches 25 leading by >= 2', () => {
    const events = playSet([], 25, 20); // A wins set 1 25-20
    const state = volleyballState(events, VB);

    expect(state.completedSets).toEqual([{ a: 25, b: 20 }]);
    expect(state.setsA).toBe(1);
    expect(state.setsB).toBe(0);
    expect(state.currentSet).toBe(2);
    expect(state.pointsA).toBe(0); // reset for next set
    expect(state.pointsB).toBe(0);
    expect(state.isMatchOver).toBe(false);
  });

  it('does NOT end the set at 25-24 (lead < winBy)', () => {
    const events = interleave([], 25, 24);
    const state = volleyballState(events, VB);

    expect(state.completedSets).toEqual([]);
    expect(state.currentSet).toBe(1);
    expect(state.pointsA).toBe(25);
    expect(state.pointsB).toBe(24);
    expect(state.setsA).toBe(0);
  });
});

// ─── Deuce past the target — NO CAP ──────────────────────────────────────────

describe('volleyballState — deuce, no cap', () => {
  it('runs past 25 and ends 27-25', () => {
    // alternate to 25-25 (gap <= 1, no early win), then A scores the last 2 → 27-25
    const events = playSet([], 27, 25);
    const state = volleyballState(events, VB);

    expect(state.completedSets).toEqual([{ a: 27, b: 25 }]);
    expect(state.setsA).toBe(1);
    expect(state.currentSet).toBe(2);
  });

  it('keeps the set alive at 26-25 (still only +1)', () => {
    const events = interleave([], 26, 25); // 26-25, leader only +1 → open
    const state = volleyballState(events, VB);

    expect(state.completedSets).toEqual([]);
    expect(state.pointsA).toBe(26);
    expect(state.pointsB).toBe(25);
    expect(state.setsA).toBe(0);
  });

  it('ends a long deuce 32-30 with no cap', () => {
    // alternate to 30-30 (no cap, no early win), then A scores the last 2 → 32-30
    const events = playSet([], 32, 30);
    const state = volleyballState(events, VB);

    expect(state.completedSets).toEqual([{ a: 32, b: 30 }]);
    expect(state.setsA).toBe(1);
  });
});

// ─── Deciding set uses deciderPoints (15) ────────────────────────────────────

describe('volleyballState — deciding set to 15', () => {
  it('uses 15 as the target in the deciding (5th) set of bo5', () => {
    // A wins sets 1-2, B wins sets 3-4 → set 5 is the decider
    let events = [];
    events = playSet(events, 25, 10); // set1 A
    events = playSet(events, 25, 10); // set2 A
    events = playSet(events, 10, 25); // set3 B
    events = playSet(events, 10, 25); // set4 B
    // now 2-2; set 5 to 15
    events = playSet(events, 15, 9); // A wins 15-9

    const state = volleyballState(events, VB);
    expect(state.completedSets[4]).toEqual({ a: 15, b: 9 });
    expect(state.setsA).toBe(3);
    expect(state.setsB).toBe(2);
    expect(state.isMatchOver).toBe(true);
    expect(state.winner).toBe('A');
  });

  it('does NOT treat 15 as the target in a non-deciding set', () => {
    const events = interleave([], 15, 0); // set 1, only 15-0 (open)
    const state = volleyballState(events, VB);
    expect(state.completedSets).toEqual([]); // set 1 target is 25, not 15
    expect(state.pointsA).toBe(15);
  });

  it('applies the decider target at set 3 in bo3', () => {
    const cfg = { ...VB, bestOf: 3 };
    let events = [];
    events = playSet(events, 25, 10); // set1 A
    events = playSet(events, 10, 25); // set2 B
    events = playSet(events, 15, 5);  // decider to 15
    const state = volleyballState(events, cfg);
    expect(state.completedSets[2]).toEqual({ a: 15, b: 5 });
    expect(state.isMatchOver).toBe(true);
    expect(state.winner).toBe('A');
  });
});

// ─── Match end: bo3 vs bo5 ───────────────────────────────────────────────────

describe('volleyballState — match end (bestOf)', () => {
  it('bo5: match ends when a team wins 3 sets', () => {
    let events = [];
    for (let i = 0; i < 3; i += 1) {
      events = playSet(events, 25, 10);
    }
    const state = volleyballState(events, VB);
    expect(state.setsA).toBe(3);
    expect(state.isMatchOver).toBe(true);
    expect(state.winner).toBe('A');
  });

  it('bo3: match ends when a team wins 2 sets', () => {
    const cfg = { ...VB, bestOf: 3 };
    let events = [];
    events = playSet(events, 25, 10);
    events = playSet(events, 25, 12);
    const state = volleyballState(events, cfg);
    expect(state.setsA).toBe(2);
    expect(state.isMatchOver).toBe(true);
    expect(state.winner).toBe('A');
  });

  it('B can win the match too', () => {
    const cfg = { ...VB, bestOf: 3 };
    let events = [];
    events = playSet(events, 10, 25);
    events = playSet(events, 23, 25);
    const state = volleyballState(events, cfg);
    expect(state.winner).toBe('B');
    expect(state.setsB).toBe(2);
    expect(state.isMatchOver).toBe(true);
  });

  it('ignores points scored after the match is already won (no extra set)', () => {
    const cfg = { ...VB, bestOf: 3 };
    let events = [];
    events = playSet(events, 25, 10);
    events = playSet(events, 25, 10); // match over 2-0
    events = playSet(events, 10, 25); // stray points
    const state = volleyballState(events, cfg);
    expect(state.setsA).toBe(2);
    expect(state.setsB).toBe(0);
    expect(state.completedSets).toHaveLength(2);
    expect(state.isMatchOver).toBe(true);
    expect(state.winner).toBe('A');
  });
});

// ─── pointState: setPoint and matchPoint ─────────────────────────────────────

describe('volleyballState — pointState', () => {
  it('normal mid-set', () => {
    const events = interleave([], 10, 8);
    expect(volleyballState(events, VB).pointState).toBe('normal');
  });

  it('setPoint when a team is one point from winning the set (not the match)', () => {
    const events = interleave([], 24, 20); // A one point from set 1
    const state = volleyballState(events, VB);
    expect(state.pointState).toBe('setPoint');
  });

  it('NOT setPoint at 24-24 (winning point would not satisfy win-by-2)', () => {
    const events = interleave([], 24, 24);
    expect(volleyballState(events, VB).pointState).toBe('normal');
  });

  it('setPoint in deuce region at 25-24 (next A point wins 26-24)', () => {
    const events = interleave([], 25, 24); // 25-24
    expect(volleyballState(events, VB).pointState).toBe('setPoint');
  });

  it('matchPoint when winning this set also wins the match', () => {
    // bo3, A leads 1-0 in sets, A at 24 in set 2 → next point clinches match
    const cfg = { ...VB, bestOf: 3 };
    let events = [];
    events = playSet(events, 25, 10); // set1 A (1-0)
    events = interleave(events, 24, 20); // set2: A 24-20 (open)
    expect(volleyballState(events, cfg).pointState).toBe('matchPoint');
  });

  it('setPoint (not matchPoint) when the set win does not yet clinch the match', () => {
    // bo5, sets 0-0, A at 24 in set 1 → set point only
    const events = interleave([], 24, 10);
    expect(volleyballState(events, VB).pointState).toBe('setPoint');
  });

  it('reports normal once the match is over', () => {
    const cfg = { ...VB, bestOf: 3 };
    let events = [];
    events = playSet(events, 25, 10);
    events = playSet(events, 25, 10);
    expect(volleyballState(events, cfg).pointState).toBe('normal');
  });

  it('reports max severity when BOTH sides are at set point under winBy=1', () => {
    // winBy=1, target 25: at 24-24 either team wins with one point → set point
    const cfg = { ...VB, winBy: 1 };
    const events = interleave([], 24, 24);
    expect(volleyballState(events, cfg).pointState).toBe('setPoint');
  });
});

// ─── sideSwitched at 8 in the deciding set ───────────────────────────────────

describe('volleyballState — sideSwitched', () => {
  it('false before the deciding set even past 8 points', () => {
    const events = interleave([], 10, 3); // set 1 (open)
    expect(volleyballState(events, VB).sideSwitched).toBe(false);
  });

  it('true once either team reaches 8 in the deciding set', () => {
    let events = [];
    events = playSet(events, 25, 10);
    events = playSet(events, 25, 10);
    events = playSet(events, 10, 25);
    events = playSet(events, 10, 25); // 2-2, set 5
    events = interleave(events, 8, 5); // A hits 8 in decider (open)
    expect(volleyballState(events, VB).sideSwitched).toBe(true);
  });

  it('stays latched true even after the deciding set ends and points reset', () => {
    let events = [];
    events = playSet(events, 25, 10);
    events = playSet(events, 25, 10);
    events = playSet(events, 10, 25);
    events = playSet(events, 10, 25); // 2-2
    events = playSet(events, 15, 9);  // decider 15-9 (passed 8)
    const state = volleyballState(events, VB);
    expect(state.isMatchOver).toBe(true);
    expect(state.sideSwitched).toBe(true); // latched, not re-derived from reset points
  });

  it('false in the deciding set before reaching 8', () => {
    let events = [];
    events = playSet(events, 25, 10);
    events = playSet(events, 25, 10);
    events = playSet(events, 10, 25);
    events = playSet(events, 10, 25); // 2-2, set 5
    events = interleave(events, 7, 6); // max is 7 (open)
    expect(volleyballState(events, VB).sideSwitched).toBe(false);
  });
});

// ─── servingTeam from serve_change events ────────────────────────────────────

describe('volleyballState — servingTeam (stored, not inferred)', () => {
  it('defaults to initialServer when no serve_change exists', () => {
    const events = interleave([], 5, 3);
    expect(volleyballState(events, { ...VB, initialServer: 'A' }).servingTeam).toBe('A');
  });

  it('reads the latest serve_change, not who last scored', () => {
    // B scored last, but a serve_change handed serve to A (rally side-out)
    let events = interleave([], 5, 3);
    events = serveChange(events, 'A', 999);
    events = point(events, 'B'); // B scores again after serve flipped to A
    const state = volleyballState(events, { ...VB, initialServer: 'B' });
    expect(state.servingTeam).toBe('A'); // from serve_change, NOT last scorer (B)
  });

  it('uses the most recent of multiple serve_change events', () => {
    let events = interleave([], 5, 0);
    events = serveChange(events, 'B', 100);
    events = serveChange(events, 'A', 200);
    expect(volleyballState(events, VB).servingTeam).toBe('A');
  });

  it('null when no serve_change and no initialServer', () => {
    const events = interleave([], 5, 5);
    expect(volleyballState(events, VB).servingTeam).toBe(null);
  });
});

// ─── Undo integration ────────────────────────────────────────────────────────

describe('volleyballState — undo', () => {
  it('reverses a point so a set that looked done is alive again', () => {
    // A wins set 25-23 with the clinching point LAST → one undo re-opens at 24-23
    let events = playSet([], 25, 23);
    // undo A's last point → 24-23, set not over
    events = appendUndo(events, { at: events.length + 1 });
    const state = volleyballState(events, VB);
    expect(state.completedSets).toEqual([]);
    expect(state.pointsA).toBe(24);
    expect(state.pointsB).toBe(23);
    expect(state.setsA).toBe(0);
  });

  it('undo across a set boundary restores the prior set as in-progress', () => {
    // A wins set 1 at 25-20, then B scores 1 in set 2; undo that B point,
    // then undo A's set-winning point → set 1 reopens at 24-20.
    let events = playSet([], 25, 20); // set 1 done (A's 25th is the last event)
    events = point(events, 'B');      // set 2: 0-1
    events = appendUndo(events, { at: events.length + 1 }); // undo B set-2 point
    events = appendUndo(events, { at: events.length + 1 }); // undo A's 25th
    const state = volleyballState(events, VB);
    expect(state.completedSets).toEqual([]);
    expect(state.currentSet).toBe(1);
    expect(state.pointsA).toBe(24);
    expect(state.pointsB).toBe(20);
  });
});

// ─── Full match sequence ─────────────────────────────────────────────────────

describe('volleyballState — full match', () => {
  it('plays a full bo5 to a B victory with correct terminal state', () => {
    let events = [];
    events = playSet(events, 25, 22); // set1 A
    events = playSet(events, 18, 25); // set2 B
    events = playSet(events, 20, 25); // set3 B
    events = playSet(events, 25, 19); // set4 A
    events = playSet(events, 12, 15); // set5 B (decider 15-12)

    const state = volleyballState(events, VB);
    expect(state.completedSets).toEqual([
      { a: 25, b: 22 },
      { a: 18, b: 25 },
      { a: 20, b: 25 },
      { a: 25, b: 19 },
      { a: 12, b: 15 },
    ]);
    expect(state.setsA).toBe(2);
    expect(state.setsB).toBe(3);
    expect(state.isMatchOver).toBe(true);
    expect(state.winner).toBe('B');
    expect(state.pointState).toBe('normal');
    expect(state.pointsA).toBe(0);
    expect(state.pointsB).toBe(0);
    expect(state.currentSet).toBe(5);
    expect(state.sideSwitched).toBe(true);
  });
});
