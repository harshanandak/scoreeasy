// Versioned match state. The clock basis changes only with time or a lifecycle action.
export function createPeriodMatch(rules, now) {
  const durations = [...rules.durations];
  return {
    version: 1, sport: rules.sport, source: rules.source,
    regulationCount: rules.regulationCount || durations.length,
    extraDurations: [...(rules.extraDurations || [])], overtimeSeconds: rules.overtimeSeconds || 0,
    durations, periodIndex: 0, phase: 'playing', elapsed: 0, startedAt: now,
    elapsedByPeriod: durations.map(() => 0), endedEarly: false,
    scores: durations.map(() => ({ A: 0, B: 0 })), events: [], history: [],
  };
}

function elapsedAt(state, now) {
  const extra = state.phase === 'playing' && state.startedAt != null
    ? Math.max(0, (now - state.startedAt) / 1000) : 0;
  return state.elapsed + extra;
}

export function periodElapsed(state, now) {
  return Math.min(state.durations[state.periodIndex], Math.floor(elapsedAt(state, now)));
}

function recordedElapsed(state) {
  if (state.elapsedByPeriod) return [...state.elapsedByPeriod];
  // Older period drafts kept ended-period time in their Undo frames.
  const recorded = [];
  for (const frame of state.history || []) {
    if (frame.phase === 'interval') recorded[frame.periodIndex] = frame.elapsed;
  }
  return state.durations.map((duration, i) => recorded[i] ?? (i < state.periodIndex ? duration : 0));
}

function checkpointElapsed(state, at) {
  const elapsed = recordedElapsed(state);
  elapsed[state.periodIndex] = Math.max(elapsed[state.periodIndex] || 0, elapsedAt(state, at));
  return elapsed;
}

export function periodPlayedSeconds(state, at) {
  return Math.floor(checkpointElapsed(state, at).reduce((sum, elapsed) => sum + elapsed, 0));
}

export function freezePeriodMatch(state, at, decided = false) {
  const elapsedByPeriod = checkpointElapsed(state, at);
  return { ...state, elapsedByPeriod, elapsed: elapsedByPeriod[state.periodIndex], startedAt: null,
    phase: decided ? 'finished' : state.phase };
}

export function readPeriodMatch(value) {
  return value?.version === 1 ? { ...value, elapsedByPeriod: recordedElapsed(value) } : { ...value, legacy: true };
}

export function applyPeriodAction(state, action) {
  const { type, at } = action;
  const elapsedByPeriod = checkpointElapsed(state, at);
  const before = { ...state, elapsed: elapsedByPeriod[state.periodIndex], startedAt: state.startedAt == null ? null : at,
    actionType: type, actionAt: at, eventCount: state.events?.length || 0 };
  delete before.history;
  delete before.events;
  // Playing time is a ledger, not undoable state. Each frame keeps only lifecycle and score state.
  delete before.elapsedByPeriod;
  let next = { ...state, elapsedByPeriod, scores: state.scores.map(score => ({ ...score })) };
  if (type === 'score' && state.phase !== 'finished' && ['A', 'B'].includes(action.team)) {
    let index = state.periodIndex;
    if (action.value < 0) {
      while (index > 0 && next.scores[index][action.team] === 0) index -= 1;
    }
    const value = Math.max(-next.scores[index][action.team], action.value);
    if (value === 0) return state;
    next.scores[index][action.team] += value;
    next.events = [...(state.events || []), { team: action.team, value, period: index + 1, elapsed: before.elapsed, at }];
  } else if (type === 'pause' && state.phase === 'playing' && state.startedAt != null) {
    next = { ...next, elapsed: before.elapsed, startedAt: null };
  } else if (type === 'resume' && state.phase === 'playing' && state.startedAt == null) {
    next = { ...next, elapsed: before.elapsed, startedAt: at };
  } else if (type === 'endPeriod' && state.phase === 'playing') {
    next = { ...next, phase: 'interval', endedEarly: state.endedEarly || before.elapsed < state.durations[state.periodIndex], elapsed: before.elapsed, startedAt: null };
  } else if (type === 'startPeriod' && state.phase === 'interval' && state.periodIndex < state.durations.length - 1) {
    next = { ...next, phase: 'playing', periodIndex: state.periodIndex + 1, elapsed: elapsedByPeriod[state.periodIndex + 1] || 0, startedAt: at };
  } else if (type === 'finish' && state.phase === 'interval' && state.periodIndex >= state.durations.length - 1) {
    next = { ...next, phase: 'finished', elapsed: before.elapsed, startedAt: null };
  } else if (type === 'overtime' && state.phase === 'interval' && state.periodIndex >= state.durations.length - 1 && (state.overtimeSeconds > 0 || state.extraDurations?.length > 0)) {
    const extra = state.extraDurations?.length ? state.extraDurations : [state.overtimeSeconds];
    next = { ...next, phase: 'playing', durations: [...state.durations, ...extra], extraDurations: [],
      scores: [...next.scores, ...extra.map(() => ({ A: 0, B: 0 }))],
      periodIndex: state.periodIndex + 1, elapsed: elapsedByPeriod[state.periodIndex + 1] || 0, startedAt: at };
  } else return state;
  return { ...next, history: [...state.history, before] };
}

