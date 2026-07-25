// Cricket delivery-sourced ENGINE CORE (C1a)
//
// Pure, deterministic scoring engine. NO React/DOM imports, NO Date.now() inside
// derivations (pass `ts` in on the delivery). The append-only `deliveries[]` array
// is the SOURCE OF TRUTH; every stat is FOLDED from it, never stored as an aggregate.
//
// This module lives BESIDE the legacy aggregate helpers in cricketCalculations.js.
// New (delivery-sourced) matches use this engine; legacy matches keep the aggregate path.
//
// Limited-overs only (T10/T20/ODI/custom). Test-match 4-innings / follow-on /
// declaration are intentionally NOT implemented. ballsPerOver ALWAYS comes from
// format config — never hardcoded to 6.

// ==========================================
// TYPEDEFS
// ==========================================

/**
 * @typedef {Object} Extra
 * @property {'wide'|'no-ball'|'bye'|'leg-bye'|'penalty'} type
 * @property {number} runs
 */

/**
 * @typedef {Object} Overthrow
 * @property {number} batRuns
 * @property {number} overthrowRuns
 * @property {boolean} reachedBoundary
 * @property {'bat'|'extra'} offBatOrExtra
 */

/**
 * @typedef {Object} Wicket
 * @property {'bowled'|'caught'|'lbw'|'run-out'|'stumped'|'hit-wicket'|'mankad'|'obstructing'|'hit-twice'|'timed-out'|'retired-out'} type
 * @property {string} out            - batterId who is out
 * @property {'striker'|'non-striker'} [end]
 * @property {number} [completedRuns] - runs completed BEFORE the run-out (all modes)
 * @property {boolean} [crossed]      - caught: did batsmen cross?
 * @property {string} [incoming]      - incoming batterId (null => lone batter / last-man-stands)
 * @property {string} [bowler]
 * @property {string[]} [fielders]
 * @property {boolean} [onFreeHit]
 */

/**
 * @typedef {Object} Delivery
 * @property {number} [overNo]
 * @property {number} [ballInOver]
 * @property {boolean} [legal]
 * @property {number} batsmanRuns
 * @property {Extra[]} extras
 * @property {Overthrow|null} overthrow
 * @property {Wicket|null} wicket
 * @property {boolean} freeHit          - snapshot: was THIS ball a free hit?
 * @property {string} striker           - snapshot BEFORE this ball
 * @property {string} nonStriker        - snapshot BEFORE this ball
 * @property {string} bowler            - snapshot BEFORE this ball
 * @property {boolean} [manualSwap]     - explicit strike override (SWAP)
 * @property {{angle:number,dist:number}} [wagon]
 * @property {number} [ts]
 */

/**
 * @typedef {Object} HouseRules
 * @property {boolean} [tennisBall]
 * @property {boolean} [boxCricket]
 * @property {boolean} [oneTipOneHand]
 * @property {boolean} [noLBW]
 * @property {boolean} [lastManStands]
 * @property {boolean} [singleBatterRuns]
 * @property {boolean} [consecutiveOverAllowed]
 */

/**
 * @typedef {Object} Format
 * @property {string} name
 * @property {number} oversPerInnings
 * @property {number} ballsPerOver      - 6, or 8 for tennis — NEVER hardcode
 * @property {number} playersPerSide
 * @property {number|null} maxOversPerBowler
 * @property {Array<{fromOver:number,toOver:number}>} powerplays
 * @property {boolean} freeHitOnNoBall
 * @property {HouseRules} houseRules
 */

/**
 * @typedef {Object} Innings
 * @property {string} battingTeam
 * @property {string} bowlingTeam
 * @property {number} [target]
 * @property {Delivery[]} deliveries    - append-only SOURCE OF TRUTH
 * @property {string} striker
 * @property {string|null} nonStriker   - null => lone batter (last-man-stands)
 * @property {string} bowler
 * @property {number} playersPerSide
 * @property {boolean} [freeHit]        - is the NEXT ball a free hit?
 */

// ==========================================
// FACTORIES
// ==========================================

