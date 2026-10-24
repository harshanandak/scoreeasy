// The common fixture, played raid by raid through the real engine (no hand-set numbers).
// Tokens: E empty, T<n> touch n, T<n>B touch n + bonus, B bonus, K tackled, S raider out.
import { applyRaid, startHalf, startRaid, timeUp } from '../src/utils/kabaddiEngine.js';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch.js';

export const SETUP = { format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] };
// Half 1 (Royals raid first, a raid every 45 s): ends 15–15 on an all out of Royals in raid 26.
export const H1 = 'T1 K E T1 K T2 E K T1 E T1 K E T1 T2 K T1 T1 K T1 T1B T2 K T1 E T1';
// Half 2 (Strikers raid first, a raid every 40 s): 24–21, mat 5–3, Royals on 2 empties at 12:40.
export const H2 = 'K T2 T2 T2B K T2 T1 E B E T1B';
// Raid 38 (Royals, do or die, 3 defenders) is tackled -> super tackle; then the rest of half 2.
export const H2_END = 'T1 K T1 E K E T2 K T1 E T1 E K T1 E T1 K';

export function ev(tok) {
  if (tok === 'E') return { type: 'empty' };
  if (tok === 'K') return { type: 'tackled' };
  if (tok === 'S') return { type: 'selfOut', reason: 'Stepped out' };
  if (tok === 'B') return { type: 'bonus', bonusBeforeContact: true };
  const m = /^T(\d)(B?)$/.exec(tok);
  return { type: 'touch', count: Number(m[1]), ...(m[2] ? { bonusAwarded: true, bonusBeforeContact: true } : {}) };
}

const play = (state, tokens, startMs, everyMs, tag) => tokens.trim().split(/\s+/).reduce((s, tok, i) => {
  const at = startMs + i * everyMs;
  const started = startRaid(s, { id: `${tag}r${i}`, atMs: at });
  return applyRaid(started, { id: `${tag}c${i}`, raidId: `${tag}r${i}`, expectedRevision: started.revision, ...ev(tok) });
}, state);

/** Times are built back from the moment of state 1 (`rest`): 12:40 left in half 2. */
export function build(rest) {
  const h2 = rest - 440000;
  const t0 = h2 - 1500000; // half 1 start; 20 min half + 5 min interval
  let match = createKabaddiMatch(SETUP);
  let s = startHalf(match.state, { atMs: t0 });
  s = play(s, H1, t0, 45000, 'a');
  s = timeUp(s); // the half clock ran out (it is frozen at 0:00)
  s = startHalf(s, { atMs: h2 });
  s = play(s, H2, h2, 40000, 'b');
  return { ...match, state: s };
}

export const RAID_START_OFFSET = 0;
export const scenes = {
  rest: (rest) => ({ match: build(rest), now: rest }),
  raid: (rest) => {
    const m = build(rest);
    return { match: { ...m, state: startRaid(m.state, { id: 'raid-38', atMs: rest }) }, now: rest + 12000 };
  },
  end: (rest) => {
    const m = build(rest);
    let s = play(m.state, 'K', rest, 40000, 'x');
    s = play(s, H2_END, rest + 40000, 40000, 'y');
    s = timeUp(s);
    return { match: { ...m, state: s }, now: rest - 440000 + 1200000 + 20000 };
  },
  half: (rest) => {
    const h2 = rest - 440000; const t0 = h2 - 1500000;
    let s = startHalf(createKabaddiMatch(SETUP).state, { atMs: t0 });
    s = timeUp(play(s, H1, t0, 45000, 'a'));
    return { match: { ...createKabaddiMatch(SETUP), state: s }, now: t0 + 1200000 + 60000 };
  },
};
