import { describe, expect, it } from 'vitest';
import { scorePair } from '../landing/DashboardLanding';
import { finishFromQuickResult } from './finishModel';
import { cricketScoreLine } from '../../../utils/cricketScoreFormat';

const result = {
  sport: 'cricket', team1: 'Royals', team2: 'Strikers', score1: 13, score2: 0,
  team1Score: { runs: 13, wickets: 1, balls: 6 }, team2Score: { runs: 0, wickets: 0, balls: 0 },
};

describe('cricket scorecard formatting across surfaces', () => {
  it('prefers wickets over generic numeric scores on Home', () => {
    expect(scorePair(result)).toEqual(['13/1', '0/0']);
    const finish = finishFromQuickResult(result, { kind: 'cricket' });
    expect([finish.team1.score, finish.team2.score]).toEqual(scorePair(result));
    expect(cricketScoreLine(result)).toBe('Royals 13/1 · Strikers 0/0');
  });
  it('retains historical runs when wickets were never recorded', () => {
    expect(scorePair({ sport: 'cricket', score1: 151, score2: 140 })).toEqual(['151/?', '140/?']);
  });
  it('keeps a missing innings distinct from a recorded 0/0', () => {
    expect(scorePair({ sport: 'cricket', team1Score: result.team1Score })).toEqual(['13/1', 'Yet to bat']);
  });
  it.each([
    [{ score1: 151, score2: 140 }, ['151/?', '140/?']],
    [{ team1Score: { runs: 151, wickets: 3, balls: 60 } }, ['151/3', 'Yet to bat']],
    [{ team2Score: { runs: 140, wickets: 4, balls: 60 } }, ['Yet to bat', '140/4']],
    [{ team1Score: { runs: 151, wickets: 3, balls: 60 }, score2: 140 }, ['151/3', '140/?']],
    [{ team1Score: { runs: 0, wickets: 0, balls: 0 } }, ['0/0', 'Yet to bat']],
    [{}, ['Yet to bat', 'Yet to bat']],
  ])('uses the shared formatter for incomplete cricket result %j', (saved, expected) => {
    const record = { sport: 'cricket', team1: 'Royals', team2: 'Strikers', ...saved };
    const finish = finishFromQuickResult(record, { kind: 'cricket' });
    expect([finish.team1.score, finish.team2.score]).toEqual(expected);
    expect(scorePair(record)).toEqual(expected);
    expect(cricketScoreLine(record)).toBe(`Royals ${expected[0]} · Strikers ${expected[1]}`);
  });

  it.each([
    [{ score1: 151, score2: 140 }, { outcome: 'win', winnerSide: 'team1', headline: 'Royals', detail: 'Won by 11 points' }],
    [{ score1: 151, score2: 140, winner: 'Draw' }, { outcome: 'draw', winnerSide: null, headline: 'Match drawn', detail: null }],
    [{ team1Score: { runs: 151, wickets: 3, balls: 60 } }, { outcome: 'draw', winnerSide: null, headline: 'Match drawn', detail: null }],
  ])('preserves the existing fallback winner policy for %j', (saved, expected) => {
    expect(finishFromQuickResult({ team1: 'Royals', team2: 'Strikers', ...saved }, { kind: 'cricket' }))
      .toMatchObject(expected);
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
