/**
 * matchVerdict — pure, engine-agnostic result summariser.
 *
 * Turns a completed match object into the plain-language verdict rendered by the
 * MonoMatchResult (FULL TIME) screen. It accepts the shapes the different sport
 * engines already produce (sets, goals, cricket) via a small normalized input,
 * and never touches the DOM, storage, or navigation so it is exhaustively
 * unit-testable.
 *
 * Input (all optional; the helper is defensive):
 *   {
 *     kind,        // 'sets' | 'goals' | 'cricket' — phrasing family
 *     team1,       // display name (defaults 'Team 1')
 *     team2,       // display name (defaults 'Team 2')
 *     winnerSide,  // 'team1' | 'team2' | 'draw' | 'tie' | 'none' — explicit winner
 *     status,      // 'completed' (default) | 'abandoned'
 *     score1,      // primary numeric tally for team1 (sets won / goals / runs)
 *     score2,      // primary numeric tally for team2
 *     sets,        // [{ score1, score2, completed }] for the per-set line score
 *     team1Score,  // cricket innings { runs, wickets, balls }
 *     team2Score,  // cricket innings { runs, wickets, balls }
 *     winDesc,     // cricket win description e.g. 'by 42 runs'
 *     unit,        // override for detailLabel ('sets' | 'goals' | 'runs' | 'points')
 *   }
 *
 * Output: { status, isDecided, isDraw, winnerSide, winnerName, headline,
 *           scoreLine, detailLabel, lineScore, ariaSummary }
 */

const EN_DASH = '–';

