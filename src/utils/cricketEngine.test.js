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
  applyRetire,
  retiredBatters,
  changeBowler,
  changeStrike,
  editDelivery,
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

describe('changeStrike', () => {
  it('swaps striker/nonStriker without appending a delivery', () => {
    const inn = createInnings({ striker: 's', nonStriker: 'ns' });
    const sw = changeStrike(inn);
    expect(sw.striker).toBe('ns');
    expect(sw.nonStriker).toBe('s');
    expect(sw.deliveries.length).toBe(0);
  });
  it('is a no-op when there is no non-striker (last man)', () => {
    const inn = { ...createInnings({ striker: 's' }), nonStriker: null };
    expect(changeStrike(inn).striker).toBe('s');
  });
});

describe('penalty runs', () => {
  const fmt = makeFormat({});
  it('non-counting: team +runs, no legal ball, no B faced, no strike swap, bowler not charged', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns', bowler: 'b1' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'penalty', runs: 5 }] }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.runs).toBe(5);
    expect(d.extrasBreakdown.pen).toBe(5);
    expect(d.legalBalls).toBe(0);
    expect(d.batters['s'].B).toBe(0);
    expect(inn.striker).toBe('s');
    expect(d.bowlers['b1'].R).toBe(0);
  });
});

describe('CodeRabbit #129 correctness fixes', () => {
  const fmt = makeFormat({ ballsPerOver: 6 });

  it('#1 wicket with null incoming (last man) collapses survivor to lone striker (nonStriker null)', () => {
    const f = makeFormat({ houseRules: { lastManStands: true } });
    let inn = createInnings({ striker: 's', nonStriker: 'ns', bowler: 'b1' });
    inn = applyDelivery(inn, makeDelivery({ wicket: { type: 'bowled', out: 's', bowler: 'b1', incoming: null } }), f);
    expect(inn.striker).toBe('ns');
    expect(inn.nonStriker).toBe(null);
  });

  it('#2 a batter dismissed for 0 without facing still appears on the card as out', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns', bowler: 'b1' });
    inn = applyDelivery(inn, makeDelivery({ wicket: { type: 'run-out', out: 'ns', end: 'non-striker', completedRuns: 0, incoming: 'x' } }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.batters['ns']).toBeDefined();
    expect(d.batters['ns'].out).toBe(true);
    expect(d.batters['ns'].R).toBe(0);
  });

  it('#3 a mid-over bowler-change over is NOT credited as a maiden', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns', bowler: 'b1' });
    for (let i = 0; i < 3; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    inn = changeBowler(inn, 'b2');
    for (let i = 0; i < 3; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.bowlers['b1'].M).toBe(0);
    expect(d.bowlers['b2'].M).toBe(0);
  });

  it('#3 a single-bowler maiden over IS still credited (no regression)', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns', bowler: 'b1' });
    for (let i = 0; i < 6; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    expect(deriveInnings(inn, fmt).bowlers['b1'].M).toBe(1);
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

// ==========================================
// C1b — behavioral actions
// ==========================================

describe('dead ball', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('not counted: legalBalls unchanged, over not advanced, no runs, striker unchanged', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt); // swap -> ns
    expect(inn.striker).toBe('ns');
    inn = applyDelivery(inn, makeDelivery({ deadBall: true, batsmanRuns: 3 }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.legalBalls).toBe(1);          // dead ball not a legal ball
    expect(d.runs).toBe(1);                // no run credited from the dead ball
    expect(inn.striker).toBe('ns');        // striker unchanged
    expect(d.bowlers['b1'].balls).toBeUndefined(); // no ball credited (O only in output)
    expect(d.bowlers['b1'].O).toBe('0.1'); // only the 1 legal ball
  });

  it('dead ball does NOT consume an armed free hit', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ extras: [{ type: 'no-ball', runs: 1 }] }), fmt);
    expect(inn.freeHit).toBe(true);
    inn = applyDelivery(inn, makeDelivery({ deadBall: true }), fmt);
    expect(inn.freeHit).toBe(true); // still armed
  });
});

describe('mankad', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('wkts+1, over not advanced, no bowler credit, non-striker is out, striker unchanged', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({
      wicket: { type: 'mankad', out: 'ns', incoming: 'new' },
    }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.wkts).toBe(1);
    expect(d.legalBalls).toBe(0);          // over does NOT advance (legal=false)
    expect(d.bowlers['b1'].W).toBe(0);     // no bowler wicket credit
    expect(d.fow[0].batter).toBe('ns');    // non-striker is out
    expect(inn.striker).toBe('s');         // striker unchanged
    expect(inn.nonStriker).toBe('new');    // incoming replaces non-striker
    expect(isLegalDelivery(inn.deliveries[0])).toBe(false);
  });
});