export function undoPeriodAction(state, at) {
  const previous = state.history.at(-1);
  if (!previous) return state;
  const { eventCount, events, actionType, actionAt: _actionAt, elapsedByPeriod: _oldElapsed, ...snapshot } = previous;
  const elapsedByPeriod = checkpointElapsed(state, at);
  // Untagged frames from older drafts can still identify a score edit by its score change.
  const scoreEdit = actionType === 'score' || (!actionType && previous.scores.some((s, i) => s.A !== state.scores[i]?.A || s.B !== state.scores[i]?.B));
  const clock = scoreEdit ? { elapsed: state.elapsed, startedAt: state.startedAt }
    : { elapsed: elapsedByPeriod[previous.periodIndex] ?? previous.elapsed, startedAt: previous.startedAt == null ? null : at };
  return { ...snapshot, ...clock, elapsedByPeriod, events: events || (state.events || []).slice(0, eventCount), history: state.history.slice(0, -1) };
}

export const supportsGoalPeriods = sport => ['football', 'basketball', 'hockey'].includes(sport);

export function periodPreset(sport, preset = 'official', count, minutes) {
  const defaults = sport === 'football' ? [2, 45, 'IFAB 2026/27'] : sport === 'basketball' ? [4, 10, 'FIBA 5-on-5 2024'] : [4, 15, 'FIH outdoor 2027'];
  const n = Math.max(1, Math.min(8, Math.round(Number(count)) || defaults[0]));
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
  const otherPeriods = recordedElapsed(state).reduce((sum, elapsed, i) => sum + (i === state.periodIndex ? 0 : elapsed), 0);
  return { sport: state.sport, phase: state.phase, elapsed: state.elapsed, startedAt: state.startedAt, duration: state.durations[state.periodIndex], periodIndex: state.periodIndex, regulationCount: state.regulationCount || state.durations.length,
    playedSeconds: Math.floor(otherPeriods + state.elapsed) };
}

export function clockRemaining(clock, now) {
  const extra = clock.phase === 'playing' && clock.startedAt != null ? Math.max(0, (now - clock.startedAt) / 1000) : 0;
  return Math.max(0, clock.duration - Math.floor(clock.elapsed + extra));
}

export const formatPeriodClock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function periodResultDecided(state, a, b, drawAllowed) {
  return !(a === b && state.extraDurations?.length > 0) && !state.endedEarly && state.phase !== 'playing' && state.periodIndex === state.durations.length - 1 && (drawAllowed || a !== b);
}


export function periodSnapshot(state, pointsA, pointsB) {
  return { pointsA, pointsB, setsA: 0, setsB: 0, setScores: state.scores.map(s => ({ a: s.A, b: s.B })),
    currentUnit: state.periodIndex + 1, periodLabel: periodLabel(state), periodClock: periodClock(state) };
}
