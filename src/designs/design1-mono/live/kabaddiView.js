// Small shared helpers for the round 4 kabaddi viewer (words and labels only; every number and
// every rule outcome arrives from kabaddiLiveModel, which folds the engine's own log).
import { playerLabel } from '../../../utils/kabaddiLiveModel';

export const sideKey = (team) => (team === 0 ? 'a' : 'b');
export const halfName = (n) => (n === 1 ? '1st half' : '2nd half');
export const isEnded = (phase) => ['finished', 'finishReview'].includes(phase);
export const joinNames = (names) => names.join(', ');

/** Minutes into the half when the raid started, e.g. "2nd half · 6'". */
export const atMinute = (e, halfMs) => `${halfName(e.half)} · ${Math.floor(Math.max(0, halfMs - e.halfLeftMs) / 60000)}'`;

/** The raid's outcome in plain words. */
export function outcomeWords(e, names) {
  const def = names[1 - e.team];
  if (e.superTackle) return `Super tackle by ${def}`;
  if (e.outcome === 'tackled') return `Tackled by ${def}`;
  if (e.outcome === 'touch') return `${e.superRaid ? 'Super raid · ' : ''}Touched ${e.touches}${e.bonus ? ' + bonus' : ''}`;
  if (e.outcome === 'bonus') return 'Bonus point';
  if (e.outcome === 'empty') return 'Empty raid';
  if (e.outcome === 'selfOut') return 'Raider out of play';
  if (e.outcome === 'doOrDieFailure') return 'Do or die lost';
  return 'Referee ruling';
}

/** Players out because of this raid, by name: the defenders it took off, or the raider on a loss. */
export function playersOut(e, roster) {
  const defenders = e.lostSlots[1 - e.team].map((slot) => playerLabel(roster, slot));
  if (defenders.length) return defenders;
  const raiderLost = e.lostSlots[e.team].map((slot) => playerLabel(roster, slot));
  return raiderLost;
}

/** The side that scored the raid's points (null when nobody did). */
export function scorerOf(e) {
  if (e.points[0] === e.points[1]) return null;
  return e.points[0] > e.points[1] ? 0 : 1;
}

export const isMoment = (e) => e.superTackle || e.allOut !== null;

/** Up to three: every all out first, then the latest super tackles, in match order. */
export function turningPoints(story, n = 3) {
  const picks = story.filter(isMoment);
  if (picks.length <= n) return picks;
  const ranked = [...picks.filter((e) => e.allOut !== null), ...picks.filter((e) => e.allOut === null).reverse()];
  return ranked.slice(0, n).sort((a, b) => a.number - b.number);
}
