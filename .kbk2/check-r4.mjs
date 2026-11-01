// bun .kbk2/check-r4.mjs : round 4 glue. Raid by starts the raid clock; the outcome finishes it; naming and
// cancel change no point and no clock; the flags come from the engine's record of the last raid.
import { buildRest, buildOpen } from './fixture.js';
import { beginRaid, boardView, canCancelRaid, cancelActiveRaid, confirmRuling, lastAction, liveRaids, raidFlags, readback, renameLast, stepBackLabel, tryRuling } from '../src/utils/kabaddiBoardModel.js';

const NOW = 1_800_000_000_000;
const row = (label, m, at) => { const v = boardView(m, at); console.log(label.padEnd(24), v.totals.join('-'), 'mat', v.mat.map((x) => x.on).join('-'), 'half', v.remainingMs, 'raid', v.raidMs, '|', stepBackLabel(m.state)); };

const rest = buildRest(NOW, { named: true });
row('rest', rest, NOW);
console.log('rest last-raid flags', JSON.stringify(raidFlags(rest, lastAction(rest.state))));
const began = beginRaid(rest, { atMs: NOW });
row('raid by (+9 s)', began, NOW + 9000);
console.log('can cancel', canCancelRaid(began.state), '| touch 3 preview ok', Boolean(tryRuling(began.state, { type: 'touch', count: 3 }, { atMs: NOW + 9000 })));
const cancelled = cancelActiveRaid(began);
row('cancelled', cancelled, NOW + 9000);

// all out: Royals touch 3 on Strikers (3 on the mat) after Raid by
const t3 = { type: 'touch', count: 3 };
const ao = confirmRuling(began, t3, { atMs: NOW + 9000 });
row('all out', ao, NOW + 9000);
const entry = liveRaids(ao.state)[0];
console.log('all out flags', JSON.stringify(raidFlags(ao, entry)));
console.log('line', readback(ao, entry, { guessed: true, known: { back: () => null } }));

// naming after Raid by: replays at the raid start, same totals and the same half clock
const t1 = { type: 'touch', count: 1 };
const a = confirmRuling(began, t1, { atMs: NOW + 9000 });
const commit = { id: liveRaids(a.state)[0].id, ruling: t1, atMs: NOW };
const b = renameLast(a, commit, { outs: [rest.state.mat[1][1]] });
row('+1', a, NOW + 9000); row('+1 renamed', b, NOW + 9000);
console.log('same clock', boardView(a, NOW + 9000).remainingMs === boardView(b, NOW + 9000).remainingMs, '| same totals', boardView(a, NOW).totals.join() === boardView(b, NOW).totals.join());
console.log('named flags', JSON.stringify(raidFlags(b, liveRaids(b.state)[0], { outsNamed: true })));
const o = buildOpen(NOW, { named: true });
const ob = beginRaid(o, { atMs: NOW });
const o2 = confirmRuling(ob, { type: 'touch', count: 2 }, { atMs: NOW + 5000 });
console.log('open +2 flags (unnamed)', JSON.stringify(raidFlags(o2, liveRaids(o2.state)[0])));
