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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { enqueue, size } from '../lib/live/outbox';
import { useLiveOutbox } from './useLiveOutbox';
import { loadSession, saveSession } from '../lib/live/liveSession';

/**
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] master broadcast gate (kill-switch / opt-out)
 * @returns {{
 *   isLive: boolean,
 *   isShared: boolean,
 *   restore: (opts: {clientMatchId: string}) => Promise<object|null>,
 *   token: string|null,
 *   error: Error|null,
 *   goLive: (opts: object) => Promise<{token: string, matchId: string}|null>,
 *   point: (input: { team: 'A'|'B', value?: number, at: number, type?: 'point'|'serve_change'|'correction' }) => Promise<unknown>,
 *   undo: (input: { at: number }) => Promise<unknown>,
 *   finalize: () => Promise<unknown>,
 *   setVisibility: (visibility: 'public'|'unlisted'|'private', opts?: object) => Promise<unknown>,
 *   reset: () => void,
 * }}
 */
export function useLiveBroadcast({ enabled = true } = {}) {
  const convex = useConvex();
  const createM = useMutation(api.live.create);
  const scorePointM = useMutation(api.live.scorePoint);
  const undoM = useMutation(api.live.undo);
  const finalizeM = useMutation(api.live.finalize);
  const setVisibilityM = useMutation(api.live.setVisibility);

  const matchIdRef = useRef(null);
  const tokenRef = useRef(null);
  const clientMatchIdRef = useRef(null);
  const seqRef = useRef(0);
  const generationRef = useRef(0);
  const publishingRef = useRef(false);

  const [token, setToken] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState(null);

  // Replays ONE queued item through the matching mutation. Throws on failure so
  // the outbox keeps it (and the tail) queued for the next reconnect attempt.
  const sendFn = useCallback(
    async (item) => {
      const matchId = matchIdRef.current;
      if (!matchId) throw new Error('live match not created yet');
      // Drop events belonging to a DIFFERENT match — the outbox is a single shared
      // queue, so a stale tail from a prior match must not be mis-delivered to the
      // current one. Resolving (not throwing) lets reconcile remove it.
      if (item.clientMatchId && item.clientMatchId !== clientMatchIdRef.current) {
        return undefined;
      }
      try {
        if (item.kind === 'undo') {
          return await undoM({
            matchId,
            clientEventId: item.clientEventId,
            at: item.at,
            snapshot: item.snapshot,
          });
        }
        return await scorePointM({
          matchId,
          clientEventId: item.clientEventId,
          team: item.team,
          value: item.value,
          // Older queued items have no `type`; the mutation defaults it to "point".
          type: item.type,
          ...(item.kabaddi ? { kabaddi: item.kabaddi } : {}),
          at: item.at,
          snapshot: item.snapshot,
        });
      } catch (e) {
        // A finalized match permanently rejects new events; drop the item so it
        // can't poison-loop the outbox (the match is over; local score stands).
        // Convex REDACTS Error messages in production, so we key off the
        // ConvexError structured `data.code` (which IS delivered to clients);
        // the message check is only a dev/edge-runtime fallback. Other
        // (transient/offline) errors propagate so the item stays queued.
        const code = e && typeof e === 'object' ? e.data?.code : undefined;
        const msg = e instanceof Error ? e.message : String(e);
        if (code === 'match_final' || /final/i.test(msg)) {
          return undefined;
        }
        throw e;
      }
    },
    [scorePointM, undoM],
  );

  // useLiveOutbox owns the in-flight guard + online/visible reconnect replay.
  const { flush } = useLiveOutbox(sendFn, { enabled });
  useEffect(() => {
    if (enabled && isShared) void flush();
  }, [enabled, isShared, flush]);

  const persistSeq = useCallback((seq) => {
    const cmid = clientMatchIdRef.current;
    if (!cmid) return;
    saveSession(cmid, { matchId: matchIdRef.current, token: tokenRef.current, seq });
  }, []);

  const restore = useCallback(async ({ clientMatchId }) => {
    const generation = ++generationRef.current;
    clientMatchIdRef.current = clientMatchId;
    matchIdRef.current = null;
    tokenRef.current = null;
    setToken(null);
    setIsLive(false);
    setIsShared(false);
    try {
      const session = await convex.query(api.live.getOwnedSession, { clientMatchId });
      if (generation !== generationRef.current) return null;
      const prior = loadSession(clientMatchId);
      clientMatchIdRef.current = clientMatchId;
      matchIdRef.current = session?.matchId ?? null;
      tokenRef.current = session?.token ?? null;
      seqRef.current = Math.max(session?.lastSeq ?? 0, prior?.seq ?? 0);
      setToken(tokenRef.current);
      setIsLive(Boolean(session?.isShared));
      setIsShared(Boolean(session?.isShared));
      if (session) persistSeq(seqRef.current);
      return session;
    } catch (e) {
      if (generation === generationRef.current) setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }, [convex, persistSeq]);

  const goLive = useCallback(
    async (opts) => {
      if (!enabled || !opts?.clientMatchId || publishingRef.current) return null;
      const generation = ++generationRef.current;
      publishingRef.current = true;
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
          ...(opts.players ? { players: opts.players } : {}),
          ...(opts.kabaddiHistory ? { kabaddiHistory: opts.kabaddiHistory } : {}),
          visibility: 'private',
          isYouthMatch: opts.isYouthMatch ?? false,
        });
        if (generation !== generationRef.current) return null;
        matchIdRef.current = res.matchId;
        tokenRef.current = res.token;
        setToken(res.token);
        // Drain older deltas first; they must never overwrite the publication snapshot.
        const drained = await flush();
        if (drained?.error || size() > 0) throw new Error('Waiting for queued scores to sync');
        const snapshot = opts.getSnapshot ? opts.getSnapshot() : opts.snapshot;
        if (!snapshot) throw new Error('Sharing requires the current score snapshot');
        if (generation !== generationRef.current) return null;
        await setVisibilityM({ matchId: res.matchId, visibility: opts.visibility ?? 'public', snapshot });
        if (generation !== generationRef.current) return null;
        setIsLive(opts.visibility !== 'private');
        setIsShared(opts.visibility !== 'private');
        setError(null);
        persistSeq(seqRef.current);
        return res;
      } catch (e) {
        // Additive: a failed go-live must never break local scoring.
        setError(e instanceof Error ? e : new Error(String(e)));
        return null;
      } finally {
        publishingRef.current = false;
        void flush();
      }
    },
    [enabled, createM, setVisibilityM, flush, persistSeq],
  );

  const point = useCallback(
    ({ team, value = 1, at, snapshot, type = 'point', kabaddi }) => {
      if (!enabled || !clientMatchIdRef.current) return Promise.resolve(null);
      seqRef.current += 1;
      const clientMatchId = clientMatchIdRef.current;
      const clientEventId = type === 'kabaddi_raid' && kabaddi?.kind === 'raid' ? `kabaddi-raid:${kabaddi.raid.id}` : `${clientMatchId}:${seqRef.current}`;
      // snapshot (engine-derived sets/serving/period for non-flat sports) + the
      // owning clientMatchId travel WITH the event through the outbox to the mutation.
      // `kind` stays 'point' (the outbox routing discriminator vs 'undo'); `type` is
      // the public EVENT type (point | serve_change | correction) the spectator feed
      // labels by. Both ride along so a queued event keeps its label while offline.
      enqueue({ kind: 'point', type, team, value, at, snapshot, ...(kabaddi ? { kabaddi } : {}), clientMatchId, clientEventId });
      persistSeq(seqRef.current);
      return publishingRef.current ? Promise.resolve(null) : flush();
    },
    [enabled, flush, persistSeq],
  );

  const undo = useCallback(
    ({ at, snapshot }) => {
      if (!enabled || !clientMatchIdRef.current) return Promise.resolve(null);
      seqRef.current += 1;
      const clientMatchId = clientMatchIdRef.current;
      const clientEventId = `${clientMatchId}:${seqRef.current}`;
      enqueue({ kind: 'undo', at, snapshot, clientMatchId, clientEventId });
      persistSeq(seqRef.current);
      return publishingRef.current ? Promise.resolve(null) : flush();
    },
    [enabled, flush, persistSeq],
  );

  const finalize = useCallback(async ({ resultType } = {}) => {
    if (!enabled) return null;
    // Drain DETERMINISTICALLY before archiving. flush() now AWAITS any in-flight
    // point() drain (instead of no-op'ing), so finalize cannot race ahead of the
    // last tap and make the backend archive a final score missing that point.
    // Stop early on a network error: queued points replay on reconnect.
    for (let i = 0; i < 10 && size() > 0; i += 1) {
      const result = await flush();
      if (result?.error) break;
    }
    // If the outbox STILL has undrained events (offline / network error broke the
    // loop above), do NOT archive — finalizing now would persist a final score
    // missing the queued tail. Leave the match live: the tail replays on
    // reconnect and the match stales/auto-expires server-side until then. The
    // local scorer's score stays authoritative regardless.
    if (size() > 0) return null;
    const matchId = matchIdRef.current;
    if (!matchId) return null;
    try {
      return await finalizeM({ matchId, ...(resultType ? { resultType } : {}) });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }, [enabled, flush, finalizeM]);

  const setVisibility = useCallback(
    async (visibility, opts) => {
      // NOT gated by `enabled`: visibility control must work whenever a match
      // exists — in particular "Stop" sets enabled=false, so resuming
      // (setVisibility('public')) would be a silent no-op if gated, leaving the
      // match live-but-private while the UI says "LIVE · public". The matchId
      // guard already prevents acting before a match is created.
      const matchId = matchIdRef.current;
      if (!matchId) return null;
      ++generationRef.current;
      try {
        const snapshot = opts?.getSnapshot ? opts.getSnapshot() : opts?.snapshot;
        const result = await setVisibilityM({ matchId, visibility, ...(snapshot ? { snapshot } : {}) });
        setIsShared(visibility !== 'private');
        setIsLive(visibility !== 'private');
        setError(null);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return null;
      }
    },
    [setVisibilityM],
  );

  // Drop the current live session so the NEXT goLive starts clean. Needed when one
  // mounted scorer hosts multiple matches in a row (e.g. quick match): without this
  // the refs/state retain the prior match's id/token/seq, so a new match could
  // mis-deliver early events to the old one. Route-based scorers remount instead.
  const reset = useCallback(() => {
    ++generationRef.current;
    matchIdRef.current = null;
    tokenRef.current = null;
    clientMatchIdRef.current = null;
    seqRef.current = 0;
    setToken(null);
    setIsLive(false);
    setIsShared(false);
    setError(null);
  }, []);

  return { isLive, isShared, token, error, restore, goLive, point, undo, finalize, setVisibility, reset };
}
