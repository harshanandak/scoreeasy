// Versioned match state. Time is stored as a basis, not a ticking counter.
export function createPeriodMatch(rules, now) {
  const durations = [...rules.durations];
  return { version: 1, sport: rules.sport, regulationCount: rules.regulationCount || durations.length, extraDurations: [...(rules.extraDurations || [])], endedEarly: false, events: [], durations, overtimeSeconds: rules.overtimeSeconds || 0, periodIndex: 0, phase: 'playing', elapsed: 0, startedAt: now, scores: durations.map(() => ({ A: 0, B: 0 })), history: [] };
}
export function periodElapsed(state, now) {
  const extra = state.phase === 'playing' && state.startedAt != null ? Math.max(0, (now - state.startedAt) / 1000) : 0;
  return Math.min(state.durations[state.periodIndex], Math.floor(state.elapsed + extra));
}
export function readPeriodMatch(value) {
  return value?.version === 1 ? value : { ...value, legacy: true };
}
export function applyPeriodAction(state, action) {
  const { type, at } = action;
  const before = { ...state, elapsed: periodElapsed(state, at), startedAt: state.startedAt == null ? null : at };
  delete before.history;
  let next = { ...state, scores: state.scores.map(score => ({ ...score })) };
  if (type === 'pause' && state.phase === 'playing' && state.startedAt != null) next = { ...next, elapsed: before.elapsed, startedAt: null };
  else if (type === 'resume' && state.phase === 'playing' && state.startedAt == null) next.startedAt = at;
  else if (type === 'score' && state.phase === 'playing' && ['A', 'B'].includes(action.team)) {
    next.scores[state.periodIndex][action.team] = Math.max(0, next.scores[state.periodIndex][action.team] + action.value);
    next.events = [...(state.events || []), { team: action.team, value: action.value, period: state.periodIndex + 1, elapsed: before.elapsed, at }];
  }
  else if (type === 'endPeriod' && state.phase === 'playing') next = { ...next, phase: 'interval', endedEarly: state.endedEarly || before.elapsed < state.durations[state.periodIndex], elapsed: before.elapsed, startedAt: null };
  else if (type === 'startPeriod' && state.phase === 'interval' && state.periodIndex < state.durations.length - 1) next = { ...next, phase: 'playing', periodIndex: state.periodIndex + 1, elapsed: 0, startedAt: at };
  else if (type === 'finish' && state.phase === 'interval' && state.periodIndex >= state.durations.length - 1) next.phase = 'finished';
  else if (type === 'overtime' && state.phase === 'interval' && state.periodIndex >= state.durations.length - 1 && (state.overtimeSeconds > 0 || state.extraDurations?.length > 0)) next = { ...next, phase: 'playing', durations: [...state.durations, ...(state.extraDurations?.length ? state.extraDurations : [state.overtimeSeconds])], extraDurations: [], scores: [...next.scores, ...(state.extraDurations?.length ? state.extraDurations : [state.overtimeSeconds]).map(() => ({ A: 0, B: 0 }))], periodIndex: state.periodIndex + 1, elapsed: 0, startedAt: at };
  else return state;
  return { ...next, history: [...state.history, before] };
}
export function undoPeriodAction(state, at) {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...previous, startedAt: previous.startedAt == null ? null : at, history: state.history.slice(0, -1) };
}


export const supportsGoalPeriods = sport => ['football', 'basketball', 'hockey'].includes(sport);

export function periodPreset(sport, preset = 'official', count, minutes) {
  const defaults = sport === 'football' ? [2, 45, 'IFAB 2026/27'] : sport === 'basketball' ? [4, 10, 'FIBA 5-on-5 2024'] : [4, 15, 'FIH outdoor 2027'];
  const n = Math.max(1, Math.min(8, Number(count) || defaults[0]));
  const seconds = Math.max(60, Math.min(7200, (Number(minutes) || defaults[1]) * 60));
  if (preset === 'casual') return { mode: 'free', periodPreset: preset };
  return { mode: 'timed', timeLimit: n * seconds, periodPreset: preset,
    periods: { version: 1, sport, source: preset === 'official' ? defaults[2] : 'Custom school/event', durations: Array(n).fill(seconds), regulationCount: n,
      overtimeSeconds: sport === 'basketball' ? 300 : 0, extraDurations: [] } };
}

export function periodTotals(state) {
  return state.scores.reduce((total, score) => ({ A: total.A + score.A, B: total.B + score.B }), { A: 0, B: 0 });
}

export function periodLabel(state) {
  const n = state.periodIndex + 1;
  const regulation = state.regulationCount || state.durations.length;
  if (state.phase === 'finished') return 'Full-time';
  if (state.phase === 'interval') {
    if (n === state.durations.length) return 'Period ended';
    return state.sport === 'football' || n === regulation / 2 ? 'Half-time' : 'Interval';
  }
  if (n > regulation) return state.sport === 'football' ? `Extra time ${n - regulation}` : `OT ${n - regulation}`;
  return state.sport === 'football' ? `${n === 1 ? '1st' : n === 2 ? '2nd' : n + 'th'} half` : `Q${n}`;
}

export function periodClock(state) {
  return { sport: state.sport, phase: state.phase, elapsed: state.elapsed, startedAt: state.startedAt, duration: state.durations[state.periodIndex], periodIndex: state.periodIndex, regulationCount: state.regulationCount || state.durations.length };
}

export function clockRemaining(clock, now) {
  const extra = clock.phase === 'playing' && clock.startedAt != null ? Math.max(0, (now - clock.startedAt) / 1000) : 0;
  return Math.max(0, clock.duration - Math.floor(clock.elapsed + extra));
}

export const formatPeriodClock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function periodResultDecided(state, a, b, drawAllowed) {
  return !state.endedEarly && state.phase !== 'playing' && state.periodIndex === state.durations.length - 1 && (drawAllowed || a !== b);
}
