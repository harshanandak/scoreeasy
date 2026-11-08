import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import KabaddiRaids from './KabaddiRaids';
import { createKabaddiMatch } from '../../../utils/kabaddiQuickMatch';
import { applyRaid, finish, startHalf, timeUp } from '../../../utils/kabaddiEngine';
import { beginLiveRaid, landRaid, markDefender } from '../../../utils/kabaddiBoardModel';
import { resolveKabaddiRules } from '../../../utils/kabaddiRules';
import { raidStory } from '../../../utils/kabaddiLiveModel';

it('uses the saved match totals for full time after a technical point following the last raid', () => {
  let match = createKabaddiMatch({ format: { kabaddiRules: resolveKabaddiRules('standard') }, names: ['Royals', 'Strikers'] });
  match.state.teams[0].score.technical = 9;
  match.state.teams[1].score.technical = 8;
  match = landRaid(markDefender(beginLiveRaid(match, { atMs: 100 }), 'B1', 'touched'), 'safe', { atMs: 200 });
  match.state = startHalf(timeUp(match.state), { atMs: 300 });
  match.state = applyRaid(match.state, { id: 'late-technical', type: 'technical', to: 0, reason: 'Referee technical point', turnEffect: 'none' });
  match.state = finish(timeUp(match.state));
  const story = raidStory(match);
  expect(story.at(-1).score).toEqual([10, 8]);
  render(<KabaddiRaids match={match} story={story} names={['Royals', 'Strikers']} roster={[[], []]} halfMs={1200000} />);
  expect(screen.getByText('Full time · 11–8')).toBeInTheDocument();
});