const UNIT_BY_KIND = {
  sets: 'sets',
  goals: 'goals',
  cricket: 'runs',
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Resolve winnerSide from an explicit value or by comparing primary scores.
function resolveWinner(match, s1, s2) {
  const explicit = match.winnerSide;
  if (explicit === 'team1' || explicit === 'team2' || explicit === 'none') return explicit;
  if (explicit === 'draw' || explicit === 'tie') return explicit;
  if (s1 > s2) return 'team1';
  if (s2 > s1) return 'team2';
  return 'none';
}

function completedSetsLineScore(sets) {
  if (!Array.isArray(sets)) return [];
  return sets
    .filter((s) => s && (s.completed || num(s.score1) > 0 || num(s.score2) > 0))
    .map((s) => `${num(s.score1)}${EN_DASH}${num(s.score2)}`);
}

function cricketInnings(name, score) {
  const runs = num(score?.runs);
  const wickets = num(score?.wickets);
  return `${name} ${runs}/${wickets}`;
}

// The cricket engines persist winDesc as a full phrase ("Won by 42 runs",
// "Won by 3 wickets", "Won by an innings and 20 runs"). The headline composes
// "<winner> won <phrase>", so strip a leading "won " to avoid the double-wrapped
// "<winner> won Won by ..."; a bare fragment ("by 42 runs") passes through.
function cricketWinPhrase(winDesc) {
  return String(winDesc).replace(/^won\s+/i, '');
}

// Sum a test-cricket innings array into a single team's run total, matched by
// teamId (the shape MonoCricketTestLiveScore persists: [{ teamId, runs, ... }]).
function inningsRuns(innings, teamId) {
  if (!Array.isArray(innings)) return 0;
  return innings
    .filter((i) => i && i.teamId === teamId)
    .reduce((acc, i) => acc + num(i.runs), 0);
}

// Sum a test-cricket innings array into a single team's wicket total.
function inningsWickets(innings, teamId) {
  if (!Array.isArray(innings)) return 0;
  return innings
    .filter((i) => i && i.teamId === teamId)
    .reduce((acc, i) => acc + num(i.wickets), 0);
}

// Per-team "Name runs/wickets" summary rows for the cricket line score, built
// from whichever shape the engine persisted (innings object, innings[] array,
// or a bare score1/score2 aggregate).
function cricketLineScore(m, team1, team2, s1, s2) {
  if (m.team1Score || m.team2Score) {
    return [cricketInnings(team1, m.team1Score), cricketInnings(team2, m.team2Score)];
  }
  if (Array.isArray(m.innings)) {
    return [
      `${team1} ${s1}/${inningsWickets(m.innings, m.team1Id)}`,
      `${team2} ${s2}/${inningsWickets(m.innings, m.team2Id)}`,
    ];
  }
  return [`${team1} ${s1}`, `${team2} ${s2}`];
}

// Resolve the two primary run tallies for a cricket match from whichever shape
// the engine actually persisted, in priority order:
//   1. team1Score/team2Score innings objects — MonoCricketLiveScore (limited overs)
//   2. an innings[] array keyed by teamId    — MonoCricketTestLiveScore (test)
//   3. an explicit score1/score2 aggregate   — cricket quick-match / generic
// The engines do NOT duplicate runs into score1/score2, so reading those alone
// gives 0–0 and a wrong verdict — this is the bug this helper fixes.
function cricketTotals(m) {
  if (m.team1Score || m.team2Score) {
    return [num(m.team1Score?.runs), num(m.team2Score?.runs)];
  }
  if (Array.isArray(m.innings)) {
    return [inningsRuns(m.innings, m.team1Id), inningsRuns(m.innings, m.team2Id)];
  }
  return [num(m.score1), num(m.score2)];
}

export function matchVerdict(match) {
  const m = match || {};
  const team1 = m.team1 || 'Team 1';
  const team2 = m.team2 || 'Team 2';
  const status = m.status === 'abandoned' ? 'abandoned' : 'completed';
  const kind = m.kind;
  // Cricket derives its primary tallies from the innings runs the engine
  // persisted; every other engine uses the primary score1/score2 tally.
  const [s1, s2] = kind === 'cricket' ? cricketTotals(m) : [num(m.score1), num(m.score2)];
  const detailLabel = m.unit || UNIT_BY_KIND[kind] || null;

  // Abandoned matches have no verdict regardless of any score present.
  if (status === 'abandoned') {
    return {
      status,
      isDecided: false,
      isDraw: false,
      winnerSide: 'none',
      winnerName: null,
      headline: 'Match abandoned',
      scoreLine: `${s1} ${EN_DASH} ${s2}`,
      detailLabel,
      lineScore: kind === 'cricket'
        ? cricketLineScore(m, team1, team2, s1, s2)
        : completedSetsLineScore(m.sets),
      ariaSummary: 'Match abandoned.',
    };
  }

  const rawWinner = resolveWinner(m, s1, s2);
  const isTie = rawWinner === 'tie';
  const isDraw = rawWinner === 'draw' || isTie;
  const winnerSide = isDraw ? 'draw' : rawWinner; // normalize 'tie' -> 'draw'
  const isDecided = winnerSide === 'team1' || winnerSide === 'team2';
  const winnerName = winnerSide === 'team1' ? team1 : winnerSide === 'team2' ? team2 : null;

  // Line score: per-set strings for sets engine, innings summary for cricket.
  const lineScore = kind === 'cricket'
    ? cricketLineScore(m, team1, team2, s1, s2)
    : completedSetsLineScore(m.sets);

  // Primary line: s1/s2 already hold the cricket innings runs when applicable.
  const scoreLine = `${s1} ${EN_DASH} ${s2}`;

  let headline;
  if (isTie) {
    headline = 'Match tied';
  } else if (isDraw) {
    headline = 'Match drawn';
  } else if (!isDecided) {
    headline = 'Full time';
  } else if (kind === 'cricket' && m.winDesc) {
    headline = `${winnerName} won ${cricketWinPhrase(m.winDesc)}`;
  } else if (kind === 'sets') {
    const winScore = Math.max(s1, s2);
    const loseScore = Math.min(s1, s2);
    headline = `${winnerName} win ${winScore}${EN_DASH}${loseScore}`;
  } else if (kind === 'goals') {
    headline = `${winnerName} win by ${Math.abs(s1 - s2)}`;
  } else if (kind === 'cricket') {
    const runsMargin = Math.abs(s1 - s2);
    headline = `${winnerName} won by ${runsMargin} runs`;
  } else {
    headline = `${winnerName} win`;
  }

  const ariaSummary = `${headline}. ${team1} ${s1}, ${team2} ${s2}.`;

  return {
    status,
    isDecided,
    isDraw,
    winnerSide,
    winnerName,
    headline,
    scoreLine,
    detailLabel,
    lineScore,
    ariaSummary,
  };
}
