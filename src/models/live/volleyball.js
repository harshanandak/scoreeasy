// Pure volleyball set/point rules over the shared `scoringEvents` stream
// (research §4.A — FIVB rally scoring).
//
// DESIGN: this engine OWNS set-boundary detection. The event model's
// `appendPoint` carries `setsA/setsB` forward unchanged and accumulates
// `runningA/runningB` across the WHOLE match (they never reset per set), so we
// cannot trust those stored snapshots for per-set scores. Instead we replay the
// *surviving* point events (each undo cancels the most recent still-active
// point, matching `scoringEvents`/`scorecard.js`) and apply the set rules
// ourselves in a single pass. This makes undo — even across a set boundary —
// correct for free, and ignores `set_end` rows entirely (they are derived, not
// authoritative).
//
// RULES (research §4.A):
//   • A set ends when a team reaches the set target AND leads by >= winBy. NO
//     CAP — sets can exceed the target (27-25, 32-30).
//   • Set target = pointsPerSet for every set EXCEPT the deciding (last) set,
//     which uses deciderPoints.
//   • The deciding set is set `bestOf` (set 5 of bo5, set 3 of bo3).
//   • The match ends when a team wins ceil(bestOf/2) sets.
//   • servingTeam is STORED — derived from the latest `serve_change` event,
//     never inferred from who last scored (rally side-outs flip serve with no
//     score change).
//   • sideSwitched latches true once either team reaches 8 in the deciding set.

const DEFAULT_CONFIG = {
  pointsPerSet: 25,
  deciderPoints: 15,
  winBy: 2,
  bestOf: 5,
};

/**
 * Resolves the point events that survive after applying every undo. Each undo
 * cancels the most recent still-active point. Returns survivors in order.
 *
 * @param {ReadonlyArray<object>} events
 * @returns {object[]}
 */
function survivingPoints(events) {
  const stack = [];
  for (const event of events) {
    if (event.type === 'point') {
      stack.push(event);
    } else if (event.type === 'undo') {
      stack.pop();
    }
    // set_end | serve_change | timeout | correction | note: no point effect.
  }
  return stack;
}

/**
 * Latest stored serving team: the team carried by the most recent `serve_change`
 * event (preferring `servingAfter`, falling back to `team`), else
 * `config.initialServer`, else null. Never inferred from the last scorer.
 *
 * @param {ReadonlyArray<object>} events
 * @param {string|null|undefined} initialServer
 * @returns {'A'|'B'|null}
 */
function deriveServingTeam(events, initialServer) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === 'serve_change') {
      return events[i].servingAfter ?? events[i].team ?? null;
    }
  }
  return initialServer ?? null;
}

/** True when `(a,b)` is a winning set score for the given target/winBy. */
function isSetWon(a, b, target, winBy) {
  return (a >= target && a - b >= winBy) || (b >= target && b - a >= winBy);
}

/** True when scoring ONE more point for `lead` would win the set there. */
function isOnePointFromSet(lead, other, target, winBy) {
  const next = lead + 1;
  return next >= target && next - other >= winBy;
}

/**
 * Derives full volleyball match state from the event stream in one O(n) pass.
 *
 * @param {ReadonlyArray<object>} events
 * @param {{ pointsPerSet?: number, deciderPoints?: number, winBy?: number,
 *           bestOf?: number, initialServer?: 'A'|'B'|null }} [config]
 * @returns {{
 *   currentSet: number, pointsA: number, pointsB: number,
 *   completedSets: Array<{ a: number, b: number }>,
 *   setsA: number, setsB: number,
 *   isMatchOver: boolean, winner: 'A'|'B'|null,
 *   pointState: 'normal'|'setPoint'|'matchPoint',
 *   servingTeam: 'A'|'B'|null, sideSwitched: boolean,
 * }}
 */
export function volleyballState(events = [], config = {}) {
  const pointsPerSet = config.pointsPerSet ?? DEFAULT_CONFIG.pointsPerSet;
  const deciderPoints = config.deciderPoints ?? DEFAULT_CONFIG.deciderPoints;
  const winBy = config.winBy ?? DEFAULT_CONFIG.winBy;
  const bestOf = config.bestOf ?? DEFAULT_CONFIG.bestOf;
  const setsToWin = Math.ceil(bestOf / 2);

  const targetFor = (setNumber) => (setNumber === bestOf ? deciderPoints : pointsPerSet);

  const completedSets = [];
  let setsA = 0;
  let setsB = 0;
  let currentSet = 1; // 1-indexed set in progress
  let curA = 0;
  let curB = 0;
  let isMatchOver = false;
  let winner = null;
  let sideSwitched = false;

  for (const event of survivingPoints(events)) {
    if (isMatchOver) break; // ignore stray points after the match is decided

    const value = Number(event.value ?? 0);
    if (event.team === 'A') curA += value;
    else if (event.team === 'B') curB += value;

    // Side switch latches once either team reaches 8 in the deciding set.
    if (currentSet === bestOf && (curA >= 8 || curB >= 8)) {
      sideSwitched = true;
    }

    const target = targetFor(currentSet);
    if (isSetWon(curA, curB, target, winBy)) {
      const setWinner = curA > curB ? 'A' : 'B';
      completedSets.push({ a: curA, b: curB });
      if (setWinner === 'A') setsA += 1;
      else setsB += 1;

      if (setsA >= setsToWin || setsB >= setsToWin) {
        isMatchOver = true;
        winner = setWinner;
        // Points reset once the deciding set ends, even when it ends the match
        // (sibling test: "…after the deciding set ends and points reset").
        curA = 0;
        curB = 0;
      } else {
        currentSet += 1;
        curA = 0;
        curB = 0;
      }
    }
  }

  // pointState — max severity, team-agnostic (the enum carries no team).
  // A "set point" exists if EITHER side is one point from winning the current
  // set; it is a "match point" if that set win also clinches the match.
  let pointState = 'normal';
  if (!isMatchOver) {
    const target = targetFor(currentSet);
    const aAtSetPoint = isOnePointFromSet(curA, curB, target, winBy);
    const bAtSetPoint = isOnePointFromSet(curB, curA, target, winBy);
    if (aAtSetPoint || bAtSetPoint) {
      // Would winning the current set also win the match for that team?
      const aWouldClinch = aAtSetPoint && setsA + 1 >= setsToWin;
      const bWouldClinch = bAtSetPoint && setsB + 1 >= setsToWin;
      pointState = aWouldClinch || bWouldClinch ? 'matchPoint' : 'setPoint';
    }
  }

  return {
    currentSet,
    pointsA: curA,
    pointsB: curB,
    completedSets,
    setsA,
    setsB,
    isMatchOver,
    winner,
    pointState,
    servingTeam: deriveServingTeam(events, config.initialServer),
    sideSwitched,
  };
}
