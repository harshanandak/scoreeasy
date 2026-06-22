// Pure tennis scoring (point → game → set → match) over the shared
// `scoringEvents` stream (research §4.B — ATP/WTA/Grand Slam).
//
// DESIGN: mirrors volleyball.js. The engine OWNS all boundary detection. The
// event model's `appendPoint` carries `setsA/setsB` forward unchanged and
// accumulates `runningA/runningB` across the WHOLE match, so those stored
// snapshots cannot be trusted for per-game/per-set scores. Instead we replay the
// *surviving* point events (each undo cancels the most recent still-active
// point) and run a per-point state machine in a single pass. Undo — even across
// a game/set boundary — is correct for free, and `set_end`/`serve_change` rows
// are never treated as authoritative score.
//
// CRITICAL (research §4.B): PERSIST RAW INTEGER point counts (0,1,2,3,…). NEVER
// store the 15/30/40/AD display string — `pointLabel` derives it on demand.
//
// A tennis "point" is a single `appendPoint` for the point-winner. Serve is
// stored via `serve_change` events; when absent we fall back to
// `config.initialServer`, else 'A'. Server otherwise alternates each game, with
// a SPECIAL rotation inside a tiebreak (1 point, then every 2).

/**
 * Format presets (research §4.B table). Each preset drives every win condition.
 *   - setsToWin: sets needed to win the match (best of setsToWin*2-1).
 *   - tiebreakTo: tiebreak target for a normal set 6-6 (win-by-2).
 *   - decidingTiebreakTo: tiebreak target when the 6-6 tiebreak is in the
 *     deciding set (Grand Slam = 10). The deciding set is still games-to-6.
 *   - noAd: game is won at 4 points; at 3-3 the next point ("deciding point")
 *     decides the game (win-by-1).
 *   - finalSetTiebreak: the deciding set uses a 6-6 tiebreak (vs advantage set).
 *   - matchTiebreakTo: when set, the deciding set is REPLACED by a single match
 *     tiebreak from 0-0 to this target (win-by-2) — Doubles.
 */
export const TENNIS_PRESETS = Object.freeze({
  standard: Object.freeze({
    setsToWin: 2,
    tiebreakTo: 7,
    decidingTiebreakTo: 7,
    noAd: false,
    finalSetTiebreak: true,
  }),
  mensGrandSlam: Object.freeze({
    setsToWin: 3,
    tiebreakTo: 7,
    decidingTiebreakTo: 10,
    noAd: false,
    finalSetTiebreak: true,
  }),
  doubles: Object.freeze({
    setsToWin: 2,
    tiebreakTo: 7,
    decidingTiebreakTo: 7,
    noAd: true,
    finalSetTiebreak: true,
    matchTiebreakTo: 10,
  }),
});

const DEFAULT_CONFIG = TENNIS_PRESETS.standard;

const GAMES_PER_SET = 6; // games needed (win-by-2) to take a normal set
const SET_WIN_BY = 2;

/**
 * Point mapping — pure selector, never persisted (research §4.B pseudocode).
 *
 * @param {number} myPts
 * @param {number} oppPts
 * @param {{ inTiebreak?: boolean, noAd?: boolean }} [opts]
 * @returns {'0'|'15'|'30'|'40'|'AD'|string}
 */
export function pointLabel(myPts, oppPts, { inTiebreak = false } = {}) {
  if (inTiebreak) return String(myPts);
  const ladder = ['0', '15', '30', '40'];
  if (myPts < 3 || oppPts < 3) return ladder[myPts] ?? '40';
  if (myPts === oppPts) return '40'; // deuce
  if (myPts === oppPts + 1) return 'AD';
  return '40';
}

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
    if (event.type === 'point') stack.push(event);
    else if (event.type === 'undo') stack.pop();
    // set_end | serve_change | timeout | correction | note: no point effect.
  }
  return stack;
}

/**
 * Initial server for game 1 — the team carried by the most recent `serve_change`
 * event (preferring `servingAfter`, falling back to `team`), else
 * `config.initialServer`, else 'A'. Never inferred from the last scorer.
 *
 * @param {ReadonlyArray<object>} events
 * @param {string|null|undefined} initialServer
 * @returns {'A'|'B'}
 */
function deriveInitialServer(events, initialServer) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === 'serve_change') {
      return events[i].servingAfter ?? events[i].team ?? 'A';
    }
  }
  return initialServer ?? 'A';
}

const other = (team) => (team === 'A' ? 'B' : 'A');

/** True when a NORMAL game is won at (my, opp) under the given ad rule. */
function isGameWon(my, opp, noAd) {
  if (noAd) return my >= 4 && my > opp; // win at 4 points, win-by-1 at 3-3
  return my >= 4 && my - opp >= 2;
}

/** True when scoring ONE more point wins a normal game for `my`. */
function isOneFromGame(my, opp, noAd) {
  return isGameWon(my + 1, opp, noAd);
}