/**
 * Build a Format with sensible defaults. Default preset = 6 balls/over, 11-a-side,
 * LBW-on, free-hit-on-no-ball. Everything is config-driven.
 * @param {Partial<Format>} [overrides]
 * @returns {Format}
 */
export function makeFormat(overrides = {}) {
  return {
    name: 'custom',
    oversPerInnings: 20,
    ballsPerOver: 6,
    playersPerSide: 11,
    maxOversPerBowler: null,
    powerplays: [],
    freeHitOnNoBall: true,
    ...overrides,
    houseRules: {
      tennisBall: false,
      boxCricket: false,
      oneTipOneHand: false,
      noLBW: false,
      lastManStands: false,
      singleBatterRuns: false,
      consecutiveOverAllowed: false,
      ...(overrides.houseRules || {}),
    },
  };
}

/**
 * Build an Innings with defaults.
 * @param {Partial<Innings>} [overrides]
 * @returns {Innings}
 */
export function createInnings(overrides = {}) {
  return {
    battingTeam: 'A',
    bowlingTeam: 'B',
    target: null,
    deliveries: [],
    striker: 'p1',
    nonStriker: 'p2',
    bowler: 'b1',
    playersPerSide: 11,
    freeHit: false,
    ...overrides,
  };
}

/**
 * Build a Delivery with defaults. Snapshot pointers are stamped by applyDelivery.
 * @param {Partial<Delivery>} [overrides]
 * @returns {Delivery}
 */
export function makeDelivery(overrides = {}) {
  return {
    batsmanRuns: 0,
    extras: [],
    overthrow: null,
    wicket: null,
    freeHit: false,
    ...overrides,
  };
}

// ==========================================
// PRIMITIVES
// ==========================================

const BOWLER_CREDIT = new Set(['bowled', 'caught', 'lbw', 'stumped', 'hit-wicket']);
const ALL_WICKET_TYPES = new Set([
  'bowled', 'caught', 'lbw', 'run-out', 'stumped', 'hit-wicket',
  'mankad', 'obstructing', 'hit-twice', 'timed-out', 'retired-out',
]);

/**
 * A "legal ball" is one that advances the over. Illegal (re-bowl / not counted) if:
 * any wide/no-ball component present, OR it is a dead ball, OR a between-balls retire
 * marker, OR a Mankad (run-out of the non-striker before the ball is delivered).
 */
export function isLegalDelivery(d) {
  if (d.deadBall) return false;
  if (d.retire) return false;
  if (d.wicket && d.wicket.type === 'mankad') return false;
  const extras = d.extras || [];
  return !extras.some(e => e.type === 'wide' || e.type === 'no-ball');
}

export function hasNoBall(d) {
  return (d.extras || []).some(e => e.type === 'no-ball');
}

export function hasWide(d) {
  return (d.extras || []).some(e => e.type === 'wide');
}

/**
 * Numeric wide value so UI can render "3wd" / "5wd" (never a bare "wd").
 * @returns {number} total runs across all wide components (0 if not a wide)
 */
export function wideValue(d) {
  return (d.extras || [])
    .filter(e => e.type === 'wide')
    .reduce((s, e) => s + e.runs, 0);
}

/** Short-run adjustment: subtract 1 (or N) completed runs. truthy => 1, number => N. */
function shortRunOf(d) {
  if (!d.shortRun) return 0;
  return typeof d.shortRun === 'number' ? d.shortRun : 1;
}

/** Balls physically RUN by the batsmen — drives strike-rotation parity. */
function runningRuns(d) {
  if (d.overthrow) {
    const { batRuns = 0, overthrowRuns = 0, reachedBoundary = false } = d.overthrow;
    // A boundary from an overthrow is not run — parity is set by the completed run(s).
    return reachedBoundary ? batRuns : batRuns + overthrowRuns;
  }
  let r = d.batsmanRuns || 0;
  for (const e of d.extras || []) {
    if (e.type === 'bye' || e.type === 'leg-bye') r += e.runs;
    else if (e.type === 'wide') r += Math.max(0, e.runs - 1); // total wide − penalty
  }
  // Parity is computed on the CORRECTED (short-run adjusted) count.
  return Math.max(0, r - shortRunOf(d));
}

