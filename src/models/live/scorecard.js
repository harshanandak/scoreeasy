// Generic, sport-agnostic scorecard derivations (research §4.E).
//
// Pure selectors over the shared `scoringEvents` stream. They give an "official
// broadcast feel" to ANY +1/+N game — including custom/silly ones — without any
// sport-specific box score.
//
// DESIGN: every metric is derived from the stored running-total *trajectory* —
// the delta of (runningA, runningB) between consecutive events — NOT by
// re-summing `value`. Because an undo event is just a row whose running totals
// step backwards, this makes undo/correction automatically correct and keeps
// each selector a single O(n) pass. Selectors never import the event-model
// writers; they trust the totals already stored on each row.

/**
 * @typedef {object} Step
 * @property {number} a   running total for team A after this point
 * @property {number} b   running total for team B after this point
 * @property {number} da  change in A's total at this point (>= 0)
 * @property {number} db  change in B's total at this point (>= 0)
 * @property {number|null} at  point timestamp, if any
 * @property {object} event the source event
 */

// UNDO POLICY (deliberate, see design §3.6): summary stats describe the actual
// contested state of the match, so a point reversed by an undo is treated as if
// it never happened — its transient lead/tie/run is NOT counted. We therefore
// derive the trajectory over the set of *surviving* point events (each undo
// cancels the most recent still-active point), not the raw row-by-row running
// totals (which include undo-induced transients). The same surviving-point rule
// governs leadChanges, timesTied, largestLead, biggestRun and currentRun.

/**
 * Resolves the point events that survive after applying every undo. Each undo
 * cancels the most recent still-active point (matching the event model). Returns
 * the surviving points in original order.
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
      stack.pop(); // cancel the most recent still-active point
    }
    // set_end | serve_change | timeout | correction | note: no point effect.
  }
  return stack;
}

/**
 * Walks the surviving points once, producing the running-total trajectory over
 * the net (post-undo) score. Each step carries the post-point totals and the
 * per-point delta (always >= 0 for a surviving point).
 *
 * @param {ReadonlyArray<object>} events
 * @returns {Step[]}
 */
function trajectory(events) {
  const steps = [];
  let a = 0;
  let b = 0;
  for (const event of survivingPoints(events)) {
    const value = Number(event.value ?? 0);
    const da = event.team === 'A' ? value : 0;
    const db = event.team === 'B' ? value : 0;
    a += da;
    b += db;
    steps.push({
      a,
      b,
      da,
      db,
      at: typeof event.at === 'number' ? event.at : null,
      event,
    });
  }
  return steps;
}