/** True when a tiebreak is won at (my, opp) for target `to` (win-by-2). */
function isTiebreakWon(my, opp, to) {
  return my >= to && my - opp >= 2;
}

/** True when scoring ONE more point wins a tiebreak for `my`. */
function isOneFromTiebreak(my, opp, to) {
  return isTiebreakWon(my + 1, opp, to);
}

/**
 * Server inside a tiebreak. `firstServer` served the FIRST tiebreak point;
 * thereafter serve switches after 1 point, then every 2. With pointsPlayed = the
 * number of points already completed in the tiebreak, the server of the NEXT
 * point is `firstServer` when floor((pointsPlayed+1)/2) is even, else the other.
 *
 * Sequence for firstServer=A: A, B,B, A,A, B,B, …
 *
 * @param {'A'|'B'} firstServer
 * @param {number} pointsPlayed
 * @returns {'A'|'B'}
 */
function tiebreakServer(firstServer, pointsPlayed) {
  const flips = Math.floor((pointsPlayed + 1) / 2) % 2;
  return flips === 0 ? firstServer : other(firstServer);
}

/**
 * Derives full tennis match state from the event stream in one O(n) pass.
 *
 * @param {ReadonlyArray<object>} events
 * @param {object} [config] one of TENNIS_PRESETS plus optional `initialServer`.
 * @returns {{
 *   players: ['A','B'],
 *   sets: Array<{ a: number, b: number, tbA?: number, tbB?: number }>,
 *   currentSet: { gamesA: number, gamesB: number },
 *   currentGame: { ptsA: number, ptsB: number, labelA: string, labelB: string, inTiebreak: boolean },
 *   setsWonA: number, setsWonB: number,
 *   isMatchOver: boolean, winner: 'A'|'B'|null,
 *   server: 'A'|'B',
 *   statusToken: 'normal'|'deuce'|'adIn'|'adOut',
 *   isBreakPoint: boolean, isSetPoint: boolean, isMatchPoint: boolean,
 * }}
 */
