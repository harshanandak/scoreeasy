import { describe, expect, it } from 'vitest';
import {
  buildTennisQuickDraft,
  buildTennisQuickHistoryEntry,
  countTennisQuickSetsWon,
  getTennisQuickDraftKey,
  getVisibleTennisSetRows,
  mapTennisSetsForQuickHistory,
} from './tennisQuickMatch';

const sampleSets = [
  { games1: 6, games2: 4, completed: true, isTiebreak: false },
  { games1: 6, games2: 7, completed: true, isTiebreak: true, tiebreakPoints1: 5, tiebreakPoints2: 7 },
  { games1: 6, games2: 3, completed: true, isTiebreak: false },
];

const reversedTiebreakSets = [
  { games1: 7, games2: 6, completed: true, isTiebreak: true, tiebreakPoints1: 5, tiebreakPoints2: 7 },
];

describe('tennisQuickMatch', () => {
  it('uses an isolated draft key for in-progress quick tennis', () => {
    expect(getTennisQuickDraftKey('123')).toBe('se_tennis_quick_draft_123');
  });

  it('builds a draft without writing it into completed quick-match history', () => {
    expect(buildTennisQuickDraft({
      matchId: 123,
      sport: 'tennis',
      team1Name: 'Aces',
      team2Name: 'Baseline',
      format: { sets: 3 },
      sets: null,
      nowIso: '2026-05-22T00:00:00.000Z',
    })).toMatchObject({
      id: 123,
      sport: 'tennis',
      team1: 'Aces',
      team2: 'Baseline',
      status: 'in-progress',
    });
  });

  it('maps tennis games into quick-history set rows', () => {
    expect(mapTennisSetsForQuickHistory(sampleSets)).toEqual([
      expect.objectContaining({ score1: 6, score2: 4, completed: true }),
      expect.objectContaining({ score1: 6, score2: 7, tiebreakPoints2: 7, isTiebreak: true }),
      expect.objectContaining({ score1: 6, score2: 3, completed: true }),
    ]);
  });

  it('stores completed tennis quick matches as set scores for history and statistics', () => {
    expect(countTennisQuickSetsWon(sampleSets)).toEqual({ setsWon1: 2, setsWon2: 1 });
    expect(buildTennisQuickHistoryEntry({
      match: { id: 123, sport: 'tennis', team1: 'Aces', team2: 'Baseline' },
      sets: sampleSets,
      isComplete: true,
      completedAt: '2026-05-22T00:05:00.000Z',
    })).toMatchObject({
      score1: 2,
      score2: 1,
      setsWon1: 2,
      setsWon2: 1,
      winner: 'Aces',
      status: 'completed',
    });
  });

  it('uses tiebreak points to decide completed tiebreak sets', () => {
    expect(countTennisQuickSetsWon(reversedTiebreakSets)).toEqual({ setsWon1: 0, setsWon2: 1 });
    expect(buildTennisQuickHistoryEntry({
      match: { id: 456, sport: 'tennis', team1: 'Aces', team2: 'Baseline' },
      sets: reversedTiebreakSets,
      isComplete: true,
      completedAt: '2026-05-22T00:10:00.000Z',
    })).toMatchObject({
      score1: 0,
      score2: 1,
      winner: 'Baseline',
      status: 'completed',
    });
  });

  it('hides unplayed sets after the match is decided', () => {
    const rows = getVisibleTennisSetRows([
      { games1: 6, games2: 4, completed: true },
      { games1: 6, games2: 3, completed: true },
      { games1: 0, games2: 0, completed: false },
    ]);

    expect(rows).toHaveLength(2);
  });

  it('keeps the active unplayed set visible before the match is decided', () => {
    const rows = getVisibleTennisSetRows([
      { games1: 6, games2: 4, completed: true },
      { games1: 2, games2: 1, completed: false },
      { games1: 0, games2: 0, completed: false },
    ]);

    expect(rows).toHaveLength(2);
  });
});
