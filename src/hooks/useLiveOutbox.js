// Thin reconnect driver for the broadcast OUTBOX.
//
// Keeps the CORE (src/lib/live/outbox.js) pure: this hook only decides WHEN
// to drain. It calls `reconcile(sendFn)` when the app comes back online or
// regains foreground visibility (§3.4 — replay on reconnect). localStorage
// stays authoritative, so a failed drain never blocks local scoring; the
// queue is simply retried on the next online/visible event.

import { useCallback, useEffect, useRef } from 'react';
import { reconcile } from '../lib/live/outbox';

/**
 * @param {(item: object) => Promise<unknown>} sendFn  replays one queued event
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]  gate replay (e.g. broadcast kill-switch, §12.2)
 * @returns {{ flush: () => Promise<object|null> }}
 */
export function useLiveOutbox(sendFn, { enabled = true } = {}) {
  const sendFnRef = useRef(sendFn);
  const inFlightRef = useRef(false);
  const inFlightPromiseRef = useRef(null);

  useEffect(() => {
    sendFnRef.current = sendFn;
  }, [sendFn]);

  // Drains the queue once. Concurrent callers are COALESCED onto the same
  // in-flight drain (returns its promise) rather than no-op'ing — so a caller
  // that must wait for the queue to be sent before acting (e.g. finalize racing
  // a point's optimistic flush) actually awaits the drain instead of racing
  // ahead. This still guarantees the reconcile loop runs at most once at a time,
  // so `online` + `visibilitychange` firing together never double-drain.
  const flush = useCallback(async () => {
    if (!enabled || typeof sendFnRef.current !== 'function') return null;
    if (inFlightRef.current && inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }
    inFlightRef.current = true;
    const drain = (async () => {
      try {
        return await reconcile((item) => sendFnRef.current(item));
      } finally {
        inFlightRef.current = false;
        inFlightPromiseRef.current = null;
      }
    })();
    inFlightPromiseRef.current = drain;
    return drain;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onOnline = () => {
      void flush();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void flush();
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, flush]);

  return { flush };
}
