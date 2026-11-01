// bun .kbk2/check.mjs : the engine numbers behind each still (audit for the screenshots).
import { buildEnd, buildRest } from './fixture.js';
import { boardView, lastRaidLine, undoHint } from '../src/utils/kabaddiBoardModel.js';
import { result } from '../src/utils/kabaddiEngine.js';
const now = 1_800_000_000_000;
for (const [name, m] of [['rest', buildRest(now)], ['rest-named', buildRest(now, { named: true })], ['end', buildEnd(now)]]) {
  const v = boardView(m, now);
  console.log(name, v.phase, 'score', v.totals.join('-'), 'mat', v.mat.map((x) => x.on).join('-'), 'raid#', v.raidNumber, 'raiding', v.raidingTeam,
    'dod', v.doOrDie, 'super', v.superTackleOn, 'half', v.half, 'left', Math.round(v.remainingMs / 1000), '|', lastRaidLine(m), '|', undoHint(m.state),
    '| next in', v.mat.map((x) => x.out[0]?.name ?? '-').join(' / '), name === 'end' ? JSON.stringify(result(m.state)) : '');
}
