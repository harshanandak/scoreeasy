// One-off: memoised DFS over half-2 raid sequences, every transition through the real engine,
// for one that reaches the brief's rest state (24-21, mat 5-3, Royals on 2 empties, one all out on Royals).
import { applyRaid } from '../src/utils/kabaddiEngine.js';
import { callTimeUp, createKabaddiMatch, startNextRaid, startSecondHalf } from '../src/utils/kabaddiQuickMatch.js';
import { SETUP, T0 } from './fixture.js';
import { readFileSync } from 'node:fs';
const src = readFileSync('.kbv/fixture.js', 'utf8');
const H1 = eval(src.match(/const H1 = (\[[\s\S]*?\]);/)[1]);
const ev = (c, id) => c === 'e' ? { id, type: 'empty' } : c === 'b' ? { id, type: 'bonus', bonusBeforeContact: true } : c === 'k' ? { id, type: 'tackled' } : c === 'so' ? { id, type: 'selfOut', reason: 'Stepped out' } : { id, type: 'touch', count: +c[1], ...(c[2] ? { bonusAwarded: true, bonusBeforeContact: true } : {}) };
let n = 0;
const step = (state, c, at) => { n++; return applyRaid(startNextRaid(state, { id: 'r' + n, atMs: at }), ev(c, 'c' + n)); };
let s = createKabaddiMatch(SETUP).state; let at = T0;
for (const c of H1) { s = step(s, c, at); at += 31400; }
s = callTimeUp(s, T0 + 1200000); s = startSecondHalf(s, T0 + 1500000);
const tot = (st) => st.teams.map((t) => Object.values(t.score).reduce((a, b) => a + b, 0));
const R = ['t1', 'e', 'k', 't2', 't1b', 'b'], S = ['t1', 'k', 'e', 't2', 't1b', 't3', 'b'];
const DEPTH = 15; const seen = new Set();
function dfs(st, d, path, ao) {
  const [a, b] = tot(st);
  if (a > 24 || b > 21 || (24 - a) + (21 - b) > (DEPTH - d) * 4) return null;
  const key = [d, a, b, st.mat[0].length, st.mat[1].length, st.emptyStreak.join(), ao].join('|');
  if (seen.has(key)) return null; seen.add(key);
  if (d === DEPTH) return (a === 24 && b === 21 && st.mat[0].length === 5 && st.mat[1].length === 3 && st.emptyStreak[0] === 2 && ao === 1) ? path : null;
  const raider = st.nextRaidTeam;
  const opts = raider === 0 ? (d >= 11 ? ['e'] : d === 9 ? R.filter((c) => c !== 'e') : R) : S;
  for (const c of opts) {
    let nx; try { nx = step(st, c, T0 + 1500000 + d * 29000); } catch { continue; }
    const e = nx.events.at(-1);
    const nao = ao + (e.effects.allOut.includes(0) ? 1 : 0) + (e.effects.allOut.includes(1) ? 9 : 0);
    if (nao > 1) continue;
    const r = dfs(nx, d + 1, [...path, c], nao); if (r) return r;
  }
  return null;
}
console.log(tot(s), s.mat.map((m) => m.length), s.emptyStreak);
console.log((dfs(s, 0, [], 0) || ['none']).map((c) => `'${c}'`).join(', '));