/** sign of a number: -1, 0, or 1. */
function sign(n) {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/** Leader label for a pair of totals; null when tied. */
function leaderOf(a, b) {
  if (a > b) return 'A';
  if (b > a) return 'B';
  return null;
}

/**
 * Broadcast-style header stats over the event stream (research §4.E).
 *
 * @param {ReadonlyArray<object>} events
 * @returns {{
 *   leader: 'A'|'B'|null, margin: number, score: { a: number, b: number },
 *   leadChanges: number, timesTied: number,
 *   largestLead: { team: 'A'|'B'|null, value: number, at: number|null },
 *   biggestRun: { team: 'A'|'B'|null, len: number },
 *   scoringRatePerMin: number,
 *   lastScore: { team: 'A'|'B', value: number }|null,
 * }}
 */
export function statHeader(events) {
  const steps = trajectory(events);

  if (steps.length === 0) {
    return {
      leader: null,
      margin: 0,
      score: { a: 0, b: 0 },
      leadChanges: 0,
      timesTied: 0,
      largestLead: { team: null, value: 0, at: null },
      biggestRun: { team: null, len: 0 },
      scoringRatePerMin: 0,
      lastScore: null,
    };
  }

  let leadChanges = 0;
  let timesTied = 0;
  let lastNonZeroSign = 0;

  const largestLead = { team: null, value: 0, at: null };
  const biggestRun = { team: null, len: 0 };
  let runTeam = null;
  let runLen = 0;

  let lastScore = null;
  let totalPoints = 0;
  let firstAt = null;
  let lastAt = null;

  // Every step is a surviving (post-undo) point with a positive delta.
  for (const step of steps) {
    const team = step.da > 0 ? 'A' : 'B';
    const magnitude = step.da > 0 ? step.da : step.db;

    lastScore = { team, value: magnitude };
    totalPoints += magnitude;
    if (step.at !== null) {
      if (firstAt === null) firstAt = step.at;
      lastAt = step.at;
    }

    // lead changes — compare against the last *non-zero* lead sign so a pass
    // through a tie is not itself a change.
    const currentSign = sign(step.a - step.b);
    if (currentSign === 0) {
      timesTied += 1;
    } else if (lastNonZeroSign !== 0 && currentSign !== lastNonZeroSign) {
      leadChanges += 1;
    }
    if (currentSign !== 0) lastNonZeroSign = currentSign;

    // largest lead (strict greater so the earliest occurrence wins ties).
    const leadValue = Math.abs(step.a - step.b);
    if (leadValue > largestLead.value) {
      largestLead.value = leadValue;
      largestLead.team = step.a > step.b ? 'A' : 'B';
      largestLead.at = step.at;
    }

    // biggest run — consecutive unanswered points by one team, measured in
    // points (so +N values accumulate); resets on opponent score.
    if (team === runTeam) {
      runLen += magnitude;
    } else {
      runTeam = team;
      runLen = magnitude;
    }
    if (runLen > biggestRun.len) {
      biggestRun.len = runLen;
      biggestRun.team = runTeam;
    }
  }

  const finalStep = steps[steps.length - 1];
  const a = finalStep.a;
  const b = finalStep.b;
  const spanMs = firstAt !== null && lastAt !== null ? lastAt - firstAt : 0;
  const scoringRatePerMin = spanMs > 0 ? totalPoints / (spanMs / 60000) : 0;

  return {
    leader: leaderOf(a, b),
    margin: Math.abs(a - b),
    score: { a, b },
    leadChanges,
    timesTied,
    largestLead,
    biggestRun,
    scoringRatePerMin,
    lastScore,
  };
}

/**
 * Manufactured line-score: buckets scoring into N segments by equal time when
 * usable timestamps exist (span > 0), else by equal event count. ALWAYS reports
 * how it segmented via `caption`.
 *
 * @param {ReadonlyArray<object>} events
 * @param {{ segments?: number }} [options]
 * @returns {{
 *   mode: 'time'|'count', caption: string,
 *   rows: Array<{ team: 'A'|'B', perSegment: number[], total: number }>,
 * }}
 */
export function segmentSummary(events, { segments = 4 } = {}) {
  const count = Math.max(1, Math.floor(segments));
  const steps = trajectory(events).filter(s => s.da > 0 || s.db > 0); // real points only

  const perA = new Array(count).fill(0);
  const perB = new Array(count).fill(0);

  if (steps.length === 0) {
    return {
      mode: 'count',
      caption: `Auto-segmented into ${count} equal-count periods`,
      rows: [
        { team: 'A', perSegment: perA, total: 0 },
        { team: 'B', perSegment: perB, total: 0 },
      ],
    };
  }

  const times = steps.map(s => s.at);
  const hasTimes = times.every(t => t !== null);
  const start = hasTimes ? times[0] : 0;
  const end = hasTimes ? times[times.length - 1] : 0;
  const span = end - start;
  const useTime = hasTimes && span > 0;

  steps.forEach((step, index) => {
    let bucket;
    if (useTime) {
      // clamp the final-timestamp event into the last bucket.
      bucket = Math.min(count - 1, Math.floor(((step.at - start) / span) * count));
    } else {
      bucket = Math.min(count - 1, Math.floor((index / steps.length) * count));
    }
    const magnitude = step.da > 0 ? step.da : step.db;
    if (step.da > 0) perA[bucket] += magnitude;
    else perB[bucket] += magnitude;
  });

  return {
    mode: useTime ? 'time' : 'count',
    caption: useTime
      ? `Auto-segmented into ${count} equal-time periods`
      : `Auto-segmented into ${count} equal-count periods`,
    rows: [
      { team: 'A', perSegment: perA, total: perA.reduce((sum, n) => sum + n, 0) },
      { team: 'B', perSegment: perB, total: perB.reduce((sum, n) => sum + n, 0) },
    ],
  };
}

/**
 * The current scoring run: consecutive points by one team since the last
 * opponent score or tie, measured in points (so +N values accumulate).
 *
 * @param {ReadonlyArray<object>} events
 * @returns {{ team: 'A'|'B'|null, len: number }}
 */
export function currentRun(events) {
  const steps = trajectory(events).filter(s => s.da > 0 || s.db > 0);
  let team = null;
  let len = 0;
  for (const step of steps) {
    const stepTeam = step.da > 0 ? 'A' : 'B';
    const magnitude = step.da > 0 ? step.da : step.db;
    if (stepTeam === team) {
      len += magnitude;
    } else {
      team = stepTeam;
      len = magnitude;
    }
  }
  return { team, len };
}

/**
 * Proportional leader strip — each team's share of total points, plus the
 * leader and margin. Shares default to 0.5/0.5 on an empty/zero stream.
 *
 * @param {ReadonlyArray<object>} events
 * @returns {{ leaderTeam: 'A'|'B'|null, aShare: number, bShare: number, margin: number }}
 */
export function leaderStrip(events) {
  const steps = trajectory(events);
  const final = steps.length === 0 ? { a: 0, b: 0 } : steps[steps.length - 1];
  const total = final.a + final.b;

  if (total <= 0) {
    return { leaderTeam: null, aShare: 0.5, bShare: 0.5, margin: 0 };
  }

  return {
    leaderTeam: leaderOf(final.a, final.b),
    aShare: final.a / total,
    bShare: final.b / total,
    margin: Math.abs(final.a - final.b),
  };
}

/**
 * The live differential hero value — leader and the absolute point gap.
 *
 * @param {ReadonlyArray<object>} events
 * @returns {{ leaderTeam: 'A'|'B'|null, value: number }}
 */
export function differential(events) {
  const steps = trajectory(events);
  const final = steps.length === 0 ? { a: 0, b: 0 } : steps[steps.length - 1];
  return { leaderTeam: leaderOf(final.a, final.b), value: Math.abs(final.a - final.b) };
}
