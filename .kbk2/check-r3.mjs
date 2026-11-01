// Engine checks for the one-tap glue: renaming changes no point and no clock; rare rulings score.
import { buildRest, buildOpen } from './fixture.js';
import { boardView, confirmRuling, confirmTechnical, liveRaids, readback, renameLast, touchedThenTackled, undoLabel, lastAction } from '../src/utils/kabaddiBoardModel.js';

const NOW = 1_800_000_000_000;
const show = (label, m, at) => { const v = boardView(m, at); console.log(label.padEnd(26), v.totals.join('–'), 'mat', v.mat.map((x) => x.on).join('–'), 'clock', v.remainingMs, '|', readback(m, lastAction(m.state)), '|', undoLabel(m.state)); };

let m = buildRest(NOW, { named: true });
show('rest', m, NOW);
const r1 = { type: 'touch', count: 1 };
const a = confirmRuling(m, r1, { atMs: NOW });
show('+1 (default names)', a, NOW + 6000);
const commit = { id: liveRaids(a.state)[0].id, ruling: r1, atMs: NOW };
const strikersOn = m.state.mat[1];
const b = renameLast(a, commit, { outs: [strikersOn[1]] });
show('+1 renamed 6s later', b, NOW + 6000);
console.log('clock same after rename:', boardView(a, NOW + 6000).remainingMs === boardView(b, NOW + 6000).remainingMs);

const t = confirmRuling(m, { type: 'tackled' }, { atMs: NOW });
show('tackled (super)', t, NOW);
const raiderPick = m.state.mat[0][2];
const t2 = renameLast(t, { id: liveRaids(t.state)[0].id, ruling: { type: 'tackled' }, atMs: NOW }, { raider: raiderPick });
show('tackled renamed raider', t2, NOW);

const so = confirmRuling(m, { type: 'selfOut', reason: 'Raider stepped out' }, { atMs: NOW });
show('raider stepped out', so, NOW);
const mx = confirmRuling(m, touchedThenTackled(m.state), { atMs: NOW });
show('touched, then tackled', mx, NOW);
const tp = confirmTechnical(m, 0, { atMs: NOW });
show('technical to Royals', tp, NOW);

const o = buildOpen(NOW);
show('open', o, NOW);
const ob = confirmRuling(o, { type: 'touch', count: 2, bonusAwarded: true, bonusBeforeContact: true }, { atMs: NOW });
show('open bonus + 2', ob, NOW);
const bo = confirmRuling(o, { type: 'bonus', bonusBeforeContact: true }, { atMs: NOW });
show('open bonus only', bo, NOW);
