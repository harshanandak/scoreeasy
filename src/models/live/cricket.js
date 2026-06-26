// Pure cricket scorecard projections (research §4.C, design §6.5).
//
// ADDITIVE over the existing team-level innings on `MonoCricketTestLiveScore`.
// The source of truth is a per-ball **deliveries log**; every official-scorecard
// surface (batting card, bowling card, extras, fall of wickets, partnership,
// required run rate, this-over tokens) is a PURE projection over that log. No
// rotation engine is recomputed — each delivery already carries its authoritative
// `strikerId`/`nonStrikerId`/`bowlerId`. We never re-derive who is on strike;
// we only aggregate by the ids the scorer recorded.
//
// THE ATTRIBUTION MATRIX (single source of truth for every function below):
//
//   extraType  | legal ball | batter faced | batter runs | bowler runs       | extras bucket
//   -----------|------------|--------------|-------------|-------------------|--------------
//   (none)     | yes        | yes          | runsBat     | runsBat           | —
//   wide       | no         | no           | 0           | extraRuns         | w  += extraRuns
//   noball     | no         | no           | runsBat     | runsBat+extraRuns | nb += extraRuns
//   bye        | yes        | yes          | 0           | 0                 | b  += extraRuns
//   legbye     | yes        | yes          | 0           | 0                 | lb += extraRuns
//   penalty    | no         | no           | 0           | 0                 | p  += extraRuns
//
// INTEGRITY INVARIANT (asserted in tests): sum(batter runs) + extras.total ===
// innings runs, for every ball. It holds by construction: every run is either a
// bat run (counted on the batter) or an extra run (counted in exactly one bucket).
//
// Reuses `ballsToOvers` + `calculateRunRate` from cricketCalculations — never
// reinvented. Strike rate is R/B*100 (NOT runs-per-over) and is hand-rolled.

import { ballsToOvers, calculateRunRate } from '../../utils/cricketCalculations.js';

/**
 * @typedef {object} Delivery
 * @property {number} over          over number (0-indexed)
 * @property {number} ballInOver    legal ball number within the over (1..6)
 * @property {boolean} legal        true if this advances the legal-ball count
 * @property {string} strikerId     batter on strike for this delivery
 * @property {string} nonStrikerId  batter at the non-striker's end
 * @property {string} bowlerId      bowler of this delivery
 * @property {number} runsBat       runs scored off the bat
 * @property {('wide'|'noball'|'bye'|'legbye'|'penalty')} [extraType]
 * @property {number} extraRuns     runs from the extra (the penalty/byes/etc.)
 * @property {{batterOutId: string, kind: string, fielderId?: string}} [wicket]
 * @property {number} seq           strictly increasing order key (undo = drop max seq)
 */

/** Dismissal kinds credited to the bowler. Run-outs are deliberately absent. */
const BOWLER_CREDITED_KINDS = new Set([
  'bowled',
  'caught',
  'lbw',
  'stumped',
  'hitwicket',
]);

/** Extra types that still consume a legal ball (and a batter ball-faced). */
const LEGAL_EXTRA_TYPES = new Set(['bye', 'legbye']);

/**
 * Does this delivery count as a legal ball? Trusts the stored `legal` flag when
 * present (it is authoritative); otherwise derives it from the attribution
 * matrix so callers can omit it.
 * @param {Delivery} d
 * @returns {boolean}
 */
function isLegal(d) {
  if (typeof d.legal === 'boolean') return d.legal;
  if (!d.extraType) return true;
  return LEGAL_EXTRA_TYPES.has(d.extraType);
}

/** Whether the bowler is credited a wicket for this delivery's dismissal. */
function bowlerGetsWicket(wicket) {
  return Boolean(wicket) && BOWLER_CREDITED_KINDS.has(wicket.kind);
}

/** Runs charged to the bowler for this delivery (per the attribution matrix). */
function bowlerRunsFor(d) {
  const bat = d.runsBat || 0;
  const extra = d.extraRuns || 0;
  switch (d.extraType) {
    case 'wide':
      return extra; // whole wide is charged to the bowler
    case 'noball':
      return bat + extra; // bat runs AND the no-ball penalty
    case 'bye':
    case 'legbye':
    case 'penalty':
      return 0; // byes/leg-byes/penalties never touch the bowler
    default:
      return bat; // normal ball
  }
}

/** Runs credited to the batter for this delivery (per the attribution matrix). */
function batterRunsFor(d) {
  // Only the bat earns the batter runs: normal balls and no-balls. Byes,
  // leg-byes, wides and penalties credit the batter nothing.
  if (!d.extraType || d.extraType === 'noball') return d.runsBat || 0;
  return 0;
}

/** Does the batter face a ball here? Coincides exactly with `legal`. */
function batterFacesBall(d) {
  return isLegal(d);
}

