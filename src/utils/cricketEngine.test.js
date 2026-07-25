import { describe, it, expect } from 'vitest';
import {
  makeFormat,
  createInnings,
  makeDelivery,
  isLegalDelivery,
  wideValue,
  hasNoBall,
  hasWide,
  oversString,
  applyDelivery,
  undo,
  deriveInnings,
  deriveChase,
  canBowl,
} from './cricketEngine.js';

// Convenience: play a sequence of raw delivery partials onto a fresh innings.
function play(innings, format, deliveries) {
  return deliveries.reduce((inn, d) => applyDelivery(inn, makeDelivery(d), format), innings);
}

describe('primitives', () => {
  it('isLegalDelivery: wide & no-ball illegal, bye/leg-bye legal', () => {
    expect(isLegalDelivery(makeDelivery({ extras: [{ type: 'wide', runs: 1 }] }))).toBe(false);
    expect(isLegalDelivery(makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }))).toBe(false);
    expect(isLegalDelivery(makeDelivery({ extras: [{ type: 'bye', runs: 2 }] }))).toBe(true);
    expect(isLegalDelivery(makeDelivery({ extras: [{ type: 'leg-bye', runs: 1 }] }))).toBe(true);
    expect(isLegalDelivery(makeDelivery({ batsmanRuns: 4 }))).toBe(true);
  });

  it('multi-component extra is illegal if ANY wide/no-ball present', () => {
    const d = makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }, { type: 'leg-bye', runs: 2 }] });
    expect(isLegalDelivery(d)).toBe(false);
  });

  it('wideValue exposes numeric so UI can render 3wd / 5wd', () => {
    expect(wideValue(makeDelivery({ extras: [{ type: 'wide', runs: 3 }] }))).toBe(3);
    expect(wideValue(makeDelivery({ extras: [{ type: 'wide', runs: 5 }] }))).toBe(5);
    expect(wideValue(makeDelivery({ batsmanRuns: 4 }))).toBe(0);
  });

  it('oversString uses ballsPerOver, never literal 6', () => {
    expect(oversString(7, 6)).toBe('1.1');
    expect(oversString(12, 6)).toBe('2');
    expect(oversString(9, 8)).toBe('1.1'); // tennis 8-ball over
    expect(oversString(8, 8)).toBe('1');
  });
});

describe('legal-ball counter & over advance', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('wide & no-ball do NOT advance the over (re-bowl); bye/leg-bye DO', () => {
    let inn = createInnings();
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'wide', runs: 1 }] }), fmt);
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    expect(deriveInnings(inn, fmt).legalBalls).toBe(0);
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'bye', runs: 1 }] }), fmt);
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'leg-bye', runs: 1 }] }), fmt);
    expect(deriveInnings(inn, fmt).legalBalls).toBe(2);
  });

  it('over completes after ballsPerOver legal balls (8 for tennis)', () => {
    const tennis = makeFormat({ ballsPerOver: 8, oversPerInnings: 5 });
    let inn = createInnings();
    for (let i = 0; i < 8; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 2 }), tennis);
    expect(deriveInnings(inn, tennis).overs).toBe('1');
  });
});

