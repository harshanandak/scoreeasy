import { cloneSetsSnapshot } from './cloneSetsSnapshot';

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