/** Crossings for a wicket delivery (for new-batter / survivor end derivation). */
function crossingsOf(d) {
  if (!d.wicket) return runningRuns(d);
  if (d.wicket.type === 'caught' || d.wicket.type === 'hit-twice') {
    return d.wicket.crossed ? 1 : 0;
  }
  return d.wicket.completedRuns || 0;
}

/** Runs charged to the bowler: bat + overthrows + wides + no-ball penalty. Byes/leg-byes/penalty excluded. */
function bowlerConceded(d) {
  const short = d.overthrow ? 0 : shortRunOf(d);
  const bat = d.overthrow ? (d.overthrow.batRuns || 0) : Math.max(0, (d.batsmanRuns || 0) - short);
  const otr = d.overthrow ? (d.overthrow.overthrowRuns || 0) : 0;
  let r = bat + otr;
  for (const e of d.extras || []) {
    if (e.type === 'wide' || e.type === 'no-ball') r += e.runs;
  }
  return r;
}

/** Format ballsPerOver as an overs string, e.g. 7 -> "1.1" at bpo 6. */
export function oversString(legalBalls, ballsPerOver) {
  const bpo = ballsPerOver || 6;
  const o = Math.floor(legalBalls / bpo);
  const r = legalBalls % bpo;
  return r === 0 ? `${o}` : `${o}.${r}`;
}

// ==========================================
// applyDelivery
// ==========================================

/**
 * Apply a delivery immutably: append it (with snapshot + overNo/ballInOver stamped)
 * and auto-update pointers (striker/nonStriker/bowler/freeHit). Never mutates input.
 * @param {Innings} innings
 * @param {Delivery} delivery
 * @param {Format} format
 * @returns {Innings}
 */
export function applyDelivery(innings, delivery, format) {
  const bpo = format.ballsPerOver || 6;
  const hr = format.houseRules || {};

  // ---- dead ball: nothing happens. Not counted, no credit, pointers + free hit frozen. ----
  if (delivery.deadBall) {
    const legalBefore = innings.deliveries.reduce((n, d) => n + (isLegalDelivery(d) ? 1 : 0), 0);
    const stamped = {
      ...makeDelivery(delivery),
      ...delivery,
      legal: false,
      striker: innings.striker,
      nonStriker: innings.nonStriker,
      bowler: innings.bowler,
      freeHit: innings.freeHit || false,
      overNo: Math.floor(legalBefore / bpo) + 1,
      ballInOver: (legalBefore % bpo) + 1,
    };
    return {
      ...innings,
      deliveries: [...innings.deliveries, stamped],
      freeHit: innings.freeHit || false, // dead ball does NOT consume the free hit
    };
  }

  // ---- validation: house rules & free hit ----
  if (delivery.wicket) {
    if (!ALL_WICKET_TYPES.has(delivery.wicket.type)) {
      throw new Error(`Unknown wicket type: ${delivery.wicket.type}`);
    }
    if (delivery.wicket.type === 'lbw' && hr.noLBW) {
      throw new Error('LBW is disabled by house rules (noLBW)');
    }
    if (innings.freeHit && delivery.wicket.type !== 'run-out') {
      // On a free hit ONLY a run-out dismisses; anything else is rejected/reverts.
      throw new Error(`On a free hit only run-out is a valid dismissal (got ${delivery.wicket.type})`);
    }
  }

  const legal = isLegalDelivery(delivery);
  const legalBefore = innings.deliveries.reduce((n, d) => n + (isLegalDelivery(d) ? 1 : 0), 0);
  const legalAfter = legalBefore + (legal ? 1 : 0);
  const overCompleted = legal && legalAfter % bpo === 0;

  const single = !!hr.singleBatterRuns;
  const loneBatter = innings.nonStriker == null;

  // ---- resolve ends ----
  let sEnd = innings.striker;      // id currently at striker end
  let nEnd = innings.nonStriker;   // id currently at non-striker end (may be null)

  const suppressRotation = loneBatter || single;

  if (delivery.wicket && ALL_WICKET_TYPES.has(delivery.wicket.type)) {
    // Apply crossings parity first, then place incoming at the out batter's end.
    const crossings = crossingsOf(delivery);
    if (!suppressRotation && crossings % 2 === 1) {
      [sEnd, nEnd] = [nEnd, sEnd];
    }
    const outId = delivery.wicket.out;
    const incoming = delivery.wicket.incoming ?? null;
    let outEnd;
    if (sEnd === outId) outEnd = 'striker';
    else if (nEnd === outId) outEnd = 'nonStriker';
    else outEnd = delivery.wicket.end === 'non-striker' ? 'nonStriker' : 'striker';
    if (outEnd === 'striker') sEnd = incoming;
    else nEnd = incoming;
  } else {
    // Non-wicket: parity swap from physical running runs.
    if (!suppressRotation && runningRuns(delivery) % 2 === 1) {
      [sEnd, nEnd] = [nEnd, sEnd];
    }
  }

  // End-of-over swap (idempotent, single application). A wide never completes an over.
  if (overCompleted && !suppressRotation && nEnd != null && sEnd != null) {
    [sEnd, nEnd] = [nEnd, sEnd];
  }

  // Explicit manual override.
  if (delivery.manualSwap && nEnd != null && sEnd != null) {
    [sEnd, nEnd] = [nEnd, sEnd];
  }

  // ---- free-hit state for the NEXT ball ----
  let nextFreeHit;
  if (hasNoBall(delivery) && format.freeHitOnNoBall) {
    nextFreeHit = true;                 // any no-ball arms a free hit
  } else if (legal) {
    nextFreeHit = false;                // a legal ball consumes the free hit
  } else {
    nextFreeHit = innings.freeHit || false; // wide during a free hit keeps it armed
  }

  // ---- stamp snapshot + append ----
  const stamped = {
    ...makeDelivery(delivery),
    ...delivery,
    legal,
    striker: innings.striker,
    nonStriker: innings.nonStriker,
    bowler: innings.bowler,
    freeHit: innings.freeHit || false,
    overNo: Math.floor(legalBefore / bpo) + 1,
    ballInOver: (legalBefore % bpo) + 1,
  };

  return {
    ...innings,
    deliveries: [...innings.deliveries, stamped],
    striker: sEnd,
    nonStriker: nEnd,
    freeHit: nextFreeHit,
  };
}

