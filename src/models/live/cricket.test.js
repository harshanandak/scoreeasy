import { describe, expect, it } from 'vitest';
import {
  buildBattingCard,
  buildBowlingCard,
  buildExtras,
  buildFallOfWickets,
  currentPartnership,
  requiredRunRate,
  thisOverTokens,
  inningsTotals,
} from './cricket';

// ─── Test helpers ────────────────────────────────────────────────────────────
//
// A delivery is `{over, ballInOver, legal, strikerId, nonStrikerId, bowlerId,
// runsBat, extraType?, extraRuns, wicket?, seq}`. These builders fill sane
// defaults so each test only states what it cares about. `legal` is derived
// from the attribution matrix: false for wide/noball/penalty, true otherwise.

const LEGAL_EXTRAS = new Set(['bye', 'legbye']);

function isLegalFor(extraType) {
  if (!extraType) return true;
  return LEGAL_EXTRAS.has(extraType);
}

let SEQ = 0;
function resetSeq() {
  SEQ = 0;
}

/** Build one delivery with defaults; `legal` auto-derived unless overridden. */
function ball(over, ballInOver, opts = {}) {
  SEQ += 1;
  const extraType = opts.extraType;
  return {
    over,
    ballInOver,
    legal: opts.legal ?? isLegalFor(extraType),
    strikerId: opts.strikerId ?? 'A',
    nonStrikerId: opts.nonStrikerId ?? 'B',
    bowlerId: opts.bowlerId ?? 'X',
    runsBat: opts.runsBat ?? 0,
    extraType,
    extraRuns: opts.extraRuns ?? 0,
    wicket: opts.wicket,
    seq: opts.seq ?? SEQ,
  };
}

/** Total innings runs the OFFICIAL way: bat runs + every extra run. */
function officialInningsRuns(deliveries) {
  return deliveries.reduce((sum, d) => sum + (d.runsBat || 0) + (d.extraRuns || 0), 0);
}

describe('inningsTotals — integrity invariant', () => {
  it('sum(batter runs) + extras === innings runs across every extra type', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { runsBat: 1, strikerId: 'A', nonStrikerId: 'B' }), // normal single
      ball(0, 2, { extraType: 'wide', extraRuns: 1 }), // wide +1
      ball(0, 3, { extraType: 'noball', extraRuns: 1, runsBat: 4 }), // no-ball, bat 4
      ball(0, 4, { extraType: 'bye', extraRuns: 4 }), // 4 byes
      ball(0, 5, { extraType: 'legbye', extraRuns: 2 }), // 2 leg byes
      ball(0, 6, { extraType: 'penalty', extraRuns: 5 }), // 5 penalty runs
      ball(0, 7, { runsBat: 2, strikerId: 'A', nonStrikerId: 'B' }), // normal two
      ball(0, 8, { runsBat: 0, wicket: { batterOutId: 'A', kind: 'bowled' } }), // bowled
    ];

    const totals = inningsTotals(deliveries);
    const batting = buildBattingCard(deliveries);
    const extras = buildExtras(deliveries);

    const sumBatterRuns = batting.reduce((s, row) => s + row.runs, 0);

    // The invariant, asserted three independent ways.
    expect(totals.runs).toBe(officialInningsRuns(deliveries));
    expect(sumBatterRuns + extras.total).toBe(totals.runs);
    expect(sumBatterRuns + extras.total).toBe(officialInningsRuns(deliveries));
  });

  it('counts legal balls only (wides/no-balls/penalty add no legal ball)', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { runsBat: 1 }), // legal
      ball(0, 2, { extraType: 'wide', extraRuns: 1 }), // not legal
      ball(0, 3, { extraType: 'noball', extraRuns: 1, runsBat: 0 }), // not legal
      ball(0, 4, { extraType: 'bye', extraRuns: 1 }), // legal
      ball(0, 5, { extraType: 'penalty', extraRuns: 5 }), // not legal
    ];
    const totals = inningsTotals(deliveries);
    expect(totals.legalBalls).toBe(2);
    expect(totals.wickets).toBe(0);
  });
});

describe('buildExtras — per-bucket attribution', () => {
  it('routes each extra to the right bucket and totals them', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { extraType: 'wide', extraRuns: 2 }),
      ball(0, 2, { extraType: 'noball', extraRuns: 1, runsBat: 0 }),
      ball(0, 3, { extraType: 'bye', extraRuns: 4 }),
      ball(0, 4, { extraType: 'legbye', extraRuns: 2 }),
      ball(0, 5, { extraType: 'penalty', extraRuns: 5 }),
      ball(0, 6, { runsBat: 3 }), // no extra — contributes nothing to extras
    ];
    const extras = buildExtras(deliveries);
    expect(extras).toEqual({ b: 4, lb: 2, w: 2, nb: 1, p: 5, total: 14 });
  });

  it('no-ball penalty only (not the bat runs) lands in the nb bucket', () => {
    resetSeq();
    const deliveries = [ball(0, 1, { extraType: 'noball', extraRuns: 1, runsBat: 4 })];
    const extras = buildExtras(deliveries);
    expect(extras.nb).toBe(1); // ONLY the no-ball penalty, not the 4 off the bat
    expect(extras.total).toBe(1);
  });
});

