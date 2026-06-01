import { describe, expect, it } from 'vitest';
import {
  getBasketballCompletionState,
  getFootballClockState,
  getFootballHalfLengthSeconds,
  getTimedPeriodLimit,
  getTimedRemainingSeconds,
} from './goalsScoring';

describe('goalsScoring', () => {
  it('routes tied basketball completion into overtime instead of a terminal result', () => {
    expect(getBasketballCompletionState({
      score1: 0,
      score2: 0,
      drawAllowed: false,
      overtimePeriod: 0,
    })).toEqual({
      canComplete: false,
      nextAction: 'overtime',
      message: 'Start overtime to resolve the tie.',
    });
  });

  it('allows basketball completion once overtime resolves the tie', () => {
    expect(getBasketballCompletionState({
      score1: 8,
      score2: 6,
      drawAllowed: false,
      overtimePeriod: 1,
    })).toMatchObject({
      canComplete: true,
      nextAction: 'complete',
    });
  });

  it('models football first half, halftime, second half, and full time', () => {
    expect(getFootballClockState({ elapsedSeconds: 0, halfLengthSeconds: 2700 })).toMatchObject({
      phase: 'first-half',
      label: '1st Half',
    });
    expect(getFootballClockState({ elapsedSeconds: 2700, halfLengthSeconds: 2700 })).toMatchObject({
      phase: 'halftime',
      label: 'Half Time',
    });
    expect(getFootballClockState({ elapsedSeconds: 2701, halfLengthSeconds: 2700 })).toMatchObject({
      phase: 'second-half',
      label: '2nd Half',
    });
    expect(getFootballClockState({ elapsedSeconds: 5400, halfLengthSeconds: 2700 })).toMatchObject({
      phase: 'full-time',
      label: 'Full Time',
    });
  });

  it('extends the timed scoring window for basketball overtime periods', () => {
    expect(getTimedPeriodLimit({ timeLimit: 600, overtimePeriod: 0 })).toBe(600);
    expect(getTimedPeriodLimit({ timeLimit: 600, overtimePeriod: 1 })).toBe(1200);
    expect(getTimedPeriodLimit({ timeLimit: 600, overtimePeriod: 2 })).toBe(1800);
    expect(getTimedPeriodLimit({ timeLimit: -600, overtimePeriod: 1 })).toBe(0);
    expect(getTimedPeriodLimit({ timeLimit: 'bad', overtimePeriod: 'bad' })).toBe(0);
    expect(getTimedRemainingSeconds({ elapsedSeconds: 600, timeLimit: 600, overtimePeriod: 1 })).toBe(600);
    expect(getTimedRemainingSeconds({ elapsedSeconds: 1200, timeLimit: 600, overtimePeriod: 1 })).toBe(0);
    expect(getTimedRemainingSeconds({ elapsedSeconds: 1300, timeLimit: 600, overtimePeriod: 1 })).toBe(0);
    expect(getTimedRemainingSeconds()).toBe(0);
  });

  it('uses football half presets as the half length', () => {
    const timePresets = [
      { label: '45 min (Half)', value: 2700 },
      { label: '90 min (Full)', value: 5400 },
    ];

    expect(getFootballHalfLengthSeconds({ timeLimitSeconds: 2700, timePresets })).toBe(2700);
    expect(getFootballHalfLengthSeconds({ timeLimitSeconds: 5400, timePresets })).toBe(2700);
  });
});
