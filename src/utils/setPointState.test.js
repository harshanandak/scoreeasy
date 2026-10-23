import { describe, expect, it } from 'vitest';
import { getSportById } from '../models/sportRegistry';
import { getSetPointState } from './quickMatchSets';

const none = { setPoint: [], matchPoint: [] };
const opportunity = (team, match = false) => ({ setPoint: [team], matchPoint: match ? [team] : [] });

describe('getSetPointState', () => {
  it.each([
    ['volleyball', 24, 22, opportunity(1)],
    ['volleyball', 25, 24, opportunity(1)],
    ['volleyball', 24, 24, none],
    ['volleyball', 22, 24, opportunity(2)],
    ['badminton', 20, 19, opportunity(1)],
    ['badminton', 20, 20, none],
    ['badminton', 29, 29, { setPoint: [1, 2], matchPoint: [] }],
    ['badminton', 29, 28, opportunity(1)],
    ['badminton', 28, 29, opportunity(2)],
    ['tabletennis', 10, 9, opportunity(1)],
    ['tabletennis', 10, 10, none],
    ['tabletennis', 11, 10, opportunity(1)],
  ])('%s at %i–%i', (sport, score1, score2, expected) => {
    const sportConfig = getSportById(sport);
    expect(getSetPointState({ sportConfig, format: { type: 'best-of', sets: 5 }, score1, score2 })).toEqual(expected);
  });

  it.each([
    [14, 13, 4, 2, 2, opportunity(1, true)],
    [14, 13, 0, 0, 0, none],
    [24, 22, 3, 2, 1, opportunity(1, true)],
    [22, 24, 3, 2, 1, opportunity(2)],
    [13, 14, 4, 2, 2, opportunity(2, true)],
  ])('volleyball %i–%i in set index %i with %i–%i sets', (score1, score2, currentSet, setsWon1, setsWon2, expected) => {
    expect(getSetPointState({ sportConfig: getSportById('volleyball'), format: { type: 'best-of', sets: 5 },
      score1, score2, currentSet, setsWon1, setsWon2 })).toEqual(expected);
  });

  it.each(['volleyball', 'badminton', 'tabletennis'])('single %s uses its selected target and is match point', (sport) => {
    const sportConfig = getSportById(sport);
    expect(getSetPointState({ sportConfig, format: { type: 'single', target: 7 }, score1: 6, score2: 5 })).toEqual(opportunity(1, true));
    expect(getSetPointState({ sportConfig, format: { type: 'single', target: 7 }, score1: 6, score2: 6 })).toEqual(none);
  });

  it('preserves both teams and their independent match stakes at the badminton cap', () => {
    const input = { sportConfig: getSportById('badminton'), format: { type: 'best-of', sets: 3 }, score1: 29, score2: 29, setsWon1: 1 };
    expect(getSetPointState(input)).toEqual({ setPoint: [1, 2], matchPoint: [1] });
    expect(getSetPointState({ ...input, currentSet: 2, setsWon2: 1 })).toEqual({ setPoint: [1, 2], matchPoint: [1, 2] });
    expect(getSetPointState({ ...input, setsWon1: 0, format: { type: 'single', target: 21 } })).toEqual({ setPoint: [1, 2], matchPoint: [1, 2] });
  });

  it('uses existing best-of customization for target, margin and cap', () => {
    const input = { sportConfig: getSportById('volleyball'), format: { type: 'best-of', sets: 3, points: 10, customization: { winBy: 1, pointCap: 12 } }, score1: 9, score2: 9 };
    expect(getSetPointState(input)).toEqual({ setPoint: [1, 2], matchPoint: [] });
    expect(getSetPointState({ ...input, score1: 11, score2: 11, format: { ...input.format, customization: { winBy: 3, pointCap: 12 } } })).toEqual({ setPoint: [1, 2], matchPoint: [] });
  });

  it.each([
    ['volleyball', 25, 22], ['badminton', 30, 29], ['tabletennis', 11, 9],
  ])('has no opportunity after a completed %s set', (sport, score1, score2) => {
    for (const format of [{ type: 'best-of', sets: 5 }, { type: 'single', target: getSportById(sport).config.pointsPerSet }]) {
      expect(getSetPointState({ sportConfig: getSportById(sport), format, score1, score2 })).toEqual(none);
    }
  });

  it('has no opportunity after the match is won', () => {
    expect(getSetPointState({ sportConfig: getSportById('volleyball'), format: { type: 'best-of', sets: 5 }, score1: 24, score2: 22, setsWon1: 3 })).toEqual(none);
  });
});