export function tennisState(events = [], config = {}) {
  const setsToWin = config.setsToWin ?? DEFAULT_CONFIG.setsToWin;
  const tiebreakTo = config.tiebreakTo ?? DEFAULT_CONFIG.tiebreakTo;
  const decidingTiebreakTo = config.decidingTiebreakTo ?? DEFAULT_CONFIG.decidingTiebreakTo;
  const noAd = config.noAd ?? DEFAULT_CONFIG.noAd;
  const matchTiebreakTo = config.matchTiebreakTo; // undefined unless a match-TB preset
  const totalSets = setsToWin * 2 - 1; // best-of-N

  const initialServer = deriveInitialServer(events, config.initialServer);

  const sets = [];
  let setsWonA = 0;
  let setsWonB = 0;
  let gamesA = 0;
  let gamesB = 0;
  let ptsA = 0;
  let ptsB = 0;
  let isMatchOver = false;
  let winner = null;

  // Per-game serve bookkeeping. `gamesPlayedTotal` counts completed games across
  // the whole match so serve alternates correctly across set boundaries. A
  // tiebreak counts as ONE game for that alternation. `tbFirstServer` is the
  // server of the first tiebreak point (the player due to serve that game).
  let gamesPlayedTotal = 0;
  let tbFirstServer = null;

  // Is the deciding set a single match tiebreak (Doubles)?
  const decidingSetIndex = totalSets - 1; // 0-based index of the last possible set
  const matchTiebreakActive = () =>
    matchTiebreakTo != null && sets.length === decidingSetIndex;

  // Is the current set's 6-6 the deciding set (for tiebreak target selection)?
  const isDecidingSet = () => sets.length === decidingSetIndex;

  // Current game's serving team, computed from completed-game parity.
  const gameServer = () =>
    gamesPlayedTotal % 2 === 0 ? initialServer : other(initialServer);

  const inTiebreak = () => {
    if (matchTiebreakActive()) return true;
    return gamesA === GAMES_PER_SET && gamesB === GAMES_PER_SET;
  };

  const tiebreakTarget = () =>
    matchTiebreakActive() ? matchTiebreakTo : isDecidingSet() ? decidingTiebreakTo : tiebreakTo;

  // Close the current set, recording its score (+ tiebreak mini-score), advance.
  const closeSet = (tbA, tbB) => {
    const setWinner = gamesA > gamesB || (tbA != null && tbA > tbB) ? 'A' : 'B';
    const record = { a: gamesA, b: gamesB };
    if (tbA != null) {
      record.tbA = tbA;
      record.tbB = tbB;
    }
    sets.push(record);
    if (setWinner === 'A') setsWonA += 1;
    else setsWonB += 1;

    if (setsWonA >= setsToWin || setsWonB >= setsToWin) {
      isMatchOver = true;
      winner = setWinner;
    }
    gamesA = 0;
    gamesB = 0;
    tbFirstServer = null;
  };

  for (const event of survivingPoints(events)) {
    if (isMatchOver) break; // ignore stray points after the match is decided

    const team = event.team;
    const tb = inTiebreak();

    if (tb && tbFirstServer === null) {
      // First point of this tiebreak: lock who served it (the due game server).
      tbFirstServer = gameServer();
    }

    if (team === 'A') ptsA += 1;
    else if (team === 'B') ptsB += 1;

    if (tb) {
      const to = tiebreakTarget();
      if (isTiebreakWon(ptsA, ptsB, to)) {
        const finalA = ptsA;
        const finalB = ptsB;
        if (matchTiebreakActive()) {
          // Match tiebreak: no games — the tiebreak IS the deciding set.
          ptsA = 0;
          ptsB = 0;
          closeSet(finalA, finalB);
        } else {
          // Set tiebreak: winner takes the set 7-6 (games become 7-6).
          if (ptsA > ptsB) gamesA += 1;
          else gamesB += 1;
          ptsA = 0;
          ptsB = 0;
          gamesPlayedTotal += 1; // the tiebreak counts as one game
          closeSet(finalA, finalB);
        }
      }
    } else {
      const myPts = team === 'A' ? ptsA : ptsB;
      const oppPts = team === 'A' ? ptsB : ptsA;
      if (isGameWon(myPts, oppPts, noAd)) {
        if (team === 'A') gamesA += 1;
        else gamesB += 1;
        ptsA = 0;
        ptsB = 0;
        gamesPlayedTotal += 1;

        // Did that game close the set? (6 games, win-by-2; no cap below 6-6.)
        const setOver =
          (gamesA >= GAMES_PER_SET && gamesA - gamesB >= SET_WIN_BY) ||
          (gamesB >= GAMES_PER_SET && gamesB - gamesA >= SET_WIN_BY);
        if (setOver) closeSet();
      }
    }
  }

  // ── Derive presentation + pressure flags from the POST-point snapshot ────────
  const tbNow = inTiebreak();
  const labelA = pointLabel(ptsA, ptsB, { inTiebreak: tbNow });
  const labelB = pointLabel(ptsB, ptsA, { inTiebreak: tbNow });

  // Server: inside a tiebreak use the special rotation, else game parity.
  let server;
  if (tbNow) {
    const first = tbFirstServer ?? gameServer();
    server = tiebreakServer(first, ptsA + ptsB);
  } else {
    server = gameServer();
  }

  // statusToken — server-relative, only meaningful in a normal game ≥3-3.
  let statusToken = 'normal';
  if (!isMatchOver && !tbNow && ptsA >= 3 && ptsB >= 3) {
    if (ptsA === ptsB) statusToken = 'deuce';
    else {
      const leader = ptsA > ptsB ? 'A' : 'B';
      statusToken = leader === server ? 'adIn' : 'adOut';
    }
  }

  // Pressure flags from the post-point state.
  let isBreakPoint = false;
  let isSetPoint = false;
  let isMatchPoint = false;
  if (!isMatchOver) {
    const to = tiebreakTarget();

    // Would the named team, winning the next point, also win the current set?
    const winsSet = (team) => {
      if (tbNow) {
        const my = team === 'A' ? ptsA : ptsB;
        const opp = team === 'A' ? ptsB : ptsA;
        return isOneFromTiebreak(my, opp, to); // tiebreak point => set
      }
      const my = team === 'A' ? ptsA : ptsB;
      const opp = team === 'A' ? ptsB : ptsA;
      if (!isOneFromGame(my, opp, noAd)) return false;
      const ng = team === 'A' ? gamesA + 1 : gamesB + 1;
      const og = team === 'A' ? gamesB : gamesA;
      return ng >= GAMES_PER_SET && ng - og >= SET_WIN_BY; // that game closes the set
    };

    const aSetPoint = winsSet('A');
    const bSetPoint = winsSet('B');
    isSetPoint = aSetPoint || bSetPoint;

    const aWouldClinch = aSetPoint && setsWonA + 1 >= setsToWin;
    const bWouldClinch = bSetPoint && setsWonB + 1 >= setsToWin;
    isMatchPoint = aWouldClinch || bWouldClinch;

    // Break point: the RECEIVER is one point from winning a NORMAL game.
    if (!tbNow) {
      const receiver = other(server);
      const my = receiver === 'A' ? ptsA : ptsB;
      const opp = receiver === 'A' ? ptsB : ptsA;
      isBreakPoint = isOneFromGame(my, opp, noAd);
    }
  }

  return {
    players: ['A', 'B'],
    sets,
    currentSet: { gamesA, gamesB },
    currentGame: { ptsA, ptsB, labelA, labelB, inTiebreak: tbNow },
    setsWonA,
    setsWonB,
    isMatchOver,
    winner,
    server,
    statusToken,
    isBreakPoint,
    isSetPoint,
    isMatchPoint,
  };
}
