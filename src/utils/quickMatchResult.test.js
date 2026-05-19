import { describe, expect, it } from 'vitest';
import {
  buildResultShareText,
  getResultOutcome,
  getResultSetRows,
  getResultSetSummary,
  getShareStatusText,
} from './quickMatchResult';

describe('quick match result helpers', () => {
  it('formats result outcomes for wins, draws, and ties', () => {
    expect(getResultOutcome('Team A')).toBe('Team A won');
    expect(getResultOutcome('Draw')).toBe('Match Drawn');
    expect(getResultOutcome('Tie')).toBe('Match Tied');
  });

  it('builds share text for set and cricket results', () => {
    expect(buildResultShareText({
      team1: 'Falcons',
      team2: 'Sharks',
      score1: 2,
      score2: 1,
      winner: 'Falcons',
    })).toBe('Falcons 2 - 1 Sharks - Falcons won');

    expect(buildResultShareText({
      team1: 'Riders',
      team2: 'Kings',
      winner: 'Riders',
      team1Score: { runs: 151, wickets: 5, balls: 120 },
      team2Score: { runs: 140, wickets: 8, balls: 120 },
    }, { isCricket: true })).toBe('Riders 151/5 (20 ov) vs Kings 140/8 (20 ov) - Riders won');
  });

  it('maps share responses to user-facing statuses', () => {
    expect(getShareStatusText({ shared: true, method: 'clipboard' })).toBe('Result copied.');
    expect(getShareStatusText({ shared: true, method: 'native' })).toBe('Share sheet opened.');
    expect(getShareStatusText({ shared: false, method: 'unsupported' })).toBe('Share is not available on this device.');
    expect(getShareStatusText(null)).toBe('Could not share result.');
  });

  it('keeps only played sets in result breakdowns', () => {
    const rows = getResultSetRows({
      team1: 'Falcons',
      team2: 'Sharks',
      sets: [
        { score1: 25, score2: 21, completed: true },
        { score1: 18, score2: 25, completed: true },
        { score1: 7, score2: 4, completed: false },
        { score1: 0, score2: 0, completed: false },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({ label: 'Set 1', score1: 25, score2: 21, winner: 'Falcons' }),
      expect.objectContaining({ label: 'Set 2', score1: 18, score2: 25, winner: 'Sharks' }),
      expect.objectContaining({ label: 'Set 3', score1: 7, score2: 4, winner: 'Falcons' }),
    ]);
  });

  it('summarizes set wins from saved result data first', () => {
    expect(getResultSetSummary({
      team1: 'Falcons',
      team2: 'Sharks',
      setsWon1: 2,
      setsWon2: 1,
      sets: [
        { score1: 25, score2: 21, completed: true },
        { score1: 18, score2: 25, completed: true },
        { score1: 15, score2: 11, completed: true },
      ],
    })).toMatchObject({
      text: '2-1 sets',
      rows: expect.any(Array),
    });
  });

  it('derives set wins from completed sets when saved totals are missing', () => {
    expect(getResultSetSummary({
      team1: 'Falcons',
      team2: 'Sharks',
      sets: [
        { score1: 25, score2: 21, completed: true },
        { score1: 18, score2: 25, completed: true },
        { score1: 7, score2: 4, completed: false },
      ],
    })).toMatchObject({
      text: '1-1 sets',
      rows: expect.any(Array),
    });
  });
});
