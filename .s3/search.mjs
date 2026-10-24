import { applyRaid, startHalf, startRaid, timeUp, teamTotal } from '../src/utils/kabaddiEngine.js';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch.js';
const B = { bonusAwarded: true, bonusBeforeContact: true };
const parse = (c) => c === 'E' ? { type: 'empty' } : c === 'K' ? { type: 'tackled' } : c === 'B' ? { type: 'bonus', bonusBeforeContact: true } : c.endsWith('b') ? { type: 'touch', count: +c[0], ...B } : { type: 'touch', count: +c };
let n = 0;
const step = (s, c) => { n++; const t = 40000 * n; s = startRaid(s, { id: 'r' + n, atMs: t }); return applyRaid(s, { id: 'c' + n, raidId: 'r' + n, ...parse(c) }); };
let s = createKabaddiMatch({ format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] }).state;
s = startHalf(s, { atMs: 0 });
for (const c of process.argv[2].split(' ')) s = step(s, c);
s = timeUp(s); s = startHalf(s, { atMs: 40000 * (n + 1) });
const tail = process.argv[3].split(' ');
const opts = ['E', 'K', '1', '2', '1b', '2b', 'B', '3'];
const depth = +process.argv[4];
const found = [];
function dfs(st, path) {
  if (path.length === depth) {
    let x = st;
    try { for (const c of tail) x = step(x, c); } catch { return; }
    const tot = x.teams.map(teamTotal), mat = x.mat.map((m) => m.length);
    const ao = x.events.some((e, i) => i > x.events.length - tail.length - 1 && e.effects?.allOut.length);
    if (mat[0] === 5 && mat[1] === 3 && x.emptyStreak[0] === 2 && x.nextRaidTeam === 0 && ao) found.push(`${tot.join('-')} | ${path.join(' ')}`);
    return;
  }
  for (const c of opts) { let nx; try { nx = step(st, c); } catch { continue; } dfs(nx, [...path, c]); }
}
dfs(s, []);
const by = {}; for (const f of found) { const k = f.split(' |')[0]; (by[k] ??= []).push(f); }
for (const k of Object.keys(by).sort()) console.log(k, by[k].length, by[k].slice(0, 3).join(' || '));
