// The common fixture for the kabaddi viewer exploration (brief: kabaddi-explore-common.md).
// Royals (red) v Strikers (blue), 2 x 20 min, club rules, Royals raid first. Every raid below is a
// real engine event applied in order (startRaid -> applyRaid), with raid starts spaced on a fake
// monotonic clock, so every number the viewer shows is what the engine produced. Nothing is typed in.
import { applyRaid, finish } from '../src/utils/kabaddiEngine.js';
import { callTimeUp, createKabaddiMatch, startNextRaid, startSecondHalf } from '../src/utils/kabaddiQuickMatch.js';

export const T0 = 1_800_000_000_000; // half 1 whistle (fake monotonic ms; the view gets `now` explicitly)
const HALF = 20 * 60 * 1000;
const H2 = T0 + HALF + 5 * 60 * 1000; // 5 min interval
const GAP = 31_400; // one raid start every ~31 s

export const SETUP = { format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] };

// e empty · tN N touches · tNb N touches + bonus · b bonus only · k tackled · so stepped out
const H1 = [
  't1', 'e', 'b', 't1', 'e', 'k', 't1b', 'e', 't2', 'k', // 1-10
  'e', 't1', 't1', 'e', 'k', 't1', 'e', 'k', 't2', 'e', // 11-20
  'k', 'e', 't2', 'so', 'e', 't1', 'e', 't1', 'k', 'e', 't1', 'e', // 21-32
];
const H2_TO_REST = [
  // half 2: Strikers raid first (on a carried do-or-die). Found by .kbv/search.mjs through the engine.
  't1', 'e', 't1', 'e', 't1', 'e', 't1', 't2', 'k', 't2', 'k', 'e', 't1b', 'e', 't1b',
];
const AFTER = ['k']; // the do-or-die raid: Royals raider tackled by 3 -> super tackle
const H2_REST = ['t1', 't1', 't3', 't2', 't3', 't2', 'b', 'e', 'e', 'e', 'e', 't1', 'k', 'e', 'e', 'e']; // .kbv/search-end.mjs

function event(code, id, raidId) {
  const base = { id, raidId };
  if (code === 'e') return { ...base, type: 'empty' };
  if (code === 'b') return { ...base, type: 'bonus', bonusBeforeContact: true };
  if (code === 'k') return { ...base, type: 'tackled' };
  if (code === 'so') return { ...base, type: 'selfOut', reason: 'Stepped out' };
  const m = /^t(\d)(b?)$/.exec(code);
  if (!m) throw new Error(`bad code ${code}`);
  return { ...base, type: 'touch', count: Number(m[1]), ...(m[2] ? { bonusAwarded: true, bonusBeforeContact: true } : {}) };
}

let seq = 0;
function play(match, codes, startAt, gap = GAP) {
  let { state } = match;
  codes.forEach((code, i) => {
    seq += 1;
    const at = startAt + i * gap;
    state = startNextRaid(state, { id: `r${seq}`, atMs: at });
    try {
      state = applyRaid(state, event(code, `c${seq}`, `r${seq}`));
    } catch (err) {
      throw new Error(`raid ${i + 1} of block (${code}), mat ${state.mat.map((x) => x.length).join('-')}: ${err.message}`);
    }
  });
  return { ...match, state };
}

/**
 * The match at one of the brief's moments, with the `now` the viewer reads its clocks at.
 * stages: allout (just after the half-1 all out), rest, raid, moment, half, end
 */
export function buildFixture(stage) {
  seq = 0;
  let m = createKabaddiMatch(SETUP);
  const allOutAt = 23; // raids into half 1 — the all out lands on this raid (checked in the print below)
  if (stage === 'allout') {
    m = play(m, H1.slice(0, allOutAt), T0);
    return { match: m, now: T0 + (allOutAt - 1) * GAP + 9_000 };
  }
  m = play(m, H1, T0);
  m = { ...m, state: callTimeUp(m.state, T0 + HALF) };
  if (stage === 'half') return { match: m, now: T0 + HALF + 60_000 };
  m = { ...m, state: startSecondHalf(m.state, H2) };
  m = play(m, H2_TO_REST, H2, 29_000);
  const rest = H2 + 440_000; // 12:40 left
  if (stage === 'rest') return { match: m, now: rest };
  if (stage === 'raid') {
    seq += 1;
    const state = startNextRaid(m.state, { id: `r${seq}`, atMs: rest + 3_000 });
    return { match: { ...m, state }, now: rest + 15_000 }; // raid clock 0:18
  }
  m = play(m, AFTER, rest + 3_000);
  if (stage === 'moment') return { match: m, now: rest + 22_000 };
  m = play(m, H2_REST, rest + 3_000 + GAP);
  m = { ...m, state: finish(callTimeUp(m.state, H2 + HALF)) };
  return { match: m, now: H2 + HALF + 90_000 };
}
