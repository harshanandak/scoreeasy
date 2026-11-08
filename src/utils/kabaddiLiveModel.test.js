import { expect, it } from 'vitest';
import { createKabaddiMatch } from './kabaddiQuickMatch';
import { applyRaid, finish, startHalf, timeUp } from './kabaddiEngine';
import { beginLiveRaid, landRaid, markDefender } from './kabaddiBoardModel';
import { kabaddiSnapshot, kabaddiWatchMatch } from './kabaddiBroadcast';
import { halfStory, raidStory } from './kabaddiLiveModel';
import { resolveKabaddiRules } from './kabaddiRules';

function finishedMatch() {
  let match = createKabaddiMatch({ format: { kabaddiRules: resolveKabaddiRules('standard') }, names: ['Royals', 'Strikers'] });
  match.state.teams[0].score.technical = 3;
  match.state.teams[1].score.technical = 4;
  match = landRaid(markDefender(beginLiveRaid(match, { atMs: 100 }), 'B1', 'touched'), 'safe', { atMs: 200 });
  match.state = applyRaid(match.state, { id: 'halftime-technical', type: 'technical', to: 0, reason: 'Referee technical point', turnEffect: 'none' });
  match.state = startHalf(timeUp(match.state), { atMs: 300 });
  let raid = beginLiveRaid(match, { atMs: 400 });
  for (const slot of ['A1', 'A2', 'A3', 'A4']) raid = markDefender(raid, slot, 'touched');
  match = landRaid(raid, 'safe', { atMs: 500 });
  raid = beginLiveRaid(match, { atMs: 600 });
  for (const slot of ['B1', 'B2', 'B3', 'B4', 'B5']) raid = markDefender(raid, slot, 'touched');
  match = landRaid(raid, 'safe', { atMs: 700 });
  match.state = applyRaid(match.state, { id: 'fulltime-technical', type: 'technical', to: 0, reason: 'Referee technical point', turnEffect: 'none' });
  match.state = finish(timeUp(match.state));
  return match;
}

it.each([false, true])('includes technical points after the last raid in each half (spectator refresh: %s)', refresh => {
  const saved = finishedMatch();
  const story = raidStory(saved);
  expect(story.at(-1).score).toEqual([10, 8]);
  const match = refresh ? kabaddiWatchMatch(
    JSON.parse(JSON.stringify({ pointsA: 11, pointsB: 8, kabaddi: kabaddiSnapshot(saved) })),
    { teamA: { name: 'Royals' }, teamB: { name: 'Strikers' } },
    JSON.parse(JSON.stringify(story.map((raid, i) => ({ seq: i + 1, kabaddi: { kind: 'raid', raid } })))),
  ) : saved;
  expect(match).not.toBeNull();
  const halves = halfStory(match);
  expect(halves.map(half => half.points)).toEqual([[5, 4], [6, 4]]);
  expect(halves.map(half => half.score)).toEqual([[5, 4], [11, 8]]);
  expect(halves.map(half => half.raids)).toEqual([1, 2]);
});
