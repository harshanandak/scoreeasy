// Versioned match state. Time is stored as a basis, not a ticking counter.
export function createPeriodMatch(rules, now) {
  const durations = [...rules.durations];
  return { version: 1, durations, overtimeSeconds: rules.overtimeSeconds || 0, periodIndex: 0, phase: 'playing', elapsed: 0, startedAt: now, scores: durations.map(() => ({ A: 0, B: 0 })), history: [] };
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
  else if (type === 'score' && state.phase === 'playing' && ['A', 'B'].includes(action.team)) next.scores[state.periodIndex][action.team] += action.value;
  else if (type === 'endPeriod' && state.phase === 'playing') next = { ...next, phase: 'interval', elapsed: before.elapsed, startedAt: null };
  else if (type === 'startPeriod' && state.phase === 'interval' && state.periodIndex < state.durations.length - 1) next = { ...next, phase: 'playing', periodIndex: state.periodIndex + 1, elapsed: 0, startedAt: at };
  else if (type === 'finish' && state.phase === 'interval' && state.periodIndex >= state.durations.length - 1) next.phase = 'finished';
  else if (type === 'overtime' && state.phase === 'interval' && state.periodIndex >= state.durations.length - 1 && state.overtimeSeconds > 0) next = { ...next, phase: 'playing', durations: [...state.durations, state.overtimeSeconds], scores: [...next.scores, { A: 0, B: 0 }], periodIndex: state.periodIndex + 1, elapsed: 0, startedAt: at };
  else return state;
  return { ...next, history: [...state.history, before] };
}
export function undoPeriodAction(state, at) {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...previous, startedAt: previous.startedAt == null ? null : at, history: state.history.slice(0, -1) };
}