// ==========================================
// undo
// ==========================================

/**
 * Pop the last delivery and restore its snapshot pointers + freeHit.
 * @param {Innings} innings
 * @returns {Innings}
 */
export function undo(innings) {
  if (!innings.deliveries.length) return { ...innings };
  const deliveries = innings.deliveries.slice(0, -1);
  const popped = innings.deliveries[innings.deliveries.length - 1];
  return {
    ...innings,
    deliveries,
    striker: popped.striker,
    nonStriker: popped.nonStriker,
    bowler: popped.bowler,
    freeHit: popped.freeHit || false,
  };
}

// ==========================================
// C1b behavioral actions
// ==========================================

/**
 * Retire a batter between balls. Three modes:
 *   'hurt'   — not out, NO wicket, batter is resumable later.
 *   'out'    — a dismissal (retired-out): wkts+1, no bowler credit.
 *   'rotate' — gully forced-rotate: batter leaves, NO wicket, re-enters at end of order.
 * Appends a non-counting marker delivery (legal=false, no runs) so undo/edit see it,
 * and places `incoming` at the retiring batter's end. The free hit is preserved.
 * @param {Innings} innings
 * @param {{batter:string, mode:'hurt'|'out'|'rotate', incoming?:string|null}} opts
 * @param {Format} format
 * @returns {Innings}
 */
