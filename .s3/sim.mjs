import { applyRaid, startHalf, startRaid, timeUp, teamTotal, isSuperTackleOn } from '../src/utils/kabaddiEngine.js';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch.js';
const B = { bonusAwarded: true, bonusBeforeContact: true };
const T = (n, b) => ({ type: 'touch', count: n, ...(b ? B : {}) });
const E = { type: 'empty' }, K = { type: 'tackled' }, BO = { type: 'bonus', bonusBeforeContact: true };
let s = createKabaddiMatch({ format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] }).state;
const seqs = JSON.parse(process.argv[2]);
const parse = (c) => c === 'E' ? E : c === 'K' ? K : c === 'B' ? BO : c.endsWith('b') ? T(+c[0], 1) : T(+c);
let n = 0, t = 0;
const show = () => `${s.teams.map(teamTotal).join('-')} mat ${s.mat.map(m=>m.length).join('-')} streak ${s.emptyStreak} next ${s.nextRaidTeam} st ${isSuperTackleOn(s)}`;
s = startHalf(s, { atMs: 0 });
seqs.forEach((seq, hi) => {
  if (hi === 1) { s = timeUp(s); s = startHalf(s, { atMs: t }); console.log('--- half 2 next', s.nextRaidTeam); }
  for (const c of seq.split(' ')) { n++; t += 34000; const ev = parse(c);
    s = startRaid(s, { id: 'r'+n, atMs: t });
    try { s = applyRaid(s, { id: 'c'+n, raidId: 'r'+n, ...ev }); } catch (e) { console.log('ERR', n, c, e.message); process.exit(1); }
    const e=s.events.at(-1); console.log(hi+1, n, ['R','S'][e.raidingTeam], c.padEnd(3), e.outcome.padEnd(14), e.effects.allOut.length?'ALLOUT':'      ', show()); }
});
