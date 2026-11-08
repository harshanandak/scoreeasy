import { describe, expect, it } from 'vitest';
import { createPeriodMatch, periodElapsed, applyPeriodAction, undoPeriodAction, readPeriodMatch, periodPreset, periodResultDecided, periodTotals } from './goalsPeriods';

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


describe('frozen timing rules and outcomes', () => {
  it('copies setup rules and rejects a result after skipping a period early, including after refresh', () => {
    const format = periodPreset('football');
    let state = createPeriodMatch(format.periods, 0);
    format.periods.durations[0] = 1;
    expect(state.durations).toEqual([2700, 2700]);
    state = act(state, 'endPeriod', 1000);
    state = act(state, 'startPeriod', 2000);
    state = act(state, 'endPeriod', 2702000);
    expect(periodResultDecided(readPeriodMatch(JSON.parse(JSON.stringify(state))), 1, 0, true)).toBe(false);
    state = undoPeriodAction(state, 3000000);
    state = undoPeriodAction(state, 3000000);
    state = undoPeriodAction(state, 3000000);
    expect(state.endedEarly).toBe(false);
  });
  it('supports two football extra-time halves and repeated basketball overtime with complete undo', () => {
    let football = createPeriodMatch({ ...periodPreset('football').periods, durations: [60, 60], extraDurations: [30, 30] }, 0);
    football = act(football, 'endPeriod', 60000); football = act(football, 'startPeriod', 60000); football = act(football, 'endPeriod', 120000);
    expect(periodResultDecided(football, 1, 1, true)).toBe(false);
    expect(periodResultDecided(football, 1, 0, true)).toBe(true);
    football = act(football, 'overtime', 120000);
    expect(football.durations).toEqual([60, 60, 30, 30]);
    football = undoPeriodAction(football, 121000);
    expect(football).toMatchObject({ durations: [60, 60], phase: 'interval', extraDurations: [30, 30] });
    let basketball = createPeriodMatch({ ...periodPreset('basketball').periods, durations: [1] }, 0);
    basketball = act(basketball, 'endPeriod', 1000); basketball = act(basketball, 'overtime', 1000);
    basketball = act(basketball, 'endPeriod', 301000); basketball = act(basketball, 'overtime', 301000);
    basketball = act(basketball, 'score', 302000, { team: 'B', value: 3 });
    expect(basketball).toMatchObject({ periodIndex: 2, durations: [1, 300, 300], events: [{ period: 3, team: 'B', value: 3 }] });
    expect(periodTotals(basketball)).toEqual({ A: 0, B: 3 });
  });
});


it('keeps a long match durable without duplicating its event log in every undo frame', () => {
  let state = createPeriodMatch({ sport: 'basketball', durations: [3600] }, 0);
  for (let i = 0; i < 1000; i += 1) state = act(state, 'score', i * 1000, { team: i % 2 ? 'A' : 'B', value: 2 });
  const saved = JSON.stringify(state);
  expect(saved.length).toBeLessThan(700000);
  state = readPeriodMatch(JSON.parse(saved));
  expect(periodTotals(state)).toEqual({ A: 1000, B: 1000 });
  state = undoPeriodAction(state, 1000000);
  expect(state.events).toHaveLength(999);
  expect(periodTotals(state)).toEqual({ A: 998, B: 1000 });
});


it('corrects an earlier period score after the boundary and undoes it atomically', () => {
  let state = createPeriodMatch({ sport: 'football', durations: [60, 60] }, 0);
  state = act(state, 'score', 1000, { team: 'A', value: 1 });
  state = act(state, 'endPeriod', 60000); state = act(state, 'startPeriod', 61000);
  state = act(state, 'score', 62000, { team: 'A', value: -1 });
  expect(periodTotals(state)).toEqual({ A: 0, B: 0 });
  expect(state.events.at(-1)).toMatchObject({ period: 1, value: -1 });
  state = undoPeriodAction(state, 63000);
  expect(state.scores).toEqual([{ A: 1, B: 0 }, { A: 0, B: 0 }]);
  expect(state.periodIndex).toBe(1);
});


describe('review regression: clocks survive Undo', () => {
  it.each([false, true])('delayed score Undo preserves the current running basis (refresh=%s)', refresh => {
    let state = createPeriodMatch({ sport: 'football', durations: [60, 60] }, 0);
    state = act(state, 'score', 10000, { team: 'A', value: 1 });
    if (refresh) state = readPeriodMatch(JSON.parse(JSON.stringify(state)));
    const basis = { elapsed: state.elapsed, startedAt: state.startedAt };
    state = undoPeriodAction(state, 40000);
    expect(periodElapsed(state, 40000)).toBe(40);
    expect(state).toMatchObject(basis);
    expect(periodTotals(state)).toEqual({ A: 0, B: 0 });
  });
  it('undoing Resume pauses at the elapsed time reached since resuming', () => {
    let state = createPeriodMatch({ sport: 'football', durations: [60, 60] }, 0);
    state = act(state, 'pause', 10000); state = act(state, 'resume', 20000);
    state = undoPeriodAction(state, 40000);
    expect(state).toMatchObject({ elapsed: 30, startedAt: null });
  });
  it('undoing and redoing a period start retains the playing time already spent in that period', () => {
    let state = createPeriodMatch({ sport: 'football', durations: [60, 60] }, 0);
    state = act(state, 'endPeriod', 10000); state = act(state, 'startPeriod', 20000);
    state = undoPeriodAction(state, 30000);
    expect(state).toMatchObject({ phase: 'interval', periodIndex: 0, elapsedByPeriod: [10, 10] });
    state = act(state, 'startPeriod', 40000);
    expect(periodElapsed(state, 40000)).toBe(10);
    state = act(state, 'endPeriod', 50000);
    expect(state.elapsedByPeriod).toEqual([10, 20]);
  });
});