export function applyRetire(innings, { batter, mode, incoming = null }, format) {
  const bpo = format.ballsPerOver || 6;
  const legalBefore = innings.deliveries.reduce((n, d) => n + (isLegalDelivery(d) ? 1 : 0), 0);

  // The retiring batter leaves their end; incoming takes it. Strike otherwise frozen.
  let sEnd = innings.striker;
  let nEnd = innings.nonStriker;
  if (sEnd === batter) sEnd = incoming;
  else if (nEnd === batter) nEnd = incoming;

  const wicket = mode === 'out'
    ? { type: 'retired-out', out: batter, incoming }
    : null;

  const stamped = {
    ...makeDelivery({}),
    retire: { batter, mode, incoming },
    wicket,
    legal: false,
    striker: innings.striker,
    nonStriker: innings.nonStriker,
    bowler: innings.bowler,
    freeHit: innings.freeHit || false,
    overNo: Math.floor(legalBefore / bpo) + 1,
    ballInOver: (legalBefore % bpo) + 1,
  };

  return {
    ...innings,
    deliveries: [...innings.deliveries, stamped],
    striker: sEnd,
    nonStriker: nEnd,
    freeHit: innings.freeHit || false, // retirement does not consume a free hit
  };
}

/**
 * Batters who retired hurt/rotate and are NOT currently on the field — i.e. available
 * to resume as an incoming batter. Once they re-enter (striker/nonStriker), they drop off.
 * @param {Innings} innings
 * @returns {Array<{batter:string, mode:'hurt'|'rotate'}>}
 */
export function retiredBatters(innings) {
  const seen = new Set();
  const out = [];
  for (const d of innings.deliveries) {
    const r = d.retire;
    if (r && (r.mode === 'hurt' || r.mode === 'rotate') && !seen.has(r.batter)) {
      seen.add(r.batter);
      out.push({ batter: r.batter, mode: r.mode });
    }
  }
  return out.filter(r => r.batter !== innings.striker && r.batter !== innings.nonStriker);
}

/**
 * Mid-over bowler change (injury/light). Bowler is an innings pointer, so subsequent
 * balls stamp the new bowler; deriveInnings then splits the over's ball-credit between
 * both bowlers (each shows a partial over). Pure — returns a new innings.
 * @param {Innings} innings
 * @param {string} bowlerId
 * @returns {Innings}
 */
export function changeBowler(innings, bowlerId) {
  return { ...innings, bowler: bowlerId };
}

/**
 * Edit a past delivery, then REPLAY forward. delivery[index] is replaced by
 * {...original, ...newFields} and everything from index→head is re-derived by replaying
 * applyDelivery (strike, pointers, freeHit, legal-ball count recomputed). Distinct from
 * LIFO undo: downstream per-delivery snapshots are recomputed, never trusted. Each tail
 * delivery keeps its own bowler (so mid-over changes survive). Returns the new innings
 * with an attached `diff` {before,after} summary. Pure — input innings untouched.
 * @param {Innings} innings
 * @param {number} index
 * @param {Partial<Delivery>} newFields
 * @param {Format} format
 * @returns {Innings & {diff:{before:{runs:number,wkts:number,striker:string},
 *   after:{runs:number,wkts:number,striker:string}}}}
 */
export function editDelivery(innings, index, newFields, format) {
  if (index < 0 || index >= innings.deliveries.length) {
    throw new Error(`editDelivery: index ${index} out of range (have ${innings.deliveries.length})`);
  }
  const beforeD = deriveInnings(innings, format);
  const before = { runs: beforeD.runs, wkts: beforeD.wkts, striker: innings.striker };

  const at = innings.deliveries[index];
  const prefix = innings.deliveries.slice(0, index);
  const tail = innings.deliveries.slice(index + 1);
  const edited = { ...at, ...newFields };

  // Rewind to the state that existed BEFORE delivery[index] (its stored snapshot).
  let state = {
    ...innings,
    deliveries: prefix,
    striker: at.striker,
    nonStriker: at.nonStriker,
    bowler: at.bowler,
    freeHit: at.freeHit || false,
  };
  state = applyDelivery(state, edited, format);
  // Replay the tail from raw fields; restore each ball's own bowler snapshot first.
  for (const d of tail) {
    state = { ...state, bowler: d.bowler };
    state = applyDelivery(state, d, format);
  }

  const afterD = deriveInnings(state, format);
  const after = { runs: afterD.runs, wkts: afterD.wkts, striker: state.striker };
  return { ...state, diff: { before, after } };
}

// ==========================================
// deriveInnings
// ==========================================

