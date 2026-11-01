// k2 fixture: built only from real engine events through the board's own glue (no state surgery).
// Royals (0) v Strikers (1), 2 x 20 min, Royals raid first. The raid lists are the s2 exploration's
// (found by a count-only search over the engine rules) and the engine rejects anything illegal.
import { confirmRuling, createBoardMatch, startHalf, timeUp } from '../src/utils/kabaddiBoardModel.js';

const bonus = { bonusAwarded: true, bonusBeforeContact: true };
const EV = {
  E: { type: 'empty' }, B: { type: 'bonus', bonusBeforeContact: true }, K: { type: 'tackled' }, KB: { type: 'tackled', ...bonus },
  O: { type: 'selfOut', reason: 'Lost cant' },
  T1: { type: 'touch', count: 1 }, T2: { type: 'touch', count: 2 }, T3: { type: 'touch', count: 3 },
  TB1: { type: 'touch', count: 1, ...bonus }, TB2: { type: 'touch', count: 2, ...bonus },
};
const list = (s) => s.split(' ').map((t) => EV[t]);
export const HALF1 = list('K K TB1 T1 O T1 TB1 K K E T2 K K E K T1 K K T2 E T1 TB1 E T1');
export const HALF2 = list('T1 TB1 E K E B T3 KB K T3 K E K E T2');
export const AFTER = list('T1 E E T1 K E T2 T2 E E T1 K E T1 K T1 E E K E T1 E');

// Optional team lists from setup: Royals by name, Strikers by shirt number.
export const ROSTERS = [['Ravi', 'Arjun', 'Sunil', 'Pawan', 'Deepak', 'Naveen', 'Rahul'], ['4', '7', '9', '10', '11', '13', '21']];

const HALF_MS = 20 * 60 * 1000;
function play(match, raids, startAt, gap) {
  return raids.reduce((m, ruling, i) => confirmRuling(m, ruling, { atMs: startAt + i * gap }), match);
}
function firstHalf(h2Start, named) {
  let m = createBoardMatch({ halfMs: HALF_MS, names: ['Royals', 'Strikers'], colours: [undefined, undefined], rosters: named ? ROSTERS : [[], []] });
  const h1Start = h2Start - HALF_MS - 300000;
  m = { ...m, state: startHalf(m.state, { atMs: h1Start }) };
  m = play(m, HALF1, h1Start + 20000, 45000);
  m = { ...m, state: startHalf(timeUp(m.state), { atMs: h2Start }) };
  return m;
}

/** Rest: half 2, `leftMs` on the clock, Royals to raid (raid 40, do or die, super tackle on). */
export function buildRest(now, { named = false, leftMs = 760000 } = {}) {
  const h2Start = now - (HALF_MS - leftMs);
  return play(firstHalf(h2Start, named), HALF2, h2Start + 15000, Math.floor((HALF_MS - leftMs - 30000) / HALF2.length));
}

/** Full time: raid 40 tackled, the rest of half 2 played, time up at 0:00. */
export function buildEnd(now, { named = false } = {}) {
  const h2Start = now - HALF_MS - 4000;
  let m = play(firstHalf(h2Start, named), HALF2, h2Start + 15000, 27000);
  m = play(m, [EV.K, ...AFTER], h2Start + 15000 + HALF2.length * 27000, 34000);
  return { ...m, state: timeUp(m.state) };
}

/** Open: early in half 1, two raids played, every mat full, so Bonus and 3+ are both legal. */
export function buildOpen(now, { named = false } = {}) {
  let m = createBoardMatch({ halfMs: HALF_MS, names: ['Royals', 'Strikers'], colours: [undefined, undefined], rosters: named ? ROSTERS : [[], []] });
  const start = now - 150000;
  m = { ...m, state: startHalf(m.state, { atMs: start }) };
  return play(m, HALF1.slice(0, 2), start + 20000, 45000);
}
