// OPERATOR-side live broadcast mirror (issue dkt).
//
// Wires a local scorer to the Convex live backend WITHOUT ever owning the score:
// localStorage stays authoritative (§3.1). On go-live we `create` an idempotent
// live match; each local scoring action is mirrored as an `scorePoint`/`undo`
// event pushed through the offline-first OUTBOX (src/lib/live/outbox.js) and
// flushed optimistically. A failed/offline push NEVER throws into the scorer —
// the event stays queued and replays on reconnect (useLiveOutbox), and Convex
// dedups on `clientEventId` so reconnect storms never double-count (§12.2).
//
// clientEventId = `${clientMatchId}:${seq}` with a MONOTONIC `seq` persisted in
// the per-match session (liveSession.js). create is idempotent on
// owner+clientMatchId (§3.5), so a reload re-attaches to the SAME live match and
// the sequence simply continues — no fork, no double-count.

import { useCallback, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { enqueue } from '../lib/live/outbox';
import { useLiveOutbox } from './useLiveOutbox';
import { loadSession, saveSession } from '../lib/live/liveSession';

/**
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] master broadcast gate (kill-switch / opt-out)
 * @returns {{
 *   isLive: boolean,
 *   token: string|null,
 *   error: Error|null,
 *   goLive: (opts: object) => Promise<{token: string, matchId: string}|null>,
 *   point: (input: { team: 'A'|'B', value?: number, at: number }) => Promise<unknown>,
 *   undo: (input: { at: number }) => Promise<unknown>,
 *   finalize: () => Promise<unknown>,
 *   setVisibility: (visibility: 'public'|'unlisted'|'private') => Promise<unknown>,
 * }}
 */
export function useLiveBroadcast({ enabled = true } = {}) {
  const createM = useMutation(api.live.create);
  const scorePointM = useMutation(api.live.scorePoint);
  const undoM = useMutation(api.live.undo);
  const finalizeM = useMutation(api.live.finalize);
  const setVisibilityM = useMutation(api.live.setVisibility);

  const matchIdRef = useRef(null);
  const tokenRef = useRef(null);
  const clientMatchIdRef = useRef(null);
  const seqRef = useRef(0);

  const [token, setToken] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(null);

  // Replays ONE queued item through the matching mutation. Throws on failure so
  // the outbox keeps it (and the tail) queued for the next reconnect attempt.
  const sendFn = useCallback(
    async (item) => {
      const matchId = matchIdRef.current;
      if (!matchId) throw new Error('live match not created yet');
      if (item.kind === 'undo') {
        return undoM({ matchId, clientEventId: item.clientEventId, at: item.at });
      }
      return scorePointM({
        matchId,
        clientEventId: item.clientEventId,
        team: item.team,
        value: item.value,
        at: item.at,
      });
    },
    [scorePointM, undoM],
  );

  // useLiveOutbox owns the in-flight guard + online/visible reconnect replay.
  const { flush } = useLiveOutbox(sendFn, { enabled });

  const persistSeq = useCallback((seq) => {
    const cmid = clientMatchIdRef.current;
    if (!cmid) return;
    saveSession(cmid, { matchId: matchIdRef.current, token: tokenRef.current, seq });
  }, []);

  const goLive = useCallback(
    async (opts) => {
      if (!enabled || !opts?.clientMatchId) return null;
      clientMatchIdRef.current = opts.clientMatchId;

      // Re-attach to a prior session (reload mid-match) so the seq continues and
      // we never fork a second live match.
      const prior = loadSession(opts.clientMatchId);
      if (prior) {
        if (prior.matchId) matchIdRef.current = prior.matchId;
        if (prior.token) {
          tokenRef.current = prior.token;
          setToken(prior.token);
        }
        if (typeof prior.seq === 'number' && prior.seq > seqRef.current) {
          seqRef.current = prior.seq;
        }
      }

      try {
        const res = await createM({
          clientMatchId: opts.clientMatchId,
          sport: opts.sport,
          scorecardKind: opts.scorecardKind,
          teamA: opts.teamA,
          teamB: opts.teamB,
          visibility: opts.visibility ?? 'public',
          isYouthMatch: opts.isYouthMatch ?? false,
        });
        matchIdRef.current = res.matchId;
        tokenRef.current = res.token;
        setToken(res.token);
        setIsLive(true);
        setError(null);
        persistSeq(seqRef.current);
        void flush(); // replay anything queued while offline
        return res;
      } catch (e) {
        // Additive: a failed go-live must never break local scoring.
        setError(e instanceof Error ? e : new Error(String(e)));
        return null;
      }
    },
    [enabled, createM, flush, persistSeq],
  );

  const point = useCallback(
    ({ team, value = 1, at }) => {
      if (!enabled || !clientMatchIdRef.current) return Promise.resolve(null);
      seqRef.current += 1;
      const clientEventId = `${clientMatchIdRef.current}:${seqRef.current}`;
      enqueue({ kind: 'point', team, value, at, clientEventId });
      persistSeq(seqRef.current);
      return flush();
    },
    [enabled, flush, persistSeq],
  );

  const undo = useCallback(
    ({ at }) => {
      if (!enabled || !clientMatchIdRef.current) return Promise.resolve(null);
      seqRef.current += 1;
      const clientEventId = `${clientMatchIdRef.current}:${seqRef.current}`;
      enqueue({ kind: 'undo', at, clientEventId });
      persistSeq(seqRef.current);
      return flush();
    },
    [enabled, flush, persistSeq],
  );

  const finalize = useCallback(async () => {
    if (!enabled) return null;
    await flush(); // make a best effort to drain queued events first
    const matchId = matchIdRef.current;
    if (!matchId) return null;
    try {
      return await finalizeM({ matchId });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }, [enabled, flush, finalizeM]);

  const setVisibility = useCallback(
    async (visibility) => {
      if (!enabled) return null;
      const matchId = matchIdRef.current;
      if (!matchId) return null;
      try {
        return await setVisibilityM({ matchId, visibility });
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return null;
      }
    },
    [enabled, setVisibilityM],
  );

  return { isLive, token, error, goLive, point, undo, finalize, setVisibility };
}
