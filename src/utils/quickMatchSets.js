import { cloneSetsSnapshot } from './cloneSetsSnapshot';
import { validateSingleSetScore } from './volleyballCalculations';

export function applySetPoint(sets, currentSet, team) {
  const nextSets = cloneSetsSnapshot(sets);
  const set = nextSets[currentSet];

  if (!set) return nextSets;

  if (team === 1) {
    set.score1 += 1;
  } else if (team === 2) {
    set.score2 += 1;
  } else {
    throw new Error(`Invalid team value: ${team}`);
  }

  return nextSets;
}

export function getSetWinRule({ format = {}, sportConfig = {}, currentSet = 0 } = {}) {
  const config = sportConfig.config || {};
  const customization = format.customization || {};
  const isDecider = (format.sets || 1) > 1 && currentSet === format.sets - 1;
  const target = isDecider && config.deciderPoints
    ? config.deciderPoints
    : (format.points || config.pointsPerSet || 25);

  return {
    target,
    winBy: customization.winBy || config.winBy || 2,
    maxPoints: customization.pointCap || config.maxPoints || null,
  };
}

export function isSetComplete(set, rule) {
  if (!set) return false;

  const max = Math.max(set.score1, set.score2);
  const min = Math.min(set.score1, set.score2);

  if (rule.maxPoints && max >= rule.maxPoints && max > min) return true;
  if (max < rule.target) return false;

  return max - min >= rule.winBy;
}

/** Next-point opportunities, in team order (independent of the board's side swap).
 * Probe the scorer's own completion predicates so caps and deciding targets cannot drift.
 * Single formats deliberately use their existing selected target and registry rules.
 */
export function getSetPointState({ format, sportConfig, currentSet = 0, score1, score2, setsWon1 = 0, setsWon2 = 0 }) {
  const bestOf = format.type === 'best-of';
  const setsToWin = bestOf ? Math.ceil(format.sets / 2) : 1;
  const rule = bestOf ? getSetWinRule({ format, sportConfig, currentSet }) : null;
  const complete = bestOf
    ? (a, b) => isSetComplete({ score1: a, score2: b }, rule)
    : (a, b) => validateSingleSetScore(a, b, format.target, sportConfig?.config?.winBy ?? 2, sportConfig?.config?.maxPoints ?? null);
  const setPoint = [];
  const matchPoint = [];
  if (setsWon1 >= setsToWin || setsWon2 >= setsToWin || complete(score1, score2)) return { setPoint, matchPoint };

  for (const team of [1, 2]) {
    if (complete(score1 + (team === 1 ? 1 : 0), score2 + (team === 2 ? 1 : 0))) {
      setPoint.push(team);
      if ((team === 1 ? setsWon1 : setsWon2) + 1 >= setsToWin) matchPoint.push(team);
    }
  }
  return { setPoint, matchPoint };
}

export function summarizeBestOfSets(sets = []) {
  const completedSets = sets.filter((set) => set.completed);
  const setsWon1 = completedSets.filter((set) => set.score1 > set.score2).length;
  const setsWon2 = completedSets.filter((set) => set.score2 > set.score1).length;
  const activeSet = sets.find((set) => !set.completed && (set.score1 > 0 || set.score2 > 0))
    || sets.find((set) => !set.completed)
    || { score1: 0, score2: 0 };

  return {
    completedSets,
    setsWon1,
    setsWon2,
    activeScore1: activeSet.score1 || 0,
    activeScore2: activeSet.score2 || 0,
  };
}

export function getBestOfResultScore(sets = [], { includeActiveWhenTied = false } = {}) {
  const summary = summarizeBestOfSets(sets);
  const useActiveScore = includeActiveWhenTied
    && summary.setsWon1 === summary.setsWon2
    && (summary.activeScore1 > 0 || summary.activeScore2 > 0);

  return {
    ...summary,
    score1: useActiveScore ? summary.activeScore1 : summary.setsWon1,
    score2: useActiveScore ? summary.activeScore2 : summary.setsWon2,
  };
}
