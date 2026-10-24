// One-off: memoised DFS (real engine transitions) from the super tackle to full time: Strikers win
// 33-31 with one more all out (on Royals) and no all out on Strikers.
import { applyRaid } from '../src/utils/kabaddiEngine.js';
import { startNextRaid } from '../src/utils/kabaddiQuickMatch.js';
import { buildFixture } from './fixture.js';
const ev = (c, id) => c === 'e' ? { id, type: 'empty' } : c === 'b' ? { id, type: 'bonus', bonusBeforeContact: true } : c === 'k' ? { id, type: 'tackled' } : { id, type: 'touch', count: +c[1], ...(c[2] ? { bonusAwarded: true, bonusBeforeContact: true } : {}) };
let n = 0;
const { match, now } = buildFixture('moment');
const step = (state, c, d) => { n++; return applyRaid(startNextRaid(state, { id: 'x' + n, atMs: now + 20000 + d * 31400 }), ev(c, 'y' + n)); };
const tot = (st) => st.teams.map((t) => Object.values(t.score).reduce((a, b) => a + b, 0));
const OPTS = ['t1', 'e', 'k', 't2', 'b', 't1b', 't3'];
const DEPTH = 16; const T = [31, 33]; const seen = new Set();
function dfs(st, d, path, ao) {
  const [a, b] = tot(st);
  if (a > T[0] || b > T[1] || (T[0] - a) + (T[1] - b) > (DEPTH - d) * 3) return null;
  const key = [d, a, b, st.mat[0].length, st.mat[1].length, st.emptyStreak.join(), ao].join('|');
  if (seen.has(key)) return null; seen.add(key);
  if (d === DEPTH) return (a === T[0] && b === T[1] && ao === 1) ? path : null;
  let x = (d * 7919 + a * 31 + b * 17) % 7; const opts = OPTS.map((_, i) => OPTS[(i + x + d) % OPTS.length]);
  if (d % 3 === 0) opts.reverse();
  for (const c of opts) {
    let nx; try { nx = step(st, c, d); } catch { continue; }
    const e = nx.events.at(-1);
    if (e.outcome === 'doOrDieFailure') continue;
    const [na, nb] = tot(nx);
    if (d >= 10 && na > nb + 1) continue; // Strikers in front or close late
    const nao = ao + (e.effects.allOut.includes(0) ? 1 : 0) + (e.effects.allOut.includes(1) ? 9 : 0);
    if (nao > 1) continue;
    const r = dfs(nx, d + 1, [...path, c], nao); if (r) return r;
  }
  return null;
}
console.log((dfs(match.state, 0, [], 0) || ['none']).map((c) => `'${c}'`).join(', '));