describe('extras credited to TEAM never batter/bowler', () => {
  const fmt = makeFormat();

  it('bye: +team, batsmanRuns 0, striker B increments (legal ball faced)', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'bye', runs: 2 }] }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.runs).toBe(2);
    expect(d.extrasBreakdown.b).toBe(2);
    expect(d.batters['s'].R).toBe(0);
    expect(d.batters['s'].B).toBe(1); // faced a legal ball
    expect(d.bowlers['b1'].R).toBe(0); // byes not charged to bowler
  });

  it('leg-bye: +team lb, batsmanRuns 0, striker B increments', () => {
    let inn = createInnings({ striker: 's' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'leg-bye', runs: 1 }] }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.extrasBreakdown.lb).toBe(1);
    expect(d.batters['s'].B).toBe(1);
    expect(d.bowlers['b1'].R).toBe(0);
  });

  it('wide: +team, striker B UNCHANGED, no legal ball, charged to bowler', () => {
    let inn = createInnings({ striker: 's' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'wide', runs: 1 }] }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.extrasBreakdown.wd).toBe(1);
    expect(d.batters['s'].B).toBe(0);
    expect(d.legalBalls).toBe(0);
    expect(d.bowlers['b1'].R).toBe(1);
    expect(d.bowlers['b1'].wd).toBe(1);
  });

  it('no-ball: penalty to team, bat runs credit striker, B unchanged', () => {
    let inn = createInnings({ striker: 's' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 4, extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.runs).toBe(5); // 4 off bat + 1 penalty
    expect(d.extrasBreakdown.nb).toBe(1);
    expect(d.batters['s'].R).toBe(4);
    expect(d.batters['s'].B).toBe(0); // no legal ball faced
    expect(d.bowlers['b1'].R).toBe(5); // bat + nb charged to bowler
    expect(d.bowlers['b1'].nb).toBe(1);
  });

  it('multi-component: no-ball + 2 leg-byes compounds correctly', () => {
    let inn = createInnings({ striker: 's' });
    inn = applyDelivery(inn, makeDelivery({
      extras: [{ type: 'no-ball', runs: 1 }, { type: 'leg-bye', runs: 2 }],
    }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.runs).toBe(3);
    expect(d.extrasBreakdown.nb).toBe(1);
    expect(d.extrasBreakdown.lb).toBe(2);
    expect(d.legalBalls).toBe(0); // illegal (no-ball present)
    expect(d.batters['s'].B).toBe(0);
    expect(d.bowlers['b1'].R).toBe(1); // only nb penalty charged, leg-byes excluded
  });
});

describe('strike rotation', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('odd completed runs swap; even keep', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt);
    expect(inn.striker).toBe('ns');
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 2 }), fmt);
    expect(inn.striker).toBe('ns'); // even keeps
  });

  it('end of a legal over swaps strike', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    // 6 dot balls -> over complete -> swap
    for (let i = 0; i < 6; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    expect(inn.striker).toBe('ns');
  });

  it('last-ball odd run double-swap composes EXACTLY once (same batter keeps strike)', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    for (let i = 0; i < 5; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    // 6th ball, single: odd-swap then over-swap => original striker keeps strike
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt);
    expect(inn.striker).toBe('s');
    expect(inn.nonStriker).toBe('ns');
  });

  it('wide strike math: physical = total wide − penalty; wide never triggers over swap', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    // 2wd => 1 physical run => swap
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'wide', runs: 2 }] }), fmt);
    expect(inn.striker).toBe('ns');
    // 3wd => 2 physical => no swap
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'wide', runs: 3 }] }), fmt);
    expect(inn.striker).toBe('ns');
  });

  it('wide as last legal-slot does NOT cause an over-boundary swap', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    for (let i = 0; i < 5; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    // a wide here (illegal) must not complete the over
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'wide', runs: 1 }] }), fmt);
    expect(inn.striker).toBe('s'); // still on strike, over not complete
    expect(deriveInnings(inn, fmt).legalBalls).toBe(5);
  });

  it('explicit manualSwap overrides', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0, manualSwap: true }), fmt);
    expect(inn.striker).toBe('ns');
  });
});

