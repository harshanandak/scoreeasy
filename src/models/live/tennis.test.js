import { describe, expect, it } from 'vitest';
import { appendPoint, appendUndo } from './scoringEvents';
import { pointLabel, tennisState, TENNIS_PRESETS } from './tennis';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Append a single won point for `team` (a tennis "point" = one appendPoint). */
function point(events, team) {
  return appendPoint(events, { team, at: events.length + 1 });
}

/** Append `n` consecutive points for `team`. */
function points(events, team, n) {
  let next = events;
  for (let i = 0; i < n; i += 1) next = point(next, team);
  return next;
}

/** Append a stored serve_change event (engine state, not a scoring row). */
function serveChange(events, team, at) {
  const seq = events.length === 0 ? 1 : Number(events[events.length - 1].seq ?? 0) + 1;
  return [...events, { seq, type: 'serve_change', team, servingAfter: team, at: at ?? seq }];
}

/**
 * Win one whole game to LOVE for `team` by scoring 4 straight points. Only safe
 * when the current game is at 0-0 (used to fast-forward whole games of a set).
 */
function gameToLove(events, team) {
  return points(events, team, 4);
}

/** Play `n` love-games for `team`, chaining the returned events. */
function gamesToLove(events, team, n) {
  let next = events;
  for (let i = 0; i < n; i += 1) next = gameToLove(next, team);
  return next;
}

/**
 * Build ONE set ending at (a, b) games by INTERLEAVING love-games (mirrors
 * volleyball's point-level interleave at the game level). Strictly alternates
 * A,B love-games up to min(a,b) — so neither side crosses 6 early — then the
 * leader takes the remaining |a-b| games. Required for 6-4 / 6-5 / 6-6 sets,
 * where a naive whole-team block would end the set 6-0 before the trailer plays.
 */
function setTo(events, a, b) {
  let next = events;
  const shared = Math.min(a, b);
  for (let i = 0; i < shared; i += 1) {
    next = gameToLove(next, 'A');
    next = gameToLove(next, 'B');
  }
  const leader = a >= b ? 'A' : 'B';
  for (let i = 0; i < Math.abs(a - b); i += 1) next = gameToLove(next, leader);
  return next;
}

const STANDARD = TENNIS_PRESETS.standard; // ATP/WTA: setsToWin 2, TB to 7

// ─── pointLabel ladder ───────────────────────────────────────────────────────

describe('pointLabel — 15/30/40 ladder', () => {
  it('maps raw integers 0,1,2,3 to 0,15,30,40', () => {
    expect(pointLabel(0, 0, {})).toBe('0');
    expect(pointLabel(1, 0, {})).toBe('15');
    expect(pointLabel(2, 0, {})).toBe('30');
    expect(pointLabel(3, 0, {})).toBe('40');
  });

  it('renders deuce (3-3) as 40 for both sides', () => {
    expect(pointLabel(3, 3, {})).toBe('40');
    expect(pointLabel(4, 4, {})).toBe('40');
  });

  it('renders the player one point ahead past deuce as AD', () => {
    expect(pointLabel(4, 3, {})).toBe('AD');
    expect(pointLabel(3, 4, {})).toBe('40'); // the trailing side stays 40
    expect(pointLabel(5, 4, {})).toBe('AD');
  });

  it('renders raw integers when inTiebreak', () => {
    expect(pointLabel(0, 0, { inTiebreak: true })).toBe('0');
    expect(pointLabel(5, 6, { inTiebreak: true })).toBe('5');
    expect(pointLabel(7, 5, { inTiebreak: true })).toBe('7');
  });
});

// ─── Empty / fresh stream ────────────────────────────────────────────────────

describe('tennisState — empty stream', () => {
  it('returns a zeroed, in-progress state for no events', () => {
    expect(tennisState([], STANDARD)).toMatchObject({
      players: ['A', 'B'],
      sets: [],
      currentSet: { gamesA: 0, gamesB: 0 },
      currentGame: { ptsA: 0, ptsB: 0, labelA: '0', labelB: '0', inTiebreak: false },
      setsWonA: 0,
      setsWonB: 0,
      isMatchOver: false,
      winner: null,
      statusToken: 'normal',
      isBreakPoint: false,
      isSetPoint: false,
      isMatchPoint: false,
    });
  });

  it('defaults server to A when no serve_change and no initialServer', () => {
    expect(tennisState([], STANDARD).server).toBe('A');
  });

  it('uses config.initialServer when provided', () => {
    expect(tennisState([], { ...STANDARD, initialServer: 'B' }).server).toBe('B');
  });
});

