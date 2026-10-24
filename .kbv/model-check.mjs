import { buildFixture } from './fixture.js';
import { keyMoments, halfStory, pointsBreakdown, engineBreakdown, liveNow, raidStory, raidWords } from '../src/utils/kabaddiLiveModel.js';
for (const st of ['allout', 'rest', 'raid', 'moment', 'end']) {
  const { match, now } = buildFixture(st);
  const names = ['Royals', 'Strikers'];
  const s = raidStory(match);
  console.log('==', st, JSON.stringify(liveNow(match, now)));
  console.log(JSON.stringify(pointsBreakdown(match)), JSON.stringify(engineBreakdown(match)));
  console.log(raidWords(s.at(-1), names));
  if (st === 'end' || st === 'moment') { console.log(keyMoments(match).map((m) => `${m.raid} H${m.half} ${m.clock} ${m.kind} ${m.text} · ${m.detail} ${m.score.join('-')}`).join('\n')); console.log(JSON.stringify(halfStory(match))); }
}