describe('overthrow', () => {
  const fmt = makeFormat();

  it('overthrow to boundary is NOT a batter four; runs still credited', () => {
    let inn = createInnings({ striker: 's' });
    inn = applyDelivery(inn, makeDelivery({
      overthrow: { batRuns: 1, overthrowRuns: 4, reachedBoundary: true, offBatOrExtra: 'bat' },
    }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.batters['s'].R).toBe(5); // 1 run + 4 overthrow credited
    expect(d.batters['s']['4s']).toBe(0); // NOT a four
    expect(d.runs).toBe(5);
  });

  it('overthrow strike parity uses batRuns when boundary reached', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    // batRuns 1 (odd) + boundary overthrow => parity from batRuns => swap
    inn = applyDelivery(inn, makeDelivery({
      overthrow: { batRuns: 1, overthrowRuns: 4, reachedBoundary: true, offBatOrExtra: 'bat' },
    }), fmt);
    expect(inn.striker).toBe('ns');
  });

  it('overthrow off extra credits team not batter', () => {
    let inn = createInnings({ striker: 's' });
    inn = applyDelivery(inn, makeDelivery({
      overthrow: { batRuns: 0, overthrowRuns: 4, reachedBoundary: true, offBatOrExtra: 'extra' },
    }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.batters['s'].R).toBe(0);
    expect(d.extrasBreakdown.b).toBe(4);
    expect(d.runs).toBe(4);
  });
});

describe('wickets — end derivation', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('bowled: incoming batter takes strike, bowler credited', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({
      wicket: { type: 'bowled', out: 's', completedRuns: 0, incoming: 'new' },
    }), fmt);
    expect(inn.striker).toBe('new');
    expect(inn.nonStriker).toBe('ns');
    const d = deriveInnings(inn, fmt);
    expect(d.wkts).toBe(1);
    expect(d.bowlers['b1'].W).toBe(1);
  });

  it('caught crossed=true puts incoming batter at NON-striker end', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({
      wicket: { type: 'caught', out: 's', crossed: true, completedRuns: 0, incoming: 'new' },
    }), fmt);
    expect(inn.striker).toBe('ns');   // survivor on strike
    expect(inn.nonStriker).toBe('new');
  });

  it('caught crossed=false puts incoming batter ON strike', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({
      wicket: { type: 'caught', out: 's', crossed: false, completedRuns: 0, incoming: 'new' },
    }), fmt);
    expect(inn.striker).toBe('new');
    expect(inn.nonStriker).toBe('ns');
  });

  it('run-out: completedRuns derives new-batter end (odd completed)', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    // 1 completed run (odd) then striker run out at their new end
    inn = applyDelivery(inn, makeDelivery({
      batsmanRuns: 1,
      wicket: { type: 'run-out', out: 's', end: 'non-striker', completedRuns: 1, incoming: 'new' },
    }), fmt);
    // After 1 run s->nonStriker end, ns->striker end. s (out) at nonStriker end -> incoming there.
    expect(inn.striker).toBe('ns');
    expect(inn.nonStriker).toBe('new');
    const d = deriveInnings(inn, fmt);
    expect(d.bowlers['b1'].W).toBe(0); // run-out: no bowler credit
    expect(d.batters['s'].R).toBe(1); // completed run credited
  });

  it('run-out of non-striker, 0 completed: striker keeps strike, incoming at non-striker end', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({
      wicket: { type: 'run-out', out: 'ns', end: 'non-striker', completedRuns: 0, incoming: 'new' },
    }), fmt);
    expect(inn.striker).toBe('s');
    expect(inn.nonStriker).toBe('new');
  });

  it('wicket on last ball of over also applies end-of-over swap', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    for (let i = 0; i < 5; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    // 6th ball: bowled, incoming to strike, then over swap => incoming to non-striker
    inn = applyDelivery(inn, makeDelivery({
      wicket: { type: 'bowled', out: 's', completedRuns: 0, incoming: 'new' },
    }), fmt);
    expect(inn.striker).toBe('ns');
    expect(inn.nonStriker).toBe('new');
  });
});

