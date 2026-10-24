// Replay a raid script through the engine and print each raid. Script tokens:
// E empty, T<n> touch n, T<n>B touch+bonus, B bonus, K tackled, S self out, HT half time.
import { createKabaddiState, startHalf, startRaid, applyRaid, timeUp, teamTotal, remainingTime, isSuperTackleOn, isDoOrDie } from '../src/utils/kabaddiEngine.js';
export function ev(tok) {
  if (tok === 'E') return { type: 'empty' };
  if (tok === 'K') return { type: 'tackled' };
  if (tok === 'S') return { type: 'selfOut', reason: 'Stepped out' };
  if (tok === 'B') return { type: 'bonus', bonusBeforeContact: true };
  const m = /^T(\d)(B?)$/.exec(tok);
  return { type: 'touch', count: +m[1], ...(m[2] ? { bonusAwarded: true, bonusBeforeContact: true } : {}) };
}
const script = process.argv[2].trim().split(/\s+/);
let gap = 45000; // ms per raid, start to start
let s = createKabaddiState({ halfMs: 1200000, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] });
let t = 0; s = startHalf(s, { atMs: t });
const N = ['R', 'S'];
script.forEach((tok, i) => {
  if (tok === 'HT') { s = timeUp(s); t = 1200000 + 1000; s = startHalf(s, { atMs: t }); gap = 40000; console.log('--- half 2'); return; }
  s = startRaid(s, { id: `r${i}`, atMs: t });
  s = applyRaid(s, { id: `c${i}`, raidId: `r${i}`, atMs: t + 20000, ...ev(tok) });
  t += gap;
  const e = s.events.at(-1);
  const left = remainingTime(s, t);
  console.log(`${String(e.raidNumber).padStart(2)} ${N[e.raidingTeam]} ${tok.padEnd(4)} ${e.outcome.padEnd(15)} ${s.teams.map(teamTotal).join('-').padEnd(6)} mat ${s.mat.map((m) => m.length).join('-')} streak ${s.emptyStreak.join('')} ${e.effects.allOut.length ? 'ALLOUT' : ''}${e.effects.awards.some((a) => a.category === 'superTackleExtra') ? 'SUPER' : ''} left ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`);
});
console.log('next', N[s.nextRaidTeam], 'DoD', isDoOrDie(s), 'superOn', isSuperTackleOn(s));
