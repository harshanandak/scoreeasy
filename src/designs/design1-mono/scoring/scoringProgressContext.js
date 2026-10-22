import { createContext, useContext, useEffect } from 'react';

export const ScoringProgressContext = createContext(null);

// The shell latches progress for this scorer visit, including after Undo to zero.
export function useScoringProgress(hasRecordedScore, reset = false) {
  const markStarted = useContext(ScoringProgressContext);
  useEffect(() => {
    if (reset) markStarted?.(false);
    else if (hasRecordedScore) markStarted?.(true);
  }, [hasRecordedScore, reset, markStarted]);
  return markStarted;
}