/** Return a seq-ordered shallow copy; never mutate the caller's array. */
function ordered(deliveries) {
  return [...(deliveries || [])].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

/**
 * Innings roll-up used to assert the integrity invariant and to feed run-rate
 * surfaces. `runs` is bat runs + every extra run; `legalBalls` is the legal-ball
 * count; `wickets` is the number of deliveries carrying a wicket.
 * @param {ReadonlyArray<Delivery>} deliveries one innings' deliveries
 * @returns {{runs: number, legalBalls: number, wickets: number}}
 */
export function inningsTotals(deliveries) {
  let runs = 0;
  let legalBalls = 0;
  let wickets = 0;
  for (const d of ordered(deliveries)) {
    runs += (d.runsBat || 0) + (d.extraRuns || 0);
    if (isLegal(d)) legalBalls += 1;
    if (d.wicket) wickets += 1;
  }
  return { runs, legalBalls, wickets };
}

/**
 * Batting card — one row per batter who appears as striker OR non-striker (so a
 * not-out non-striker who has faced no ball still shows). Structured data only;
 * formatting (`c Smith b Bumrah`, `-` for SR) is the component's job.
 * @param {ReadonlyArray<Delivery>} deliveries one innings' deliveries
 * @returns {Array<{batterId: string, runs: number, balls: number, fours: number,
 *   sixes: number, strikeRate: (number|null), out: boolean,
 *   dismissal: ({kind: string, bowlerId: string, fielderId: (string|undefined),
 *   batterOutId: string}|null)}>}
 */
export function buildBattingCard(deliveries) {
  const rows = new Map();
  const ensure = (id) => {
    if (!id) return null;
    if (!rows.has(id)) {
      rows.set(id, {
        batterId: id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: null,
        out: false,
        dismissal: null,
      });
    }
    return rows.get(id);
  };

  for (const d of ordered(deliveries)) {
    // Register both ends so a not-out non-striker is never dropped.
    const striker = ensure(d.strikerId);
    ensure(d.nonStrikerId);

    if (striker) {
      const batRuns = batterRunsFor(d);
      striker.runs += batRuns;
      if (batterFacesBall(d)) striker.balls += 1;
      if (batRuns === 4) striker.fours += 1;
      if (batRuns === 6) striker.sixes += 1;
    }

    if (d.wicket) {
      const out = ensure(d.wicket.batterOutId);
      if (out) {
        out.out = true;
        out.dismissal = {
          kind: d.wicket.kind,
          bowlerId: d.bowlerId,
          fielderId: d.wicket.fielderId,
          batterOutId: d.wicket.batterOutId,
        };
      }
    }
  }

  for (const row of rows.values()) {
    row.strikeRate = row.balls > 0 ? (row.runs / row.balls) * 100 : null;
  }

  return [...rows.values()];
}

/**
 * Bowling card — one row per bowler. Reuses `ballsToOvers`/`calculateRunRate`.
 * A maiden is a completed legal-ball over (6 legal balls) in which the bowler is
 * charged 0 runs; a byes-only over IS a maiden, any over with a wide/no-ball is
 * not (those always charge the bowler).
 * @param {ReadonlyArray<Delivery>} deliveries one innings' deliveries
 * @returns {Array<{bowlerId: string, legalBalls: number, overs: string,
 *   maidens: number, runs: number, wickets: number, economy: (number|null),
 *   wides: number, noballs: number}>}
 */
export function buildBowlingCard(deliveries) {
  const rows = new Map();
  // Per-bowler, per-over accumulator to detect maidens.
  const overAcc = new Map(); // key `${bowlerId}#${over}` → {legal, charged, anyFreeExtra}

  const ensure = (id) => {
    if (!rows.has(id)) {
      rows.set(id, {
        bowlerId: id,
        legalBalls: 0,
        overs: '0',
        maidens: 0,
        runs: 0,
        wickets: 0,
        economy: null,
        wides: 0,
        noballs: 0,
      });
    }
    return rows.get(id);
  };

  for (const d of ordered(deliveries)) {
    const row = ensure(d.bowlerId);
    const charged = bowlerRunsFor(d);
    row.runs += charged;
    if (isLegal(d)) row.legalBalls += 1;
    if (bowlerGetsWicket(d.wicket)) row.wickets += 1;
    if (d.extraType === 'wide') row.wides += 1;
    if (d.extraType === 'noball') row.noballs += 1;

    const key = `${d.bowlerId}#${d.over}`;
    if (!overAcc.has(key)) overAcc.set(key, { legal: 0, charged: 0 });
    const acc = overAcc.get(key);
    if (isLegal(d)) acc.legal += 1;
    acc.charged += charged;
  }

  // Maidens: a complete over (>=6 legal balls) with 0 runs charged to the bowler.
  for (const [key, acc] of overAcc.entries()) {
    if (acc.legal >= 6 && acc.charged === 0) {
      const bowlerId = key.slice(0, key.lastIndexOf('#'));
      const row = rows.get(bowlerId);
      if (row) row.maidens += 1;
    }
  }

  for (const row of rows.values()) {
    row.overs = ballsToOvers(row.legalBalls);
    row.economy = row.legalBalls > 0 ? calculateRunRate(row.runs, row.legalBalls) : null;
  }

  return [...rows.values()];
}

/**
 * Extras breakdown by bucket. byes `b`, leg-byes `lb`, wides `w`, no-balls `nb`,
 * penalties `p`, plus a `total`. The no-ball bucket holds ONLY the no-ball
 * penalty (`extraRuns`) — runs off the bat on a no-ball belong to the batter.
 * @param {ReadonlyArray<Delivery>} deliveries one innings' deliveries
 * @returns {{b: number, lb: number, w: number, nb: number, p: number, total: number}}
 */
export function buildExtras(deliveries) {
  const extras = { b: 0, lb: 0, w: 0, nb: 0, p: 0, total: 0 };
  const bucket = { bye: 'b', legbye: 'lb', wide: 'w', noball: 'nb', penalty: 'p' };
  for (const d of ordered(deliveries)) {
    const key = bucket[d.extraType];
    if (!key) continue;
    const runs = d.extraRuns || 0;
    extras[key] += runs;
    extras.total += runs;
  }
  return extras;
}

/**
 * Fall of wickets — one chip per wicket, in order, with the cumulative innings
 * score at the moment it fell, the wicket number, who was out, and the overs
 * notation at the fall.
 * @param {ReadonlyArray<Delivery>} deliveries one innings' deliveries
 * @returns {Array<{runs: number, wicket: number, batterOutId: string, oversAtFall: string}>}
 */
export function buildFallOfWickets(deliveries) {
  const fow = [];
  let runs = 0;
  let legalBalls = 0;
  let wicketNo = 0;
  for (const d of ordered(deliveries)) {
    runs += (d.runsBat || 0) + (d.extraRuns || 0);
    if (isLegal(d)) legalBalls += 1;
    if (d.wicket) {
      wicketNo += 1;
      fow.push({
        runs,
        wicket: wicketNo,
        batterOutId: d.wicket.batterOutId,
        oversAtFall: ballsToOvers(legalBalls),
      });
    }
  }
  return fow;
}

/**
 * Current (unbroken) partnership — runs (including extras) and legal balls since
 * the last wicket fell. Covers the whole innings when no wicket has fallen yet.
 * @param {ReadonlyArray<Delivery>} deliveries one innings' deliveries
 * @returns {{runs: number, balls: number}}
 */
export function currentPartnership(deliveries) {
  let runs = 0;
  let balls = 0;
  for (const d of ordered(deliveries)) {
    runs += (d.runsBat || 0) + (d.extraRuns || 0);
    if (isLegal(d)) balls += 1;
    if (d.wicket) {
      // A wicket ends the partnership: reset and start counting the next one.
      runs = 0;
      balls = 0;
    }
  }
  return { runs, balls };
}

/**
 * Required run rate for a chase: runs-per-over the batting side still needs.
 * Returns 0 once the target is reached/passed, and null when no balls remain but
 * the target is unmet (rate is undefined / unreachable). Reuses calculateRunRate.
 * @param {{target: number, runs: number, ballsRemaining: number}} args
 * @returns {number|null}
 */
export function requiredRunRate({ target, runs, ballsRemaining }) {
  const need = target - runs;
  if (need <= 0) return 0;
  if (!ballsRemaining || ballsRemaining <= 0) return null;
  return calculateRunRate(need, ballsRemaining);
}

/** Display token for a single delivery in the THIS OVER strip. */
function deliveryToken(d) {
  if (d.extraType === 'wide') return 'Wd';
  if (d.extraType === 'noball') return 'Nb';
  if (d.wicket) return 'W';
  if (d.extraType === 'bye') return `${d.extraRuns || 0}b`;
  if (d.extraType === 'legbye') return `${d.extraRuns || 0}lb`;
  const bat = d.runsBat || 0;
  return bat === 0 ? '.' : String(bat);
}

/**
 * Tokens for the current over (the over of the most-recent delivery), mapped to
 * the THIS OVER strip vocabulary `['.','1','4','W','6','Wd','Nb', ...]`. Wides
 * and no-balls appear as tokens but, per the matrix, do not advance the over.
 * @param {ReadonlyArray<Delivery>} deliveries one innings' deliveries
 * @returns {string[]}
 */
export function thisOverTokens(deliveries) {
  const sorted = ordered(deliveries);
  if (sorted.length === 0) return [];
  const currentOver = sorted[sorted.length - 1].over;
  return sorted.filter((d) => d.over === currentOver).map(deliveryToken);
}