// ─── Game: 15/30/40 and labels ───────────────────────────────────────────────

describe('tennisState — current game labels', () => {
  it('tracks raw points and derives labels mid-game', () => {
    let e = [];
    e = point(e, 'A'); // 15-0
    e = point(e, 'B'); // 15-15
    e = point(e, 'A'); // 30-15
    const s = tennisState(e, STANDARD);
    expect(s.currentGame).toMatchObject({ ptsA: 2, ptsB: 1, labelA: '30', labelB: '15' });
  });
});

// ─── Deuce → AD → game ───────────────────────────────────────────────────────

describe('tennisState — deuce / advantage', () => {
  it('reports deuce statusToken at 3-3', () => {
    let e = points([], 'A', 3);
    e = points(e, 'B', 3); // 40-40
    const s = tennisState(e, STANDARD);
    expect(s.currentGame).toMatchObject({ ptsA: 3, ptsB: 3, labelA: '40', labelB: '40' });
    expect(s.statusToken).toBe('deuce');
  });

  it('reports adIn when the server holds advantage', () => {
    // Server A (default). A leads 4-3 past deuce.
    let e = points([], 'A', 3);
    e = points(e, 'B', 3); // deuce
    e = point(e, 'A'); // AD server
    const s = tennisState(e, STANDARD);
    expect(s.statusToken).toBe('adIn');
    expect(s.currentGame.labelA).toBe('AD');
  });

  it('reports adOut when the receiver holds advantage', () => {
    let e = points([], 'A', 3);
    e = points(e, 'B', 3); // deuce
    e = point(e, 'B'); // AD receiver (B receives, A serves)
    const s = tennisState(e, STANDARD);
    expect(s.statusToken).toBe('adOut');
    expect(s.currentGame.labelB).toBe('AD');
  });

  it('completes the game only after a 2-point lead past deuce', () => {
    let e = points([], 'A', 3);
    e = points(e, 'B', 3); // deuce
    e = point(e, 'A'); // AD
    e = point(e, 'A'); // game A
    const s = tennisState(e, STANDARD);
    expect(s.currentSet).toMatchObject({ gamesA: 1, gamesB: 0 });
    expect(s.currentGame).toMatchObject({ ptsA: 0, ptsB: 0 }); // game reset
  });
});

// ─── No-ad deciding point ────────────────────────────────────────────────────

describe('tennisState — no-ad deciding point', () => {
  const NOAD = { ...STANDARD, noAd: true };

  it('wins the game on the very next point at 3-3 (no advantage)', () => {
    let e = points([], 'A', 3);
    e = points(e, 'B', 3); // 40-40 deciding point
    const before = tennisState(e, NOAD);
    expect(before.currentGame).toMatchObject({ ptsA: 3, ptsB: 3 });

    e = point(e, 'A'); // deciding point won by A -> game
    const s = tennisState(e, NOAD);
    expect(s.currentSet).toMatchObject({ gamesA: 1, gamesB: 0 });
    expect(s.currentGame).toMatchObject({ ptsA: 0, ptsB: 0 });
  });
});

// ─── A 6-4 set ───────────────────────────────────────────────────────────────

describe('tennisState — 6-4 set', () => {
  it('completes a set at 6 games with a 2-game lead', () => {
    // Interleave whole love-games so the set runs to 6-4 (a naive A-block would
    // close the set 6-0 before B plays). setTo alternates A,B up to min(a,b).
    const e = setTo([], 6, 4);
    const s = tennisState(e, STANDARD);
    expect(s.setsWonA).toBe(1);
    expect(s.setsWonB).toBe(0);
    expect(s.sets).toEqual([{ a: 6, b: 4 }]);
    expect(s.currentSet).toMatchObject({ gamesA: 0, gamesB: 0 }); // new set started
  });

  it('does NOT end the set at 6-5 (needs win by 2)', () => {
    const e = setTo([], 6, 5); // interleaved: 5-5 then A takes the 6th (6-5, open)
    const s = tennisState(e, STANDARD);
    expect(s.setsWonA).toBe(0);
    expect(s.currentSet).toMatchObject({ gamesA: 6, gamesB: 5 });
  });

  it('ends 7-5 when a team pulls ahead by 2 from 6-5', () => {
    let e = setTo([], 5, 5); // 5-5, both sides still in the set
    e = gamesToLove(e, 'A', 2); // A takes the next two games -> 7-5
    const s = tennisState(e, STANDARD);
    expect(s.sets).toEqual([{ a: 7, b: 5 }]);
    expect(s.setsWonA).toBe(1);
  });
});

