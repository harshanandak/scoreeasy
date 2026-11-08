import { useEffect, useState } from 'react';
import { periodElapsed, periodClock, formatPeriodClock, periodLabel } from '../utils/goalsPeriods';

export function useGoalsPeriodClock(state) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!state) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 250);
    globalThis.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); globalThis.removeEventListener('visibilitychange', tick); };
  }, [state]);
  if (!state) return null;
  const elapsed = periodElapsed(state, now);
  const remaining = state.durations[state.periodIndex] - elapsed;
  return { elapsed, remaining, formatted: formatPeriodClock(remaining), label: periodLabel(state), clock: periodClock(state), paused: state.startedAt == null };
}
