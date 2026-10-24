import { describe, expect, it } from 'vitest';
import { applyRaid, finish } from './kabaddiEngine.js';
import { callTimeUp, createKabaddiMatch, startNextRaid, startSecondHalf } from './kabaddiQuickMatch.js';
import { engineBreakdown, halfStory, halfTimeScore, keyMoments, liveNow, pointsBreakdown, raidStory, raidWords } from './kabaddiLiveModel.js';

const SETUP = { format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] };
const T0 = 1_000_000;
let n = 0;
const ev = (code) => {
  if (code === 'e') return { type: 'empty' };
  if (code === 'k') return { type: 'tackled' };
  const m = /^t(\d)(b?)$/.exec(code);
  return { type: 'touch', count: Number(m[1]), ...(m[2] ? { bonusAwarded: true, bonusBeforeContact: true } : {}) };
};
function play(match, codes, at) {
  let { state } = match;
  for (const code of codes) {
    n += 1;
    state = startNextRaid(state, { id: `r${n}`, atMs: at });
    state = applyRaid(state, { id: `c${n}`, raidId: `r${n}`, ...ev(code) });
    at += 30_000;
  }
  return { ...match, state };
}

// Royals raid first. Royals' raider is tackled by 2 Strikers on raid 7 (a super tackle); Strikers'
// do-or-die raid 8 fails; raid 9 puts Strikers all out. The engine decides each of those.
const H1 = ['t2', 't1', 't2', 'e', 't2', 'e', 'k', 'e', 't2'];

describe('kabaddi live viewer model', () => {
  it('folds the points breakdown from the journal and agrees with the engine result', () => {
    const match = play(createKabaddiMatch(SETUP), H1, T0);
    const pts = pointsBreakdown(match);
    const engine = engineBreakdown(match);
    for (const t of [0, 1]) {
      expect(pts[t].raid).toBe(engine[t].raid);
      expect(pts[t].tackle).toBe(engine[t].tackle);
      expect(pts[t].allOut).toBe(engine[t].allOut);
      expect(pts[t].extras).toBe(engine[t].technical + engine[t].defenderOut);
    }
  });

  it('finds the super tackle and the all out as key moments with the score after each', () => {
    const match = play(createKabaddiMatch(SETUP), H1, T0);
    const story = raidStory(match);
    const kinds = keyMoments(match).map((m) => m.kind);
    expect(story.find((e) => e.superTackle)?.number).toBe(7);
    expect(story.find((e) => e.allOut !== null)?.number).toBe(9);
    expect(kinds).toEqual(expect.arrayContaining(['superTackle', 'allOut', 'doOrDieLost']));
    for (const m of keyMoments(match)) {
      if (m.kind === 'halfTime') continue;
      expect(m.score).toEqual(story.find((e) => e.number === Math.floor(m.raid)).score);
    }
  });

  it('reads the live situation (raid clock, do-or-die, super tackle on) from the engine', () => {
    let match = play(createKabaddiMatch(SETUP), ['t1', 'e', 'e', 'e'], T0);
    // Strikers: two empties in a row -> their next raid is do or die.
    expect(match.state.nextRaidTeam).toBe(0);
    match = play(match, ['e'], T0 + 120_000);
    const raiding = { ...match, state: startNextRaid(match.state, { id: 'live', atMs: T0 + 200_000 }) };
    const live = liveNow(raiding, T0 + 212_000);
    expect(live.raid.team).toBe(1);
    expect(live.raid.leftMs).toBe(18_000);
    expect(live.doOrDie).toBe(true);
    expect(live.totals).toEqual([1, 0]);
  });

  it('tells the half story and the half-time score after the break', () => {
    let match = play(createKabaddiMatch(SETUP), ['t1', 't1', 'e'], T0);
    match = { ...match, state: callTimeUp(match.state, T0 + 1_200_000) };
    const ht = halfTimeScore(match);
    match = { ...match, state: startSecondHalf(match.state, T0 + 1_500_000) };
    match = play(match, ['t2', 'e'], T0 + 1_500_000);
    match = { ...match, state: finish(callTimeUp(match.state, T0 + 2_700_000)) };
    const halves = halfStory(match);
    expect(halves.map((h) => h.half)).toEqual([1, 2]);
    expect(halves[0].score).toEqual(ht);
    expect(halves[0].points[0] + halves[1].points[0]).toBe(liveNow(match, T0 + 3_000_000).totals[0]);
  });

  it('words a tackle with the defenders who made it', () => {
    const match = play(createKabaddiMatch(SETUP), ['k'], T0);
    const words = raidWords(raidStory(match)[0], ['Royals', 'Strikers']);
    expect(words.headline).toBe('Strikers +1');
    expect(words.line).toBe('Royals raider was tackled by 7 Strikers defenders.');
  });
});