describe('free hit', () => {
  const fmt = makeFormat({ oversPerInnings: 5, freeHitOnNoBall: true });

  it('a no-ball arms a free hit for the next ball', () => {
    let inn = createInnings();
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    expect(inn.freeHit).toBe(true);
  });

  it('free hit rejects a bowled dismissal (throws / reverts)', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    expect(inn.freeHit).toBe(true);
    expect(() => applyDelivery(inn, makeDelivery({
      wicket: { type: 'bowled', out: 's', completedRuns: 0, incoming: 'new' },
    }), fmt)).toThrow(/free hit/i);
  });

  it('free hit ALLOWS a run-out dismissal', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    expect(() => applyDelivery(inn, makeDelivery({
      wicket: { type: 'run-out', out: 's', end: 'striker', completedRuns: 0, incoming: 'new' },
    }), fmt)).not.toThrow();
  });

  it('a legal ball consumes the free hit; a wide keeps it armed', () => {
    let inn = createInnings();
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    let inn2 = applyDelivery(inn, makeDelivery({ extras: [{ type: 'wide', runs: 1 }] }), fmt);
    expect(inn2.freeHit).toBe(true); // wide during free hit keeps it
    let inn3 = applyDelivery(inn2, makeDelivery({ batsmanRuns: 1 }), fmt);
    expect(inn3.freeHit).toBe(false); // legal ball consumes
  });
});

describe('house rules', () => {
  it('noLBW removes lbw as a valid wicket type (throws)', () => {
    const fmt = makeFormat({ houseRules: { noLBW: true } });
    let inn = createInnings({ striker: 's' });
    expect(() => applyDelivery(inn, makeDelivery({
      wicket: { type: 'lbw', out: 's', completedRuns: 0, incoming: 'new' },
    }), fmt)).toThrow(/lbw/i);
  });

  it('consecutiveOverAllowed toggles the same-bowler-twice guard', () => {
    const strict = makeFormat({ oversPerInnings: 5 });
    let inn = createInnings({ bowler: 'b1' });
    for (let i = 0; i < 6; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), strict);
    expect(canBowl(inn, 'b1', strict)).toBe(false); // just bowled last over
    expect(canBowl(inn, 'b2', strict)).toBe(true);
    const loose = makeFormat({ oversPerInnings: 5, houseRules: { consecutiveOverAllowed: true } });
    expect(canBowl(inn, 'b1', loose)).toBe(true);
  });

  it('maxOversPerBowler caps a bowler', () => {
    const fmt = makeFormat({ oversPerInnings: 20, maxOversPerBowler: 1, houseRules: { consecutiveOverAllowed: true } });
    let inn = createInnings({ bowler: 'b1' });
    for (let i = 0; i < 6; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    expect(canBowl(inn, 'b1', fmt)).toBe(false); // already bowled max (1) over
  });

  it('last-man-stands: lone batter (nonStriker null) SUPPRESSES rotation & over swap', () => {
    const fmt = makeFormat({ oversPerInnings: 5, houseRules: { lastManStands: true } });
    let inn = createInnings({ striker: 's', nonStriker: null });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt); // odd would swap normally
    expect(inn.striker).toBe('s');
    expect(inn.nonStriker).toBe(null);
    for (let i = 0; i < 5; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt);
    expect(inn.striker).toBe('s'); // no over-end swap either
  });

  it('singleBatterRuns: lone runs are legal with no rotation', () => {
    const fmt = makeFormat({ oversPerInnings: 5, houseRules: { singleBatterRuns: true } });
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt);
    expect(inn.striker).toBe('s'); // no rotation under singleBatterRuns
    expect(deriveInnings(inn, fmt).runs).toBe(1);
  });
});

describe('undo', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('pops last delivery and restores snapshot pointers + freeHit', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    expect(inn.freeHit).toBe(true);
    const before = inn;
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt); // swaps + consumes free hit
    expect(inn.striker).toBe('ns');
    expect(inn.freeHit).toBe(false);
    const undone = undo(inn);
    expect(undone.deliveries.length).toBe(before.deliveries.length);
    expect(undone.striker).toBe('s');       // restored snapshot
    expect(undone.nonStriker).toBe('ns');
    expect(undone.freeHit).toBe(true);       // restored free-hit state
  });

  it('undo on empty innings is a no-op', () => {
    const inn = createInnings();
    expect(undo(inn).deliveries.length).toBe(0);
  });
});

