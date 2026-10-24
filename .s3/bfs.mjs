import { applyRaid, startHalf, startRaid, timeUp, teamTotal } from '../src/utils/kabaddiEngine.js';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch.js';
const B = { bonusAwarded: true, bonusBeforeContact: true };
const parse = (c) => c === 'E' ? { type: 'empty' } : c === 'K' ? { type: 'tackled' } : c === 'B' ? { type: 'bonus', bonusBeforeContact: true } : c.endsWith('b') ? { type: 'touch', count: +c[0], ...B } : { type: 'touch', count: +c };
let n = 0;
const step = (s, c) => { n++; s = startRaid({ ...s, events: [], revision: 0 }, { id: 'r' + n, atMs: s.clock.anchorMonotonicMs }); return applyRaid(s, { id: 'c' + n, raidId: 'r' + n, ...parse(c) }); };
let s = createKabaddiMatch({ format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] }).state;
s = startHalf(s, { atMs: 0 });
for (const c of process.argv[2].split(' ')) s = step(s, c);
s = timeUp({ ...s, events: [], revision: 0 }); s = startHalf({ ...s, events: [], revision: 0 }, { atMs: 1 });
const L = +process.argv[3], target = process.argv[4].split('-').map(Number);
const opts = ['E', 'K', '1', '2', '3', '1b', '2b', 'B'];
const key = (x, ao) => [x.teams.map(teamTotal), x.mat.map((m) => m.length), x.emptyStreak, x.nextRaidTeam, ao].join('|');
let layer = new Map([[key(s, 99), { s: { ...s, events: [], revision: 0 }, path: [], ao: 99 }]]);
for (let d = 0; d < L; d++) {
  const nx = new Map();
  for (const { s: st, path, ao } of layer.values()) for (const c of opts) {
    let x; try { x = step(st, c); } catch { continue; }
    const a = x.events.at(-1).effects.allOut.length ? 0 : Math.min(ao + 1, 99);
    const t = x.teams.map(teamTotal); if (t[0] > target[0] || t[1] > target[1]) continue;
    const k = key(x, Math.min(a, 9)); if (!nx.has(k)) nx.set(k, { s: { ...x, events: [], revision: 0 }, path: [...path, c], ao: a });
  }
  layer = nx;
}
for (const { s: x, path, ao } of layer.values()) {
  const t = x.teams.map(teamTotal), m = x.mat.map((q) => q.length);
  if (t[0] === target[0] && t[1] === target[1] && m[0] === 5 && m[1] === 3 && x.emptyStreak[0] === 2 && x.nextRaidTeam === 0 && ao <= 6) console.log(ao, path.join(' '));
}
