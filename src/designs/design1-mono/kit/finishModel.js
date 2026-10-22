// Finish (Kit S3, plan 2026-10-22 §9): one display model for every result screen, built from what
// the engines persisted. Pure, so each sport's truth is unit-tested away from the DOM. It never
// decides a sport rule itself: winners come from the persisted scores, cricket margins from
// cricketCalculations, set winners from the sets as stored.
import { ballsToOvers, getLimitedOversResult, getTestMatchCompletion } from '../../../utils/cricketCalculations';

const DASH = '–';

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * @typedef {object} FinishModel
 * @property {'win' | 'draw' | 'none'} outcome  win: one winner card; draw/none: no winner card
 * @property {'team1' | 'team2' | null} winnerSide
 * @property {string} headline   the winner's name, or "Match drawn" / "Match tied" / "Match abandoned"
 * @property {string | null} detail  one line under the name ("Took the last set 25–23", "Won by 3 wickets")
 * @property {{name: string, score: string, unit: string | null}} team1
 * @property {{name: string, score: string, unit: string | null}} team2
 * @property {Array<{key: string, label: string, score: string, side: 'team1' | 'team2' | null}>} chips
 *   per-set chips in board order (team 1 first), exactly as the board recorded them
 * @property {string} ariaSummary  one spoken sentence
 */

// A set as the board stored it: points (volleyball, badminton) or games (tennis), plus a tennis
// tiebreak decided on its points when the games are level.
function setChip(set, index) {
  const a = num(set.score1 ?? set.games1);
  const b = num(set.score2 ?? set.games2);
  let side = null;
  if (a !== b) side = a > b ? 'team1' : 'team2';
  else if (set.isTiebreak && num(set.tiebreakPoints1) !== num(set.tiebreakPoints2)) {
    side = num(set.tiebreakPoints1) > num(set.tiebreakPoints2) ? 'team1' : 'team2';
  }
  const tiebreak = set.isTiebreak && (set.tiebreakPoints1 != null || set.tiebreakPoints2 != null)
    ? ` (${num(set.tiebreakPoints1)}${DASH}${num(set.tiebreakPoints2)})`
    : '';
  return { key: `set-${index + 1}`, label: `Set ${index + 1}`, score: `${a}${DASH}${b}${tiebreak}`, side, a, b };
}

/** Sets that were played: completed, or with a score on them (a manual Finish mid-set). */
export function setChips(sets) {
  if (!Array.isArray(sets)) return [];
  return sets
    .map((set, index) => (set ? setChip(set, index) : null))
    .filter((chip, index) => chip && (sets[index].completed || chip.a > 0 || chip.b > 0))
    .map(({ key, label, score, side }) => ({ key, label, score, side }));
}

function lastSetLine(sets, winnerSide) {
  const played = Array.isArray(sets) ? sets.filter((s) => s && s.completed !== false) : [];
  const last = played[played.length - 1];
  if (!last) return null;
  const chip = setChip(last, 0);
  if (chip.side !== winnerSide) return null;
  // Games only: a tiebreak's points are on its set chip, and the line stays one phrase at 360.
  const [w, l] = winnerSide === 'team1' ? [chip.a, chip.b] : [chip.b, chip.a];
  return `Took the last set ${w}${DASH}${l}`;
}

function summary(model) {
  const { team1, team2 } = model;
  const scores = `${team1.name} ${team1.score}, ${team2.name} ${team2.score}.`;
  if (model.outcome !== 'win') return `${model.headline}. ${scores}`;
  return `${model.headline} won${model.detail ? `. ${model.detail}` : ''}. ${scores}`;
}

function finish(model) {
  return { ...model, ariaSummary: summary(model) };
}

function drawHeadline(winner) {
  if (winner === 'Tie' || winner === 'tie') return 'Match tied';
  return 'Match drawn';
}

/**
 * A quick match's saved result (MonoQuickMatch `finalizeMatch` entry).
 * @param {object} result  team1/team2 names, score1/score2 (sets won, points or goals), sets[],
 *   team1Score/team2Score for cricket, winner (a name, 'Draw' or 'Tie')
 * @param {{kind: 'sets' | 'goals' | 'cricket', unit?: string, maxWickets?: number}} options
 *   unit: the sport's scoring unit for a goals margin ('goal', 'point');
 *   maxWickets: the quick scorer's all-out count (team 1 always bats first in a quick match)
 * @returns {FinishModel}
 */
