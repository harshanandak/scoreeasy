export function getBasketballCompletionState({
  score1,
  score2,
  drawAllowed,
  overtimePeriod = 0,
} = {}) {
  if (drawAllowed || score1 !== score2) {
    return {
      canComplete: true,
      nextAction: 'complete',
      message: '',
    };
  }

  return {
    canComplete: false,
    nextAction: 'overtime',
    message: overtimePeriod > 0
      ? 'Continue overtime until one team leads.'
      : 'Start overtime to resolve the tie.',
  };
}

export function getFootballClockState({
  elapsedSeconds,
  halfLengthSeconds,
  halftimeHoldSeconds = 0,
} = {}) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const halfLength = Math.max(1, Number(halfLengthSeconds) || 2700);
  const halftimeEnd = halfLength + Math.max(0, Number(halftimeHoldSeconds) || 0);
  const fullTime = halfLength * 2 + Math.max(0, Number(halftimeHoldSeconds) || 0);

  if (elapsed < halfLength) {
    return {
      phase: 'first-half',
      label: '1st Half',
      half: 1,
      remainingSeconds: halfLength - elapsed,
    };
  }

  if (elapsed <= halftimeEnd) {
    return {
      phase: 'halftime',
      label: 'Half Time',
      half: 1,
      remainingSeconds: 0,
    };
  }

  if (elapsed < fullTime) {
    return {
      phase: 'second-half',
      label: '2nd Half',
      half: 2,
      remainingSeconds: fullTime - elapsed,
    };
  }

  return {
    phase: 'full-time',
    label: 'Full Time',
    half: 2,
    remainingSeconds: 0,
  };
}

export function getFootballHalfLengthSeconds({
  timeLimitSeconds,
  timePresets = [],
} = {}) {
  const timeLimit = Math.max(1, Number(timeLimitSeconds) || 0);
  const preset = timePresets.find((candidate) => Number(candidate.value) === timeLimit);
  if (/\bhalf\b/i.test(preset?.label || '')) {
    return timeLimit;
  }
  return Math.max(1, Math.floor(timeLimit / 2));
}

export function getFootballMatchLimitSeconds({
  timeLimitSeconds,
  timePresets = [],
} = {}) {
  return getFootballHalfLengthSeconds({ timeLimitSeconds, timePresets }) * 2;
}

/**
 * Return the elapsed-second boundary for the current timed scoring period.
 * Each overtime period adds one more base timeLimit window.
 */
export function getTimedPeriodLimit({
  timeLimit,
  overtimePeriod = 0,
} = {}) {
  const baseLimit = Math.max(0, Number(timeLimit) || 0);
  const periods = 1 + Math.max(0, Number(overtimePeriod) || 0);
  return baseLimit * periods;
}

/**
 * Return non-negative seconds remaining in the current timed scoring period.
 */
export function getTimedRemainingSeconds({
  elapsedSeconds,
  timeLimit,
  overtimePeriod = 0,
} = {}) {
  const periodLimit = getTimedPeriodLimit({ timeLimit, overtimePeriod });
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  return Math.max(0, periodLimit - elapsed);
}
