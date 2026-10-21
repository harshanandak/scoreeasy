import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// The ref closes the event-handler window before React renders disabled controls.
// Only a failed durable save releases the lock; navigation never releases it.
export function useMatchCompletion() {
  const locked = useRef(false);
  const committed = useRef(false);
  const committing = useRef(false);
  const timeout = useRef(null);
  const navigationStarted = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => () => globalThis.clearTimeout(timeout.current), []);

  const reset = useCallback(() => {
    globalThis.clearTimeout(timeout.current);
    timeout.current = null;
    locked.current = false;
    committed.current = false;
    committing.current = false;
    navigationStarted.current = false;
    setIsCompleting(false);
  }, []);

  const leave = useCallback((navigate, delay = 0) => {
    if (!committed.current || navigationStarted.current) return;
    navigationStarted.current = true;
    if (delay) timeout.current = globalThis.setTimeout(navigate, delay);
    else navigate();
  }, []);

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
    reset,
    leave,
    lock,
  }), [complete, isCompleting, reset, leave, lock]);
}
