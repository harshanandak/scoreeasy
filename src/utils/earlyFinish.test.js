import { expect, it } from 'vitest';
import { recordMatchOutcome } from './matchOutcome';
import { isGoalsMatchDecided } from './goalsScoring';
import { isSetsMatchDecided } from './quickMatchSets';
import { isLimitedOversMatchDecided, calculateCricketPointsTable } from './cricketCalculations';
import { buildTennisQuickHistoryEntry } from './tennisQuickMatch';
import { normalizeMatchForConvex } from './normalizeMatch';
import { calculateSetsStandings } from './standingsCalculator';

it('keeps the final score and undo snapshot but clears a premature winner', () => {
  const original = { score1: 2, score2: 1, winner: 'Royals', history: [{ score1: 1, score2: 1 }] };
  expect(recordMatchOutcome(original, false)).toEqual({ ...original, status: 'completed', resultType: 'abandoned', winner: null, winDesc: '' });
  expect(original.winner).toBe('Royals');
  expect(recordMatchOutcome(original, true)).toMatchObject({ winner: 'Royals', resultType: 'decided' });
});

it('requires the selected set target or enough completed sets', () => {
  expect(isSetsMatchDecided({ format: { type: 'single', target: 25 }, score1: 2, score2: 1 })).toBe(false);
  expect(isSetsMatchDecided({ format: { type: 'single', target: 25 }, score1: 25, score2: 24 })).toBe(false);
  expect(isSetsMatchDecided({ format: { type: 'single', target: 25 }, score1: 26, score2: 24 })).toBe(true);
  const sets = [{ score1: 25, score2: 20, completed: true }, { score1: 2, score2: 1, completed: false }];
  expect(isSetsMatchDecided({ sets, format: { type: 'best-of', sets: 3 } })).toBe(false);
  sets[1] = { score1: 25, score2: 20, completed: true };
  expect(isSetsMatchDecided({ sets, format: { type: 'best-of', sets: 3 } })).toBe(true);
});

it('requires full time or the selected points target, including no-draw overtime', () => {
  const input = { format: { mode: 'timed', timeLimit: 60 }, score1: 2, score2: 1 };
  expect(isGoalsMatchDecided({ ...input, elapsedSeconds: 59 })).toBe(false);
  expect(isGoalsMatchDecided({ ...input, elapsedSeconds: 60 })).toBe(true);
  expect(isGoalsMatchDecided({ ...input, score2: 2, elapsedSeconds: 60, drawAllowed: false })).toBe(false);
  expect(isGoalsMatchDecided({ ...input, elapsedSeconds: 61, overtimePeriod: 1 })).toBe(false);
  expect(isGoalsMatchDecided({ format: { mode: 'points', target: 21 }, score1: 2, score2: 1 })).toBe(false);
  expect(isGoalsMatchDecided({ format: { mode: 'points', target: 21 }, score1: 21, score2: 1 })).toBe(true);
});

it('never declares cricket decided before the chase, or just because the defender leads', () => {
  const input = { team1Score: { runs: 13, wickets: 1, balls: 6 }, team2Score: { runs: 0, wickets: 0, balls: 0 }, format: { overs: 20, players: 11 } };
  expect(isLimitedOversMatchDecided({ ...input, innings: 1 })).toBe(false);
  expect(isLimitedOversMatchDecided(input)).toBe(false);
  expect(isLimitedOversMatchDecided({ ...input, team2Score: { runs: 14, wickets: 0, balls: 5 } })).toBe(true);
  expect(isLimitedOversMatchDecided({ ...input, team2Score: { runs: 10, wickets: 10, balls: 40 } })).toBe(true);
  expect(isLimitedOversMatchDecided({ ...input, team2Score: { runs: 13, wickets: 1, balls: 120 } })).toBe(true);
});

it('explicit tennis Finish abandons a one-set lead in a best of three, while leaving still saves a draft', () => {
  const input = { match: { team1: 'Royals', team2: 'Strikers' }, sets: [{ games1: 6, games2: 2, completed: true }, { games1: 2, games2: 1, completed: false }], isComplete: false, completedAt: '2026-11-09' };
  expect(buildTennisQuickHistoryEntry({ ...input, finished: true })).toMatchObject({ status: 'completed', resultType: 'abandoned', winner: null, setsWon1: 1 });
  expect(buildTennisQuickHistoryEntry(input)).toMatchObject({ status: 'in-progress', winner: null });
});

it('preserves no result through cloud normalization and cricket standings without awarding a win or NRR', () => {
  const match = { status: 'completed', resultType: 'abandoned', team1Id: 'a', team2Id: 'b', team1: 'Royals', team2: 'Strikers', winner: null, team1Score: { runs: 13, wickets: 1, balls: 6 }, team2Score: { runs: 0, wickets: 0, balls: 0 } };
  expect(normalizeMatchForConvex(match, 'cricket')).toMatchObject({ resultType: 'abandoned', score1: 13, score2: 0, winner: undefined });
  for (const row of calculateCricketPointsTable([{ id: 'a' }, { id: 'b' }], [match])) {
    expect(row).toMatchObject({ played: 1, noResult: 1, won: 0, lost: 0, points: 0, nrr: 0 });
  }
});

it('counts a scoreless abandoned fixture as played and no result', () => {
  const rows = calculateSetsStandings([{ id: 'a' }, { id: 'b' }], [{ team1Id: 'a', team2Id: 'b', status: 'completed', resultType: 'abandoned', sets: [] }], {});
  for (const row of rows) expect(row).toMatchObject({ played: 1, noResult: 1, won: 0, lost: 0, matchPoints: 0 });
});

it('keeps Test runs keyed by team id when cloud records use display names', () => {
  expect(normalizeMatchForConvex({ resultType: 'abandoned', team1: 'Royals', team2: 'Strikers', team1Id: 'A', team2Id: 'B', innings: [{ teamId: 'A', runs: 13 }, { teamId: 'B', runs: 0 }] }, 'cricket')).toMatchObject({ resultType: 'abandoned', score1: 13, score2: 0 });
});
