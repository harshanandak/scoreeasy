import { describe, expect, it } from 'vitest';
import { createPeriodMatch, periodElapsed, applyPeriodAction, undoPeriodAction, readPeriodMatch } from './goalsPeriods';

const rules = { durations: [60, 60], overtimeSeconds: 30 };
const act = (state, type, at, extra = {}) => applyPeriodAction(state, { type, at, ...extra });

describe('goals period lifecycle', () => {
  it('freezes a paused clock across reload and resumes from the stored basis', () => {
    let state = createPeriodMatch(rules, 1000);
    state = act(state, 'pause', 11000);
    state = readPeriodMatch(JSON.parse(JSON.stringify(state)));
    expect(periodElapsed(state, 101000)).toBe(10);
    state = act(state, 'resume', 101000);
    expect(periodElapsed(readPeriodMatch(JSON.parse(JSON.stringify(state))), 106000)).toBe(15);
  });

  it('continues a running clock across reload and requires confirmation at zero', () => {
    const state = readPeriodMatch(JSON.parse(JSON.stringify(createPeriodMatch(rules, 1000))));
    expect(periodElapsed(state, 71000)).toBe(60);
    expect(state.phase).toBe('playing');
    expect(act(state, 'endPeriod', 71000)).toMatchObject({ phase: 'interval', periodIndex: 0 });
  });

  it('records scores per period and undoes a boundary atomically', () => {
    let state = createPeriodMatch(rules, 0);
    state = act(state, 'score', 1000, { team: 'A', value: 1 });
    state = act(state, 'endPeriod', 2000);
    state = act(state, 'startPeriod', 3000);
    state = act(state, 'score', 4000, { team: 'B', value: 2 });
    expect(state.scores).toEqual([{ A: 1, B: 0 }, { A: 0, B: 2 }]);
    state = undoPeriodAction(state, 5000);
    state = undoPeriodAction(state, 6000);
    expect(state).toMatchObject({ phase: 'interval', periodIndex: 0, scores: [{ A: 1, B: 0 }, { A: 0, B: 0 }] });
  });

  it('requires a separate full-time confirmation and supports overtime', () => {
    let state = createPeriodMatch(rules, 0);
    state = act(state, 'endPeriod', 1000);
    state = act(state, 'startPeriod', 2000);
    state = act(state, 'endPeriod', 3000);
    expect(state.phase).toBe('interval');
    expect(act(state, 'finish', 4000).phase).toBe('finished');
    state = act(state, 'overtime', 4000);
    expect(state).toMatchObject({ phase: 'playing', periodIndex: 2, durations: [60, 60, 30] });
  });

  it('keeps legacy matches distinguishable rather than inventing period scores', () => {
    expect(readPeriodMatch({ score1: 3, score2: 2 })).toEqual({ legacy: true, score1: 3, score2: 2 });
  });
});