describe('buildBattingCard', () => {
  it('credits runs and balls correctly, excluding wides/no-balls from balls faced', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { strikerId: 'A', runsBat: 4 }), // A: 4 off 1
      ball(0, 2, { strikerId: 'A', extraType: 'wide', extraRuns: 1 }), // no ball faced, no bat run
      ball(0, 3, { strikerId: 'A', extraType: 'noball', extraRuns: 1, runsBat: 6 }), // 6 to A, no ball faced
      ball(0, 4, { strikerId: 'A', extraType: 'bye', extraRuns: 1 }), // ball faced, no bat run
      ball(0, 5, { strikerId: 'A', extraType: 'legbye', extraRuns: 2 }), // ball faced, no bat run
      ball(0, 6, { strikerId: 'A', runsBat: 1 }), // A: +1 off 1
    ];
    const card = buildBattingCard(deliveries);
    const a = card.find((r) => r.batterId === 'A');
    expect(a.runs).toBe(11); // 4 + 6 (no-ball bat) + 1
    expect(a.balls).toBe(4); // normal, bye, legbye, normal — NOT the wide/no-ball
    expect(a.fours).toBe(1);
    expect(a.sixes).toBe(1); // the six came off a no-ball but still credits the batter
  });

  it('computes strike rate and returns null SR when 0 balls faced', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { strikerId: 'A', runsBat: 1 }),
      // B comes on strike but only as non-striker so far — has faced 0 legal balls
    ];
    const card = buildBattingCard(deliveries);
    const a = card.find((r) => r.batterId === 'A');
    const b = card.find((r) => r.batterId === 'B');
    expect(a.strikeRate).toBeCloseTo(100, 5); // 1 run off 1 ball
    expect(b.balls).toBe(0);
    expect(b.strikeRate).toBeNull(); // never divide by zero
  });

  it('includes a not-out non-striker who has faced zero balls (union of striker ∪ non-striker)', () => {
    resetSeq();
    const deliveries = [ball(0, 1, { strikerId: 'A', nonStrikerId: 'B', runsBat: 0 })];
    const card = buildBattingCard(deliveries);
    expect(card.map((r) => r.batterId).sort()).toEqual(['A', 'B']);
    const b = card.find((r) => r.batterId === 'B');
    expect(b.out).toBe(false);
    expect(b.dismissal).toBeNull();
  });

  it('aggregates balls for a striker on NON-consecutive deliveries (strike rotation consequence)', () => {
    resetSeq();
    // A faces ball 1, strike rotates to B (odd run), B faces ball 2, back to A on ball 3.
    const deliveries = [
      ball(0, 1, { strikerId: 'A', nonStrikerId: 'B', runsBat: 1 }),
      ball(0, 2, { strikerId: 'B', nonStrikerId: 'A', runsBat: 0 }),
      ball(0, 3, { strikerId: 'A', nonStrikerId: 'B', runsBat: 2 }),
    ];
    const card = buildBattingCard(deliveries);
    const a = card.find((r) => r.batterId === 'A');
    const b = card.find((r) => r.batterId === 'B');
    expect(a.balls).toBe(2); // ball 1 + ball 3, even though they are not adjacent
    expect(a.runs).toBe(3);
    expect(b.balls).toBe(1);
    expect(b.runs).toBe(0);
  });

  it('records dismissal as structured data for the batter who got out', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, {
        strikerId: 'A',
        nonStrikerId: 'B',
        runsBat: 0,
        wicket: { batterOutId: 'A', kind: 'caught', fielderId: 'F1' },
      }),
    ];
    const card = buildBattingCard(deliveries);
    const a = card.find((r) => r.batterId === 'A');
    expect(a.out).toBe(true);
    expect(a.dismissal).toEqual({ kind: 'caught', bowlerId: 'X', fielderId: 'F1', batterOutId: 'A' });
  });

  it('attributes a run-out to the dismissed batter even when it is the non-striker', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, {
        strikerId: 'A',
        nonStrikerId: 'B',
        runsBat: 1,
        wicket: { batterOutId: 'B', kind: 'runout', fielderId: 'F2' },
      }),
    ];
    const card = buildBattingCard(deliveries);
    const a = card.find((r) => r.batterId === 'A');
    const b = card.find((r) => r.batterId === 'B');
    expect(a.out).toBe(false); // striker survives
    expect(a.runs).toBe(1); // the run still counts
    expect(b.out).toBe(true);
    expect(b.dismissal.kind).toBe('runout');
  });
});