/**
 * Fold the append-only deliveries[] into a full innings scorecard. NEVER an aggregate.
 * @param {Innings} innings
 * @param {Format} format
 * @returns {{runs:number,wkts:number,legalBalls:number,overs:string,
 *  extrasBreakdown:{b:number,lb:number,wd:number,nb:number,pen:number},
 *  fow:Array,partnerships:Array,batters:Object,bowlers:Object}}
 */
export function deriveInnings(innings, format) {
  const bpo = format.ballsPerOver || 6;
  const ex = { b: 0, lb: 0, wd: 0, nb: 0, pen: 0 };
  const batters = {};
  const bowlers = {};
  let runs = 0;
  let wkts = 0;
  let legalBalls = 0;
  const fow = [];
  const partnerships = [];
  let partnershipRuns = 0;
  const overBuckets = {}; // overNo -> { bowler, conceded, legal }

  const batterRec = (id) => (batters[id] ??= { R: 0, B: 0, fours: 0, sixes: 0, out: false });
  const bowlerRec = (id) => (bowlers[id] ??= { balls: 0, R: 0, W: 0, wd: 0, nb: 0, maidens: 0 });

  for (const d of innings.deliveries) {
    if (d.deadBall) continue; // dead ball: no runs, no ball, no credit to anyone
    const legal = isLegalDelivery(d);
    const short = d.overthrow ? 0 : shortRunOf(d);
    const bat = d.overthrow ? (d.overthrow.batRuns || 0) : Math.max(0, (d.batsmanRuns || 0) - short);
    const otr = d.overthrow ? (d.overthrow.overthrowRuns || 0) : 0;
    const overthrowToBat = d.overthrow && d.overthrow.offBatOrExtra === 'bat';

    let extrasTotal = 0;
    for (const e of d.extras || []) {
      extrasTotal += e.runs;
      if (e.type === 'bye') ex.b += e.runs;
      else if (e.type === 'leg-bye') ex.lb += e.runs;
      else if (e.type === 'wide') ex.wd += e.runs;
      else if (e.type === 'no-ball') ex.nb += e.runs;
      else if (e.type === 'penalty') ex.pen += e.runs;
    }
    // Overthrow credited to extras (not the bat) => byes.
    if (d.overthrow && !overthrowToBat) ex.b += otr;

    const total = bat + otr + extrasTotal;
    runs += total;
    partnershipRuns += total;
    if (legal) legalBalls++;

    // --- batter ---
    const sb = batterRec(d.striker);
    sb.R += bat + (overthrowToBat ? otr : 0);
    if (legal) sb.B++; // a legal ball was FACED (incl. bye/leg-bye); wide & no-ball do not.
    // Boundaries: only a CLEAN four/six off the bat. Overthrow boundary is NOT a batter four.
    if (!d.overthrow && d.batsmanRuns === 4) sb.fours++;
    if (!d.overthrow && d.batsmanRuns === 6) sb.sixes++;

    // --- bowler ---
    const bw = bowlerRec(d.bowler);
    if (legal) bw.balls++;
    bw.R += bowlerConceded(d);
    if (hasWide(d)) bw.wd++;
    if (hasNoBall(d)) bw.nb++;

    // --- over buckets for maidens ---
    const on = d.overNo;
    if (on != null) {
      const bkt = (overBuckets[on] ??= { bowler: d.bowler, conceded: 0, legal: 0 });
      bkt.conceded += bowlerConceded(d);
      if (legal) bkt.legal++;
    }

    // --- wicket ---
    if (d.wicket) {
      wkts++;
      if (batters[d.wicket.out]) batters[d.wicket.out].out = true;
      if (BOWLER_CREDIT.has(d.wicket.type)) bw.W++;
      fow.push({
        wkts,
        runs,
        batter: d.wicket.out,
        over: oversString(legalBalls, bpo),
      });
      partnerships.push({ wkt: wkts, runs: partnershipRuns });
      partnershipRuns = 0;
    }
  }

  // Unbeaten partnership.
  if (partnershipRuns > 0 || innings.deliveries.length === 0) {
    partnerships.push({ wkt: wkts + 1, runs: partnershipRuns, unbeaten: true });
  }

  // Maidens: a completed over with 0 runs charged to the bowler.
  for (const on of Object.keys(overBuckets)) {
    const bkt = overBuckets[on];
    if (bkt.legal >= bpo && bkt.conceded === 0) bowlerRec(bkt.bowler).maidens++;
  }

  // --- shape outputs ---
  const battersOut = {};
  for (const [id, b] of Object.entries(batters)) {
    battersOut[id] = {
      R: b.R,
      B: b.B,
      '4s': b.fours,
      '6s': b.sixes,
      SR: b.B ? +((b.R * 100) / b.B).toFixed(2) : 0,
      out: b.out,
    };
  }
  const bowlersOut = {};
  for (const [id, w] of Object.entries(bowlers)) {
    bowlersOut[id] = {
      O: oversString(w.balls, bpo),
      M: w.maidens,
      R: w.R,
      W: w.W,
      Econ: w.balls ? +((w.R * bpo) / w.balls).toFixed(2) : 0,
      wd: w.wd,
      nb: w.nb,
    };
  }

  return {
    runs,
    wkts,
    legalBalls,
    overs: oversString(legalBalls, bpo),
    extrasBreakdown: ex,
    fow,
    partnerships,
    batters: battersOut,
    bowlers: bowlersOut,
  };
}

