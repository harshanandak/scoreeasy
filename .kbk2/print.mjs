import { buildFixture } from './fixture.js';
import { liveNow, raidStory } from '../src/utils/kabaddiLiveModel.js';
import { raidLog } from '../src/utils/kabaddiQuickMatch.js';
for (const st of ['rest', 'raid', 'moment', 'end']) {
  const { match, now } = buildFixture(st);
  const s = match.state;
  const l = liveNow(match, now);
  console.log('==', st, 'tot', l.totals, 'mat', JSON.stringify(s.mat), 'queue', JSON.stringify(s.outQueue.map(q => q.map(x => x.slotId))), 'raid', JSON.stringify(s.activeRaid && { slot: s.activeRaid.raiderSlotId, team: s.activeRaid.raidingTeam }), 'phase', l.phase, 'half', l.half, 'left', l.halfLeftMs);
  const log = raidLog(s).slice(0, 3);
  for (const e of log) console.log('  #', e.raidNumber, 'team', e.raidingTeam, e.outcome, 'raider', e.raiderSlotId ?? e.input?.raiderSlotId ?? Object.keys(e).join(','), 'lost', JSON.stringify(e.effects.lost), 'rev', JSON.stringify(e.effects.revived));
}
