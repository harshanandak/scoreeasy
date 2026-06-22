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

  useEffect(() => {
    sendFnRef.current = sendFn;
  }, [sendFn]);

  // Drains the queue once. In-flight guard prevents `online` and
  // `visibilitychange` firing together from double-draining.
  const flush = useCallback(async () => {
    if (!enabled || inFlightRef.current || typeof sendFnRef.current !== 'function') {
      return null;
    }
    inFlightRef.current = true;
    try {
      return await reconcile((item) => sendFnRef.current(item));
    } finally {
      inFlightRef.current = false;
    }
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
