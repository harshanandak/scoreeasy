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