describe('buildBowlingCard', () => {
  it('charges wides/no-balls to the bowler but never byes/leg-byes', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { bowlerId: 'X', runsBat: 2 }), // +2 to bowler
      ball(0, 2, { bowlerId: 'X', extraType: 'wide', extraRuns: 1 }), // +1 to bowler
      ball(0, 3, { bowlerId: 'X', extraType: 'noball', extraRuns: 1, runsBat: 4 }), // +5 to bowler (4 bat + 1 nb)
      ball(0, 4, { bowlerId: 'X', extraType: 'bye', extraRuns: 4 }), // +0 to bowler
      ball(0, 5, { bowlerId: 'X', extraType: 'legbye', extraRuns: 2 }), // +0 to bowler
    ];
    const card = buildBowlingCard(deliveries);
    const x = card.find((r) => r.bowlerId === 'X');
    expect(x.runs).toBe(8); // 2 + 1 (wide) + 5 (no-ball bat+penalty)
    expect(x.legalBalls).toBe(3); // normal, bye, legbye (NOT wide/no-ball)
  });

  it('credits wickets to the bowler EXCEPT run-outs', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { bowlerId: 'X', wicket: { batterOutId: 'A', kind: 'bowled' } }),
      ball(0, 2, { bowlerId: 'X', wicket: { batterOutId: 'B', kind: 'lbw' } }),
      ball(0, 3, { bowlerId: 'X', wicket: { batterOutId: 'C', kind: 'runout', fielderId: 'F' } }),
      ball(0, 4, { bowlerId: 'X', wicket: { batterOutId: 'D', kind: 'stumped', fielderId: 'WK' } }),
      ball(0, 5, { bowlerId: 'X', wicket: { batterOutId: 'E', kind: 'caught', fielderId: 'F' } }),
      ball(0, 6, { bowlerId: 'X', wicket: { batterOutId: 'G', kind: 'hitwicket' } }),
    ];
    const card = buildBowlingCard(deliveries);
    const x = card.find((r) => r.bowlerId === 'X');
    expect(x.wickets).toBe(5); // all except the run-out
  });

  it('computes overs and economy using calculateRunRate (runs per over)', () => {
    resetSeq();
    // 12 legal balls = 2 overs, 12 runs → econ 6.00
    const deliveries = [];
    for (let i = 0; i < 12; i += 1) {
      deliveries.push(ball(Math.floor(i / 6), (i % 6) + 1, { bowlerId: 'X', runsBat: 1 }));
    }
    const card = buildBowlingCard(deliveries);
    const x = card.find((r) => r.bowlerId === 'X');
    expect(x.overs).toBe('2');
    expect(x.economy).toBeCloseTo(6, 5);
  });

  it('flags a byes-only over as a maiden but a wide-containing over as not', () => {
    resetSeq();
    // Over 0: 6 legal balls, all byes → bowler charged 0 → maiden.
    const maidenOver = [];
    for (let i = 0; i < 6; i += 1) {
      maidenOver.push(ball(0, i + 1, { bowlerId: 'X', extraType: 'bye', extraRuns: 1 }));
    }
    const maidenCard = buildBowlingCard(maidenOver);
    expect(maidenCard.find((r) => r.bowlerId === 'X').maidens).toBe(1);

    resetSeq();
    // Over 0: a wide makes the over impossible to be a maiden, even at 0 bowler-charged... but wide charges 1.
    const wideOver = [];
    for (let i = 0; i < 6; i += 1) {
      wideOver.push(ball(0, i + 1, { bowlerId: 'X', runsBat: 0 }));
    }
    wideOver.push(ball(0, 1, { bowlerId: 'X', extraType: 'wide', extraRuns: 1 })); // extra delivery in over
    const wideCard = buildBowlingCard(wideOver);
    expect(wideCard.find((r) => r.bowlerId === 'X').maidens).toBe(0);
  });
});

describe('buildFallOfWickets', () => {
  it('records cumulative score, wicket number, batter out, and overs at fall', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { strikerId: 'A', runsBat: 4 }),
      ball(0, 2, { strikerId: 'A', runsBat: 0, wicket: { batterOutId: 'A', kind: 'bowled' } }), // 1st wkt @ 0.2
      ball(0, 3, { strikerId: 'C', runsBat: 2 }),
      ball(0, 4, { strikerId: 'C', runsBat: 0 }),
      ball(0, 5, { strikerId: 'C', runsBat: 0 }),
      ball(0, 6, { strikerId: 'C', runsBat: 0 }), // over 0 complete: 6 legal balls
      ball(1, 1, { strikerId: 'C', runsBat: 0, wicket: { batterOutId: 'C', kind: 'lbw' } }), // 2nd wkt @ 1.1
    ];
    const fow = buildFallOfWickets(deliveries);
    expect(fow).toHaveLength(2);
    expect(fow[0]).toMatchObject({ runs: 4, wicket: 1, batterOutId: 'A' });
    expect(fow[0].oversAtFall).toBe('0.2');
    expect(fow[1]).toMatchObject({ runs: 6, wicket: 2, batterOutId: 'C' });
    expect(fow[1].oversAtFall).toBe('1.1');
  });
});

