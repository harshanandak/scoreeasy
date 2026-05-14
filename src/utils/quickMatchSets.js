import { cloneSetsSnapshot } from './cloneSetsSnapshot';

export function applySetPoint(sets, currentSet, team) {
  const nextSets = cloneSetsSnapshot(sets);
  const set = nextSets[currentSet];

  if (!set) return nextSets;

  if (team === 1) {
    set.score1 += 1;
  } else {
    set.score2 += 1;
  }

  return nextSets;
}