describe('immutability', () => {
  const fmt = makeFormat();
  it('applyDelivery never mutates the input innings', () => {
    const inn = createInnings({ striker: 's', nonStriker: 'ns' });
    const snapshot = JSON.stringify(inn);
    applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt);
    expect(JSON.stringify(inn)).toBe(snapshot);
    expect(inn.deliveries.length).toBe(0);
  });
});

describe('deriveInnings — folded scorecard', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('folds runs/wkts/boundaries/extras from deliveries only', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = play(inn, fmt, [
      { batsmanRuns: 4 },
      { batsmanRuns: 6 },
      { batsmanRuns: 1 },
      { extras: [{ type: 'wide', runs: 1 }] },
      { extras: [{ type: 'bye', runs: 2 }] },
    ]);
    const d = deriveInnings(inn, fmt);
    expect(d.runs).toBe(14); // 4+6+1+1+2
    expect(d.legalBalls).toBe(4);
    expect(d.extrasBreakdown).toEqual({ b: 2, lb: 0, wd: 1, nb: 0, pen: 0 });
    // 's' faced balls 1,2,3 then after single 'ns' on strike faced the bye ball
    expect(d.batters['s']['4s']).toBe(1);
    expect(d.batters['s']['6s']).toBe(1);
    expect(d.batters['s'].R).toBe(11);
  });

  it('records fall of wickets and partnerships', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = play(inn, fmt, [
      { batsmanRuns: 2 },
      { batsmanRuns: 4 },
      { wicket: { type: 'bowled', out: 's', completedRuns: 0, incoming: 'new' } },
    ]);
    const d = deriveInnings(inn, fmt);
    expect(d.fow.length).toBe(1);
    expect(d.fow[0].wkts).toBe(1);
    expect(d.fow[0].runs).toBe(6);
    expect(d.partnerships[0].runs).toBe(6);
  });

  it('computes maiden over (no runs charged to bowler)', () => {
    let inn = createInnings();
    for (let i = 0; i < 6; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.bowlers['b1'].M).toBe(1);
    expect(d.bowlers['b1'].O).toBe('1');
    expect(d.bowlers['b1'].Econ).toBe(0);
  });

  it('byes do NOT break a maiden but a wide does', () => {
    // 6 legal balls, one is a 4-bye: bowler charged 0 => maiden
    let inn = createInnings();
    for (let i = 0; i < 5; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'bye', runs: 4 }] }), fmt);
    expect(deriveInnings(inn, fmt).bowlers['b1'].M).toBe(1);
  });
});

describe('deriveChase — sole rate producer', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('computes runsNeeded, ballsLeft, RRR, CRR, projection', () => {
    let inn = createInnings({ target: 50 });
    // 6 legal balls, 10 runs
    inn = play(inn, fmt, [
      { batsmanRuns: 4 }, { batsmanRuns: 2 }, { batsmanRuns: 0 },
      { batsmanRuns: 4 }, { batsmanRuns: 0 }, { batsmanRuns: 0 },
    ]);
    const c = deriveChase(inn, fmt);
    expect(c.runsNeeded).toBe(40);        // 50 - 10
    expect(c.ballsLeft).toBe(24);         // 30 - 6
    expect(c.CRR).toBe(10);               // 10 runs in 1 over
    expect(c.RRR).toBe(10);               // 40 in 4 overs
    expect(c.projection).toBe(50);        // 10 * 5
  });

  it('winProb is provisional heuristic in [0,1] with documented basis', () => {
    let inn = createInnings({ target: 50 });
    const c = deriveChase(inn, fmt);
    expect(c.winProb.value).toBeGreaterThanOrEqual(0);
    expect(c.winProb.value).toBeLessThanOrEqual(1);
    expect(c.winProb.basis).toBe('RRR-gap heuristic v0');
  });

  it('target reached => winProb 1', () => {
    let inn = createInnings({ target: 5 });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 6 }), fmt);
    const c = deriveChase(inn, fmt);
    expect(c.runsNeeded).toBe(0);
    expect(c.winProb.value).toBe(1);
  });
});
