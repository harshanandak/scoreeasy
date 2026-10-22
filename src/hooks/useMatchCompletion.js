import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const isCompletedMatch = (match) => match?.status === 'completed';

// Hydration and Finish share one authority: a persisted result is already committed.
export function useMatchCompletion(initialMatch = null, initialIdentity = null) {
  const locked = useRef(isCompletedMatch(initialMatch));
  const committed = useRef(isCompletedMatch(initialMatch));
  const identity = useRef(initialIdentity);
  const committing = useRef(false);
  const timeout = useRef(null);
  const navigationStarted = useRef(false);
  const [isCompleting, setIsCompleting] = useState(() => isCompletedMatch(initialMatch));

  useEffect(() => () => globalThis.clearTimeout(timeout.current), []);

  const reset = useCallback(() => {
    globalThis.clearTimeout(timeout.current);
    timeout.current = null;
    locked.current = false;
    committed.current = false;
    committing.current = false;
    navigationStarted.current = false;
    identity.current = null;
    setIsCompleting(false);
  }, []);

  const leave = useCallback((navigate, delay = 0) => {
    if (!committed.current || navigationStarted.current) return;
    navigationStarted.current = true;
    if (delay) timeout.current = globalThis.setTimeout(navigate, delay);
    else navigate();
  }, []);

  const hydrate = useCallback((match, matchIdentity, navigate) => {
    if (identity.current !== matchIdentity) {
      reset();
      identity.current = matchIdentity;
    }
    if (!isCompletedMatch(match)) return false;
    locked.current = true;
    committed.current = true;
    setIsCompleting(true);
    if (navigate) leave(navigate);
    return true;
  }, [leave, reset]);

  const lock = useCallback(() => {
    if (locked.current) return false;
    locked.current = true;
    setIsCompleting(true);
    return true;
  }, []);

  const complete = useCallback((commit, navigate, delay = 0) => {
    if (committed.current || committing.current) return false;
    lock();
    committing.current = true;
    let saved;
    try {
      saved = commit();
    } catch (error) {
      locked.current = false;
      committing.current = false;
      setIsCompleting(false);
      throw error;
    }
    if (saved === false) {
      locked.current = false;
      committing.current = false;
      setIsCompleting(false);
      return false;
    }
    committed.current = true;
    committing.current = false;
    if (navigate) leave(navigate, delay);
    return true;
  }, [leave, lock]);

  return useMemo(() => ({
    get locked() { return locked.current; },
    get committed() { return committed.current; },
    isCompleting,
    complete,
    hydrate,
    reset,
    leave,
    lock,
  }), [complete, hydrate, isCompleting, reset, leave, lock]);
}
