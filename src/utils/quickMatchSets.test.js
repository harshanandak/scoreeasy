import { describe, expect, it } from 'vitest';
import { applySetPoint, getBestOfResultScore, getSetWinRule, isSetComplete } from './quickMatchSets';

describe('applySetPoint', () => {
  it('adds one point without mutating the previous set state', () => {
    const previousSets = [{ score1: 0, score2: 0, completed: false }];

    const nextSets = applySetPoint(previousSets, 0, 1);

    expect(previousSets[0].score1).toBe(0);
    expect(nextSets[0].score1).toBe(1);
    expect(nextSets[0]).not.toBe(previousSets[0]);
  });

  it('is stable when React replays the same updater in StrictMode', () => {
    const previousSets = [{ score1: 0, score2: 0, completed: false }];

    const firstReplay = applySetPoint(previousSets, 0, 1);
    const secondReplay = applySetPoint(previousSets, 0, 1);

    expect(previousSets[0].score1).toBe(0);
    expect(firstReplay[0].score1).toBe(1);
    expect(secondReplay[0].score1).toBe(1);
  });

  it('adds one point to team two', () => {
    const nextSets = applySetPoint([{ score1: 4, score2: 6, completed: false }], 0, 2);

    expect(nextSets[0]).toMatchObject({ score1: 4, score2: 7, completed: false });
  });

  it('rejects invalid team values instead of scoring team two', () => {
    expect(() => applySetPoint([{ score1: 4, score2: 6, completed: false }], 0, 3))
      .toThrow('Invalid team value: 3');
  });
});

describe('set completion rules', () => {
  it('honors sport max points before win-by for badminton caps', () => {
    const rule = getSetWinRule({
      format: { type: 'best-of', sets: 3, points: 21 },
      sportConfig: { config: { pointsPerSet: 21, deciderPoints: 21, winBy: 2, maxPoints: 30 } },
      currentSet: 0,
    });

    expect(isSetComplete({ score1: 30, score2: 29 }, rule)).toBe(true);
  });

  it('uses the configured decider target for the final set', () => {
    const rule = getSetWinRule({
      format: { type: 'best-of', sets: 3, points: 25 },
      sportConfig: { config: { pointsPerSet: 25, deciderPoints: 15, winBy: 2 } },
      currentSet: 2,
    });

    expect(rule.target).toBe(15);
    expect(isSetComplete({ score1: 15, score2: 13 }, rule)).toBe(true);
  });
});

describe('getBestOfResultScore', () => {
  it('uses completed set wins for naturally completed best-of results', () => {
    const summary = getBestOfResultScore([
      { score1: 25, score2: 19, completed: true },
      { score1: 25, score2: 22, completed: true },
    ]);

    expect(summary).toMatchObject({ setsWon1: 2, setsWon2: 0, score1: 2, score2: 0 });
  });

  it('uses active set points for manual end when no completed set winner exists', () => {
    const summary = getBestOfResultScore([
      { score1: 7, score2: 4, completed: false },
    ], { includeActiveWhenTied: true });

    expect(summary).toMatchObject({ setsWon1: 0, setsWon2: 0, score1: 7, score2: 4 });
  });

  it('does not use completed set points as the active fallback', () => {
    const summary = getBestOfResultScore([
      { score1: 25, score2: 20, completed: true },
    ], { includeActiveWhenTied: true });

    expect(summary).toMatchObject({ setsWon1: 1, setsWon2: 0, score1: 1, score2: 0 });
  });
});