// ─── 7-6(5) tiebreak set + serve rotation ────────────────────────────────────

describe('tennisState — tiebreak at 6-6', () => {
  it('enters a tiebreak at 6 games all', () => {
    const e = setTo([], 6, 6); // interleaved to 6-6 -> tiebreak
    const s = tennisState(e, STANDARD);
    expect(s.currentGame.inTiebreak).toBe(true);
    expect(s.currentSet).toMatchObject({ gamesA: 6, gamesB: 6 });
  });

  it('renders tiebreak points as raw integers', () => {
    let e = setTo([], 6, 6);
    e = points(e, 'A', 3);
    e = points(e, 'B', 2);
    const s = tennisState(e, STANDARD);
    expect(s.currentGame).toMatchObject({ ptsA: 3, ptsB: 2, labelA: '3', labelB: '2', inTiebreak: true });
    expect(s.statusToken).toBe('normal');
  });

  it('completes a 7-6(5) set with the tiebreak score recorded', () => {
    let e = setTo([], 6, 6); // 6-6
    // Tiebreak A wins 7-5.
    e = points(e, 'A', 5);
    e = points(e, 'B', 5); // 5-5
    e = points(e, 'A', 2); // 7-5
    const s = tennisState(e, STANDARD);
    expect(s.setsWonA).toBe(1);
    expect(s.sets).toEqual([{ a: 7, b: 6, tbA: 7, tbB: 5 }]);
  });

  it('requires win-by-2 in the tiebreak (6-6 keeps playing)', () => {
    let e = setTo([], 6, 6);
    e = points(e, 'A', 6);
    e = points(e, 'B', 6); // 6-6 in TB
    const s = tennisState(e, STANDARD);
    expect(s.setsWonA).toBe(0);
    expect(s.currentGame).toMatchObject({ ptsA: 6, ptsB: 6, inTiebreak: true });
  });

  it('rotates serve 1 then every 2 points inside the tiebreak', () => {
    // Set started by A (default). Cross-set alternation counts the TB as one game.
    // 12 games played (6-6), so game #13 (the TB) is served first by A.
    // TB serve order must be: A, B,B, A,A, B,B, ...
    const base = setTo([], 6, 6); // interleaved to 6-6, entering TB

    const serverAt = (aPts, bPts) => {
      let e = base;
      e = points(e, 'A', aPts);
      e = points(e, 'B', bPts);
      return tennisState(e, STANDARD).server;
    };
    // points-played = aPts+bPts BEFORE the next point is served.
    expect(serverAt(0, 0)).toBe('A'); // point 1 -> A serves
    expect(serverAt(1, 0)).toBe('B'); // point 2 -> B serves
    expect(serverAt(1, 1)).toBe('B'); // point 3 -> B serves
    expect(serverAt(2, 1)).toBe('A'); // point 4 -> A serves
    expect(serverAt(2, 2)).toBe('A'); // point 5 -> A serves
    expect(serverAt(3, 2)).toBe('B'); // point 6 -> B serves
  });
});

// ─── Serve alternation between games ─────────────────────────────────────────

describe('tennisState — serve alternation between games', () => {
  it('alternates server each game from the initial server', () => {
    expect(tennisState([], STANDARD).server).toBe('A'); // game 1 -> A
    let e = gameToLove([], 'A'); // game 1 done
    expect(tennisState(e, STANDARD).server).toBe('B'); // game 2 -> B
    e = gameToLove(e, 'B'); // game 2 done
    expect(tennisState(e, STANDARD).server).toBe('A'); // game 3 -> A
  });

  it('derives initial server from a serve_change event', () => {
    let e = serveChange([], 'B');
    expect(tennisState(e, STANDARD).server).toBe('B'); // game 1 -> B
    e = gameToLove(e, 'A');
    expect(tennisState(e, STANDARD).server).toBe('A'); // game 2 -> A
  });
});