// ==========================================
// deriveChase — SOLE producer of rates
// ==========================================

/**
 * Chase math. This is the ONLY function that produces run rates.
 * @param {Innings} innings
 * @param {Format} format
 * @returns {{runsNeeded:number,ballsLeft:number,RRR:number,CRR:number,
 *   projection:number,winProb:{value:number,basis:string}}}
 */
export function deriveChase(innings, format) {
  const bpo = format.ballsPerOver || 6;
  const { runs, legalBalls } = deriveInnings(innings, format);
  const totalBalls = (format.oversPerInnings || 0) * bpo;
  const target = innings.target || 0;

  const runsNeeded = Math.max(0, target - runs);
  const ballsLeft = Math.max(0, totalBalls - legalBalls);

  const CRR = legalBalls > 0 ? +((runs * bpo) / legalBalls).toFixed(2) : 0;
  const RRR = ballsLeft > 0 ? +((runsNeeded * bpo) / ballsLeft).toFixed(2) : 0;
  const projection = Math.round(CRR * (format.oversPerInnings || 0));

  // Provisional heuristic — will be replaced. Chasing-team perspective.
  let value;
  if (runsNeeded <= 0) {
    value = 1;
  } else if (ballsLeft <= 0) {
    value = 0;
  } else {
    value = 0.5 + (CRR - RRR) * 0.12;
    value = Math.max(0, Math.min(1, +value.toFixed(4)));
  }

  return {
    runsNeeded,
    ballsLeft,
    RRR,
    CRR,
    projection,
    winProb: { value, basis: 'RRR-gap heuristic v0' },
  };
}

// ==========================================
// Bowler eligibility (house-rule guards)
// ==========================================

/**
 * Can this bowler bowl the next over? Honors consecutiveOverAllowed + maxOversPerBowler.
 * @param {Innings} innings
 * @param {string} bowlerId
 * @param {Format} format
 * @returns {boolean}
 */
export function canBowl(innings, bowlerId, format) {
  const hr = format.houseRules || {};
  // Last completed over's bowler.
  let lastOverBowler = null;
  for (let i = innings.deliveries.length - 1; i >= 0; i--) {
    if (isLegalDelivery(innings.deliveries[i])) {
      lastOverBowler = innings.deliveries[i].bowler;
      break;
    }
  }
  if (!hr.consecutiveOverAllowed && lastOverBowler === bowlerId) return false;

  if (format.maxOversPerBowler != null) {
    const bpo = format.ballsPerOver || 6;
    const balls = innings.deliveries.reduce(
      (n, d) => n + (isLegalDelivery(d) && d.bowler === bowlerId ? 1 : 0), 0);
    if (Math.floor(balls / bpo) >= format.maxOversPerBowler) return false;
  }
  return true;
}