export function finishFromQuickResult(result, { kind, unit = 'point', maxWickets = 10 } = {}) {
  const r = result || {};
  const name1 = r.team1 || r.team1Name || 'Team 1';
  const name2 = r.team2 || r.team2Name || 'Team 2';

  if (kind === 'cricket' && r.format?.totalInnings === 4 && Array.isArray(r.innings)) {
    const teamScore = (teamId, name) => ({
      name,
      score: r.innings.filter(i => i.teamId === teamId && (num(i.balls) > 0 || num(i.runs) > 0 || num(i.wickets) > 0 || i.allOut || i.declared))
        .map(i => `${num(i.runs)}/${num(i.wickets)}`).join(' & ') || '0/0',
      unit: 'innings',
    });
    const team1 = teamScore(r.team1Id, name1);
    const team2 = teamScore(r.team2Id, name2);
    const nonTeamWinner = String(r.winner || '').toLowerCase();
    const verdict = getTestMatchCompletion(r.innings, r.currentInningsIndex ?? r.innings.length - 1,
      r.team1Id, r.team2Id, r.format);
    const winnerSide = nonTeamWinner === 'draw' || nonTeamWinner === 'tie' ? null
      : verdict?.winner === r.team1Id ? 'team1' : verdict?.winner === r.team2Id ? 'team2'
        : r.winner === name1 ? 'team1' : r.winner === name2 ? 'team2' : null;
    const tied = nonTeamWinner === 'tie' || (nonTeamWinner !== 'draw' && verdict?.winner === 'tie');
    return finish({
      outcome: winnerSide ? 'win' : 'draw', winnerSide,
      headline: winnerSide === 'team1' ? name1 : winnerSide === 'team2' ? name2 : tied ? 'Match tied' : 'Match drawn',
      detail: winnerSide ? r.winDesc || verdict?.desc || null : null,
      team1, team2, chips: [],
    });
  }

  if (kind === 'cricket' && r.team1Score && r.team2Score) {
    const t1 = r.team1Score;
    const t2 = r.team2Score;
    const team1 = { name: name1, score: `${num(t1.runs)}/${num(t1.wickets)}`, unit: `${ballsToOvers(num(t1.balls))} ov` };
    const team2 = { name: name2, score: `${num(t2.runs)}/${num(t2.wickets)}`, unit: `${ballsToOvers(num(t2.balls))} ov` };
    if (num(t1.runs) === num(t2.runs)) {
      return finish({ outcome: 'draw', winnerSide: null, headline: 'Match tied', detail: null, team1, team2, chips: [] });
    }
    const winnerSide = num(t1.runs) > num(t2.runs) ? 'team1' : 'team2';
    // The one cricket margin rule (runs when the side batting first wins, wickets when the chase
    // does). Its all-out count is players - 1, so hand it the quick scorer's own count.
    const detail = getLimitedOversResult({
      team1Id: 'team1', team2Id: 'team2', team1Score: t1, team2Score: t2,
      format: { players: maxWickets + 1 },
    }) || null;
    return finish({
      outcome: 'win', winnerSide, headline: winnerSide === 'team1' ? name1 : name2,
      detail, team1, team2, chips: [],
    });
  }

  const s1 = num(r.score1);
  const s2 = num(r.score2);
  const team1 = { name: name1, score: String(s1), unit: null };
  const team2 = { name: name2, score: String(s2), unit: null };
  const chips = kind === 'sets' ? setChips(r.sets) : [];
  if (r.winner === 'Draw' || r.winner === 'Tie' || s1 === s2) {
    return finish({ outcome: 'draw', winnerSide: null, headline: drawHeadline(r.winner), detail: null, team1, team2, chips });
  }
  const winnerSide = s1 > s2 ? 'team1' : 'team2';
  const detail = kind === 'sets'
    ? lastSetLine(r.sets, winnerSide)
    : `Won by ${plural(Math.abs(s1 - s2), unit)}`;
  return finish({
    outcome: 'win', winnerSide, headline: winnerSide === 'team1' ? name1 : name2,
    detail, team1, team2, chips,
  });
}

/**
 * A tournament sets match, from matchVerdict's output plus the stored sets (MonoMatchResult).
 * @param {object} verdict  matchVerdict() output (kind 'sets')
 * @param {{team1Name: string, team2Name: string, sets?: object[]}} context
 * @returns {FinishModel}
 */
export function finishFromVerdict(verdict, { team1Name = 'Team 1', team2Name = 'Team 2', sets } = {}) {
  const v = verdict || {};
  const [a = '0', b = '0'] = String(v.scoreLine || '').split(DASH).map((s) => s.trim());
  const team1 = { name: team1Name, score: a, unit: null };
  const team2 = { name: team2Name, score: b, unit: null };
  const chips = setChips(sets);
  if (v.status === 'abandoned') {
    return finish({ outcome: 'none', winnerSide: null, headline: 'Match abandoned', detail: null, team1, team2, chips });
  }
  if (!v.isDecided) {
    return finish({ outcome: 'draw', winnerSide: null, headline: v.headline || 'Match drawn', detail: null, team1, team2, chips });
  }
  return finish({
    outcome: 'win',
    winnerSide: v.winnerSide,
    headline: v.winnerName || (v.winnerSide === 'team1' ? team1Name : team2Name),
    detail: lastSetLine(sets, v.winnerSide),
    team1, team2, chips,
  });
}

/** "1h 12m", "18m", "45s"; null when nothing was timed. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(num(seconds)));
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}
