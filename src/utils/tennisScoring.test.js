import { describe, expect, it } from 'vitest';
import { formatTennisPointScore } from './tennisScoring';

describe('formatTennisPointScore', () => {
  it.each([
    [0, 0, '0'],
    [1, 0, '15'],
    [2, 1, '30'],
    [3, 2, '40'],
  ])('formats raw point %i against %i as %s', (score, opponentScore, expected) => {
    expect(formatTennisPointScore(score, opponentScore)).toBe(expected);
  });

  it('formats advantage without exposing raw points', () => {
    expect(formatTennisPointScore(4, 3)).toBe('AD');
    expect(formatTennisPointScore(3, 4)).toBe('40');
    expect(formatTennisPointScore(4, 4)).toBe('40');
  });

  it('does not show advantage for non-deuce two-point leads', () => {
    expect(formatTennisPointScore(4, 2)).toBe('4');
    expect(formatTennisPointScore(5, 3)).toBe('5');
    expect(formatTennisPointScore(6, 4)).toBe('6');
  });
});
