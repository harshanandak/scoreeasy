import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';

export const ScoringProgressContext = createContext(null);
export const ScoringBoardContext = createContext(null);

// Board chrome is independent of the first-point latch used by the leave guard.
export function useScoringBoard(visible = true) {
  const registerBoard = useContext(ScoringBoardContext);
  useLayoutEffect(() => (visible ? registerBoard?.() : undefined), [visible, registerBoard]);
}

// Keep navigation progress outside Undo snapshots; scorers persist this in their draft.
export function useScoringProgress(hasRecordedScore, reset = false, savedStarted = false, matchKey, boardVisible = !reset) {
  // Quick setup resets progress; dedicated scorer routes mount directly on the board.
  // A scorer with an embedded setup phase supplies its visibility explicitly.
  useScoringBoard(boardVisible);
  const markStarted = useContext(ScoringProgressContext);
  const latch = useRef({ matchKey, started: false });
  if (latch.current.matchKey !== matchKey) {
    // The old match's scores can remain until its replacement hydrates.
    latch.current = { matchKey, started: false };
  } else if (reset) latch.current.started = false;
  else if (hasRecordedScore || savedStarted) latch.current.started = true;
  const scoringStarted = latch.current.started;
  useEffect(() => {
    if (reset) markStarted?.(false);
    else if (scoringStarted) markStarted?.(true);
  }, [scoringStarted, reset, markStarted]);
  return {
    scoringStarted,
    resetScoringStarted() {
      latch.current.started = false;
      markStarted?.(false);
    },
    recordScoringStarted(hasProgress) {
      if (hasProgress) latch.current.started = true;
      if (latch.current.started) markStarted?.(true);
      return latch.current.started;
    },
  };
}
