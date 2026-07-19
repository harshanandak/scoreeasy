import { createContext, useContext } from 'react';

// App-owned seam for finishing a protected scorer.
//
// A completed match lands on the FULL-TIME result screen, but the active-scoring
// guard has pushed extra `gameProtection` history entries on top of the scorer
// entry. A plain `navigate(result, { replace: true })` only replaces the top guard
// entry, leaving the scorer entry in the back-stack — so Back from Result returns
// the user to the frozen, completed scorer. The app root provides an implementation
// that unwinds the scorer + guard entries and lands Result on the pre-scorer route;
// scoring screens consume it here.
//
// Default is null so a scorer rendered without the provider (e.g. an isolated unit
// test) falls back to a direct replace navigation.
export const ScoringCompletionContext = createContext(null);

export function useScoringCompletion() {
  return useContext(ScoringCompletionContext);
}