// ─── Pressure flags: break / set / match point ───────────────────────────────

describe('tennisState — break point', () => {
  it('flags a break point when the receiver is one point from the game', () => {
    // Game 1, server A. B reaches 0-40 (receiver one point from breaking).
    let e = points([], 'B', 3);
    const s = tennisState(e, STANDARD);
    expect(s.server).toBe('A');
    expect(s.isBreakPoint).toBe(true);
  });

  it('does NOT flag a break point when the server is the one game point', () => {
    // Server A at 40-0: that is a game point for the server, not a break point.
    let e = points([], 'A', 3);
    const s = tennisState(e, STANDARD);
    expect(s.isBreakPoint).toBe(false);
  });
});

describe('tennisState — set point', () => {
  it('flags a set point when a player is one game from the set', () => {
    // A leads 5-0; A serving game 6 (game index 6 -> A serves on even? compute via state)
    let e = gamesToLove([], 'A', 5); // 5-0
    // In current game A reaches 40-0 -> one point from a 6th game = set point.
    e = points(e, 'A', 3);
    const s = tennisState(e, STANDARD);
    expect(s.isSetPoint).toBe(true);
    expect(s.isMatchPoint).toBe(false); // only 0 sets won, need 1 more set after this
  });
});

describe('tennisState — match point', () => {
  it('flags a match point when winning the game clinches the match', () => {
    // A already won set 1 (6-0). In set 2 A leads 5-0 and reaches 40-0.
    let e = gamesToLove([], 'A', 6); // set 1: 6-0
    e = gamesToLove(e, 'A', 5); // set 2: 5-0
    e = points(e, 'A', 3); // 40-0 in the 6th game
    const s = tennisState(e, STANDARD);
    expect(s.setsWonA).toBe(1);
    expect(s.isSetPoint).toBe(true);
    expect(s.isMatchPoint).toBe(true);
  });
});

// ─── Full match: best-of-3 to a winner ───────────────────────────────────────

describe('tennisState — match completion (best of 3)', () => {
  it('ends the match when a player wins setsToWin sets', () => {
    let e = gamesToLove([], 'A', 6); // set 1: A 6-0
    e = gamesToLove(e, 'A', 6); // set 2: A 6-0 -> match
    const s = tennisState(e, STANDARD);
    expect(s.isMatchOver).toBe(true);
    expect(s.winner).toBe('A');
    expect(s.setsWonA).toBe(2);
    expect(s.sets).toEqual([{ a: 6, b: 0 }, { a: 6, b: 0 }]);
  });

  it('ignores stray points appended after the match is decided', () => {
    let e = gamesToLove([], 'A', 6);
    e = gamesToLove(e, 'A', 6); // match over
    e = points(e, 'B', 10); // stray
    const s = tennisState(e, STANDARD);
    expect(s.isMatchOver).toBe(true);
    expect(s.winner).toBe('A');
    expect(s.setsWonB).toBe(0);
  });

  it('plays a deciding third set when the first two split', () => {
    let e = gamesToLove([], 'A', 6); // set 1: A
    e = gamesToLove(e, 'B', 6); // set 2: B
    const mid = tennisState(e, STANDARD);
    expect(mid.isMatchOver).toBe(false);
    expect(mid.sets.length).toBe(2);

    e = gamesToLove(e, 'A', 6); // set 3: A -> match
    const s = tennisState(e, STANDARD);
    expect(s.isMatchOver).toBe(true);
    expect(s.winner).toBe('A');
  });
});

// ─── Undo reverts a point ────────────────────────────────────────────────────

describe('tennisState — undo', () => {
  it('reverts the most recent point', () => {
    let e = points([], 'A', 2); // 30-0
    e = point(e, 'A'); // 40-0
    e = appendUndo(e, { at: 99 }); // back to 30-0
    const s = tennisState(e, STANDARD);
    expect(s.currentGame).toMatchObject({ ptsA: 2, ptsB: 0, labelA: '30' });
  });

  it('re-opens a game when the clinching point is undone', () => {
    let e = points([], 'A', 4); // game A (1-0)
    expect(tennisState(e, STANDARD).currentSet).toMatchObject({ gamesA: 1 });
    e = appendUndo(e, { at: 99 }); // undo the game-winning point
    const s = tennisState(e, STANDARD);
    expect(s.currentSet).toMatchObject({ gamesA: 0, gamesB: 0 });
    expect(s.currentGame).toMatchObject({ ptsA: 3, ptsB: 0, labelA: '40' });
  });
});

