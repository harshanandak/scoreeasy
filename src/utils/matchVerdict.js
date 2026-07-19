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

export function matchVerdict(match) {
  const m = match || {};
  const team1 = m.team1 || 'Team 1';
  const team2 = m.team2 || 'Team 2';
  const status = m.status === 'abandoned' ? 'abandoned' : 'completed';
  const kind = m.kind;
  const s1 = num(m.score1);
  const s2 = num(m.score2);
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
        ? [cricketInnings(team1, m.team1Score), cricketInnings(team2, m.team2Score)]
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
    ? [cricketInnings(team1, m.team1Score), cricketInnings(team2, m.team2Score)]
    : completedSetsLineScore(m.sets);

  // Cricket primary line prefers the innings runs when available.
  const scoreLine = kind === 'cricket' && (m.team1Score || m.team2Score)
    ? `${num(m.team1Score?.runs)} ${EN_DASH} ${num(m.team2Score?.runs)}`
    : `${s1} ${EN_DASH} ${s2}`;

  let headline;
  if (isTie) {
    headline = 'Match tied';
  } else if (isDraw) {
    headline = 'Match drawn';
  } else if (!isDecided) {
    headline = 'Full time';
  } else if (kind === 'cricket' && m.winDesc) {
    headline = `${winnerName} won ${m.winDesc}`;
  } else if (kind === 'sets') {
    const winScore = Math.max(s1, s2);
    const loseScore = Math.min(s1, s2);
    headline = `${winnerName} win ${winScore}${EN_DASH}${loseScore}`;
  } else if (kind === 'goals') {
    headline = `${winnerName} win by ${Math.abs(s1 - s2)}`;
  } else if (kind === 'cricket') {
    const runsMargin = Math.abs(num(m.team1Score?.runs) - num(m.team2Score?.runs));
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