describe('short run', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('3 completed - short = 2 counted; parity uses 2 (even, no swap) not 3', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 3, shortRun: true }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.runs).toBe(2);                 // 3 - 1 short
    expect(d.batters['s'].R).toBe(2);       // batter credited corrected runs
    expect(d.bowlers['b1'].R).toBe(2);      // bowler conceded corrected runs
    expect(inn.striker).toBe('s');          // parity on 2 (even) => no swap
  });

  it('control: same 3 runs WITHOUT short swaps strike (parity on 3)', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 3 }), fmt);
    expect(inn.striker).toBe('ns');
  });
});

describe('retire — three modes + resume', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('retire hurt: no wkt, batter replaced and resumable', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyRetire(inn, { batter: 's', mode: 'hurt', incoming: 'x' }, fmt);
    expect(deriveInnings(inn, fmt).wkts).toBe(0);   // NO wicket
    expect(inn.striker).toBe('x');                  // incoming took the end
    expect(retiredBatters(inn)).toEqual([{ batter: 's', mode: 'hurt' }]);
  });

  it('retire out: wkt+1, dismissal recorded, no bowler credit', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyRetire(inn, { batter: 's', mode: 'out', incoming: 'new' }, fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.wkts).toBe(1);
    expect(d.fow[0].batter).toBe('s');
    expect(inn.striker).toBe('new');
    expect(retiredBatters(inn)).toEqual([]);        // 'out' is not resumable
  });

  it('retire rotate: no wkt; batter re-enters later at end of order', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = applyRetire(inn, { batter: 's', mode: 'rotate', incoming: 'x' }, fmt);
    expect(deriveInnings(inn, fmt).wkts).toBe(0);
    expect(retiredBatters(inn).map(r => r.batter)).toContain('s');
    // later a wicket falls and the rotated batter comes back in as incoming
    inn = applyDelivery(inn, makeDelivery({
      wicket: { type: 'bowled', out: 'x', completedRuns: 0, incoming: 's' },
    }), fmt);
    expect(inn.striker).toBe('s');                  // resumed
    expect(retiredBatters(inn)).toEqual([]);        // back on field => no longer resumable
  });
});

describe('mid-over bowler change', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('over credit splits across two bowlers; neither charged a full over', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns', bowler: 'b1' });
    for (let i = 0; i < 3; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    inn = changeBowler(inn, 'b2');
    for (let i = 0; i < 3; i++) inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 0 }), fmt);
    const d = deriveInnings(inn, fmt);
    expect(d.legalBalls).toBe(6);           // full over of balls
    expect(d.bowlers['b1'].O).toBe('0.3');  // partial, NOT '1'
    expect(d.bowlers['b2'].O).toBe('0.3');  // partial, NOT '1'
    expect(d.overs).toBe('1');              // one full over across the two
  });
});

describe('edit-past = replay-forward', () => {
  const fmt = makeFormat({ oversPerInnings: 5 });

  it('editing an early single to a dot re-derives strike downstream + diff run delta', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns' });
    inn = play(inn, fmt, [
      { batsmanRuns: 1 }, // ball0: single -> swap to ns
      { batsmanRuns: 0 }, // ball1: dot     -> ns stays
      { batsmanRuns: 1 }, // ball2: single -> swap back to s
    ]);
    expect(inn.striker).toBe('s');
    expect(inn.deliveries[2].striker).toBe('ns'); // ns faced ball2 originally

    const res = editDelivery(inn, 0, { batsmanRuns: 0 }, fmt);
    // downstream strike re-derived from scratch
    expect(res.deliveries[2].striker).toBe('s');  // now s faces ball2 (flipped)
    expect(res.striker).toBe('ns');               // final striker flipped
    // diff summary reflects the run delta (2 singles -> 1 single)
    expect(res.diff.before.runs).toBe(2);
    expect(res.diff.after.runs).toBe(1);
    expect(res.diff.before.striker).toBe('s');
    expect(res.diff.after.striker).toBe('ns');
    // original innings untouched (pure)
    expect(inn.deliveries[2].striker).toBe('ns');
  });

  it('editing preserves a downstream mid-over bowler change', () => {
    let inn = createInnings({ striker: 's', nonStriker: 'ns', bowler: 'b1' });
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 2 }), fmt);
    inn = changeBowler(inn, 'b2');
    inn = applyDelivery(inn, makeDelivery({ batsmanRuns: 1 }), fmt);
    const res = editDelivery(inn, 0, { batsmanRuns: 4 }, fmt);
    expect(res.deliveries[1].bowler).toBe('b2');  // downstream bowler preserved
    expect(res.diff.after.runs).toBe(5);          // 4 + 1
  });
});
