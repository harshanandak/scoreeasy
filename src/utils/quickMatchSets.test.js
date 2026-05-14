import { describe, expect, it } from 'vitest';
import { applySetPoint } from './quickMatchSets';

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
});
