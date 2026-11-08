import { describe, expect, it } from 'vitest';
import { scorePair } from '../landing/DashboardLanding';
import { finishFromQuickResult } from './finishModel';

const result = {
  sport: 'cricket', team1: 'Royals', team2: 'Strikers', score1: 13, score2: 0,
  team1Score: { runs: 13, wickets: 1, balls: 6 }, team2Score: { runs: 0, wickets: 0, balls: 0 },
};

describe('cricket scorecard formatting across surfaces', () => {
  it('prefers wickets over generic numeric scores on Home', () => {
    expect(scorePair(result)).toEqual(['13/1', '0/0']);
  });
  it('keeps a missing innings distinct from a recorded 0/0', () => {
    expect(scorePair({ sport: 'cricket', team1Score: result.team1Score })).toEqual(['13/1', 'Yet to bat']);
  });
  it('shows Test innings separately with wickets and declaration marks on every surface', () => {
    const test = { ...result, format: { totalInnings: 4 }, team1Id: 'a', team2Id: 'b',
      innings: [{ teamId: 'a', runs: 243, wickets: 10, balls: 300, allOut: true },
        { teamId: 'b', runs: 187, wickets: 6, balls: 250, declared: true }] };
    const finish = finishFromQuickResult(test, { kind: 'cricket' });
    expect(scorePair(test)).toEqual([finish.team1.score, finish.team2.score]);
    expect(scorePair(test)).toEqual(['243/all', '187/6d']);
  });
});
