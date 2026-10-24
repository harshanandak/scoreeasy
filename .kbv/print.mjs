// bun .kbv/print.mjs <stage> — the raid-by-raid log of a fixture stage, straight from the engine.
import { buildFixture } from './fixture.js';
import { isDoOrDie, isSuperTackleOn, remainingTime, result } from '../src/utils/kabaddiEngine.js';
import { matchTotals, raidLog, raidSummary } from '../src/utils/kabaddiQuickMatch.js';

const stage = process.argv[2] || 'rest';
const { match, now } = buildFixture(stage);
const { state } = match;
const names = state.teams.map((t) => t.name);
for (const e of raidLog(state).reverse()) {
  const sc = e.after.teams.map((t) => Object.values(t.score).reduce((a, b) => a + b, 0));
  console.log(String(e.raidNumber).padStart(2), `H${e.half}`, (raidSummary(e, names)).padEnd(40), sc.join('-'), 'mat', e.after.mat.map((x) => x.length).join('-'), 'streak', e.after.emptyStreak.join(','));
}
const s = state;
console.log({ stage, phase: s.phase, half: s.half, totals: matchTotals(match), mat: s.mat.map((x) => x.length), next: names[s.nextRaidTeam], streak: s.emptyStreak,
  doOrDie: isDoOrDie(s), superOn: isSuperTackleOn(s), halfLeft: (remainingTime(s, now) / 1000), raidLeft: s.activeRaid ? remainingTime(s, now, 'raid') / 1000 : null, breakdown: result(s).breakdown });