describe('currentPartnership', () => {
  it('measures runs (incl. extras) and legal balls since the last wicket', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { strikerId: 'A', runsBat: 10 }),
      ball(0, 2, { strikerId: 'A', runsBat: 0, wicket: { batterOutId: 'A', kind: 'bowled' } }),
      // New partnership begins:
      ball(0, 3, { strikerId: 'C', runsBat: 2 }), // legal
      ball(0, 4, { strikerId: 'C', extraType: 'wide', extraRuns: 1 }), // extra run, no legal ball
      ball(0, 5, { strikerId: 'C', extraType: 'bye', extraRuns: 4 }), // legal ball, extra run
    ];
    const p = currentPartnership(deliveries);
    expect(p.runs).toBe(7); // 2 (bat) + 1 (wide) + 4 (bye), all since the wicket
    expect(p.balls).toBe(2); // the normal + the bye; the wide is not a legal ball
  });

  it('covers the whole innings when no wicket has fallen', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { strikerId: 'A', runsBat: 3 }),
      ball(0, 2, { strikerId: 'B', runsBat: 1 }),
    ];
    const p = currentPartnership(deliveries);
    expect(p.runs).toBe(4);
    expect(p.balls).toBe(2);
  });
});

describe('requiredRunRate', () => {
  it('computes runs per over needed off the balls remaining', () => {
    // Need 56 off 38 balls → 56*6/38 = 8.842...
    expect(requiredRunRate({ target: 286, runs: 230, ballsRemaining: 38 })).toBeCloseTo((56 * 6) / 38, 5);
  });

  it('returns 0 when the target is already reached or passed', () => {
    expect(requiredRunRate({ target: 100, runs: 100, ballsRemaining: 10 })).toBe(0);
    expect(requiredRunRate({ target: 100, runs: 120, ballsRemaining: 10 })).toBe(0);
  });

  it('returns null when there are no balls remaining but the target is unmet', () => {
    expect(requiredRunRate({ target: 100, runs: 90, ballsRemaining: 0 })).toBeNull();
  });
});

describe('thisOverTokens', () => {
  it('maps the current over deliveries to display tokens', () => {
    resetSeq();
    const deliveries = [
      ball(0, 1, { runsBat: 1 }), // previous over — ignored
      ball(1, 1, { runsBat: 0 }), // '.'
      ball(1, 1, { extraType: 'wide', extraRuns: 1 }), // 'Wd' — does not advance ball
      ball(1, 2, { runsBat: 4 }), // '4'
      ball(1, 3, { extraType: 'noball', extraRuns: 1, runsBat: 0 }), // 'Nb'
      ball(1, 3, { runsBat: 6 }), // '6'
      ball(1, 4, { runsBat: 0, wicket: { batterOutId: 'A', kind: 'bowled' } }), // 'W'
    ];
    const tokens = thisOverTokens(deliveries);
    expect(tokens).toEqual(['.', 'Wd', '4', 'Nb', '6', 'W']);
  });

  it('returns an empty array for no deliveries', () => {
    expect(thisOverTokens([])).toEqual([]);
  });
});

describe('defensive contract', () => {
  it('all builders accept an empty array', () => {
    expect(buildBattingCard([])).toEqual([]);
    expect(buildBowlingCard([])).toEqual([]);
    expect(buildExtras([])).toEqual({ b: 0, lb: 0, w: 0, nb: 0, p: 0, total: 0 });
    expect(buildFallOfWickets([])).toEqual([]);
    expect(currentPartnership([])).toEqual({ runs: 0, balls: 0 });
    expect(inningsTotals([])).toEqual({ runs: 0, legalBalls: 0, wickets: 0 });
  });

  it('sorts by seq defensively (out-of-order input)', () => {
    const deliveries = [
      { over: 0, ballInOver: 2, legal: true, strikerId: 'A', nonStrikerId: 'B', bowlerId: 'X', runsBat: 0, extraRuns: 0, wicket: { batterOutId: 'A', kind: 'bowled' }, seq: 2 },
      { over: 0, ballInOver: 1, legal: true, strikerId: 'A', nonStrikerId: 'B', bowlerId: 'X', runsBat: 4, extraRuns: 0, seq: 1 },
    ];
    const fow = buildFallOfWickets(deliveries);
    expect(fow[0].runs).toBe(4); // 4 was scored before the wicket fell
  });
});