// ─── Format presets ──────────────────────────────────────────────────────────

describe('TENNIS_PRESETS', () => {
  it('exposes the ATP/WTA standard preset', () => {
    expect(TENNIS_PRESETS.standard).toMatchObject({
      setsToWin: 2,
      tiebreakTo: 7,
      decidingTiebreakTo: 7,
      noAd: false,
      finalSetTiebreak: true,
    });
  });

  it("exposes the Men's Grand Slam preset (deciding TB to 10)", () => {
    expect(TENNIS_PRESETS.mensGrandSlam).toMatchObject({
      setsToWin: 3,
      tiebreakTo: 7,
      decidingTiebreakTo: 10,
      noAd: false,
      finalSetTiebreak: true,
    });
  });

  it('exposes the Doubles preset (no-ad + match tiebreak to 10)', () => {
    expect(TENNIS_PRESETS.doubles).toMatchObject({
      setsToWin: 2,
      tiebreakTo: 7,
      noAd: true,
      matchTiebreakTo: 10,
    });
  });
});

// ─── Preset behavior: deciding tiebreak to 10 (Grand Slam) ────────────────────

describe('tennisState — Grand Slam deciding tiebreak to 10', () => {
  const GS = TENNIS_PRESETS.mensGrandSlam; // setsToWin 3, deciding TB to 10

  it('plays the final set as games-to-6 and a 6-6 tiebreak to 10', () => {
    // Split first four sets 2-2, then a deciding 5th set to 6-6 + tiebreak.
    let e = [];
    e = gamesToLove(e, 'A', 6); // set1 A
    e = gamesToLove(e, 'B', 6); // set2 B
    e = gamesToLove(e, 'A', 6); // set3 A
    e = gamesToLove(e, 'B', 6); // set4 B  -> 2-2, set 5 is the decider
    // Interleave the decider's games so it reaches 6-6 (a naive A-block would
    // close the set 6-0 and end the match before the deciding tiebreak).
    e = setTo(e, 6, 6); // 6-6 in the deciding set -> tiebreak

    const mid = tennisState(e, GS);
    expect(mid.currentGame.inTiebreak).toBe(true);
    expect(mid.isMatchOver).toBe(false);

    // A win 9-9 -> must reach 10 by 2; play to 10-8.
    e = points(e, 'A', 8);
    e = points(e, 'B', 8); // 8-8
    let almost = tennisState(e, GS);
    expect(almost.isMatchOver).toBe(false); // 8-8, not yet (needs 10 by 2)

    e = points(e, 'A', 2); // 10-8
    const s = tennisState(e, GS);
    expect(s.isMatchOver).toBe(true);
    expect(s.winner).toBe('A');
    expect(s.sets[4]).toMatchObject({ a: 7, b: 6, tbA: 10, tbB: 8 });
  });
});

// ─── Preset behavior: Doubles match tiebreak to 10 ───────────────────────────

describe('tennisState — Doubles match tiebreak to 10', () => {
  const DBL = TENNIS_PRESETS.doubles; // setsToWin 2, no-ad, match TB to 10

  it('replaces the deciding set with a single match tiebreak from 0-0', () => {
    let e = gamesToLove([], 'A', 6); // set 1: A
    e = gamesToLove(e, 'B', 6); // set 2: B -> 1-1, deciding set is a match tiebreak
    const mid = tennisState(e, DBL);
    expect(mid.currentGame.inTiebreak).toBe(true);
    expect(mid.currentSet).toMatchObject({ gamesA: 0, gamesB: 0 }); // no games in match TB

    // Match tiebreak to 10 win-by-2; A wins 10-6.
    e = points(e, 'A', 6);
    e = points(e, 'B', 6); // 6-6
    e = points(e, 'A', 4); // 10-6
    const s = tennisState(e, DBL);
    expect(s.isMatchOver).toBe(true);
    expect(s.winner).toBe('A');
  });
});
