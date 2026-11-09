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
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { enqueue, size } from '../lib/live/outbox';
import { flushLiveSession } from '../lib/live/recovery';
import { loadSession, saveSession, liveClientMatchId } from '../lib/live/liveSession';

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
 *   finalize: (input?: {resultType?: 'decided'|'abandoned', snapshot?: object}) => Promise<unknown>,
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
  const [failure, setFailure] = useState(null);
  const error = failure?.error ?? null;
  const setError = useCallback((value) => {
    setFailure(value ? { error: value, source: 'operation' } : null);
  }, []);

  const flush = useCallback(async () => {
    const clientMatchId = clientMatchIdRef.current;
    const result = await flushLiveSession(clientMatchId, { scorePoint: scorePointM, undo: undoM, finalize: finalizeM,
      getOwnedSession: clientMatchId => convex.query(api.live.getOwnedSession, { clientMatchId }) });
    if (clientMatchId === clientMatchIdRef.current) {
      setFailure(current => result?.error
        ? { error: result.error, source: 'drain' }
        : current?.source === 'drain' ? null : current);
    }
    return result;
  }, [convex, scorePointM, undoM, finalizeM]);

  const persistSeq = useCallback((seq, sharing = {}) => {
    const cmid = clientMatchIdRef.current;
    if (!cmid) return;
    const prior = loadSession(cmid);
    saveSession(cmid, { ...prior, isShared: prior?.isShared === true, matchId: matchIdRef.current ?? prior?.matchId, token: tokenRef.current ?? prior?.token, seq: Math.max(seq, prior?.seq ?? 0), ...sharing });
  }, []);

  const restore = useCallback(async ({ clientMatchId: baseId }) => {
    const clientMatchId = liveClientMatchId(baseId);
    const generation = ++generationRef.current;
    clientMatchIdRef.current = clientMatchId;
    matchIdRef.current = null;
    tokenRef.current = null;
    setToken(null);
    setIsLive(false);
    setIsShared(false);
    const pending = loadSession(clientMatchId);
    seqRef.current = pending?.seq ?? 0;
    if (pending?.broadcastError) {
      setError(new Error(pending.broadcastError.message));
      return null;
    }
    // Restore pending work before the network query, which can wait while offline.
    if (pending?.finalizeIntent) {
      matchIdRef.current = pending.matchId;
      tokenRef.current = pending.token;
      seqRef.current = pending.seq ?? 0;
      setToken(pending.token ?? null);
    }
    try {
      const session = await convex.query(api.live.getOwnedSession, { clientMatchId });
      if (generation !== generationRef.current) return null;
      const prior = loadSession(clientMatchId);
      clientMatchIdRef.current = clientMatchId;
      matchIdRef.current = session?.matchId ?? (prior?.finalizeIntent ? prior.matchId : null);
      tokenRef.current = session?.token ?? (prior?.finalizeIntent ? prior.token : null);
      seqRef.current = Math.max(session?.lastSeq ?? 0, prior?.seq ?? 0);
      setToken(tokenRef.current);
      setIsLive(Boolean(session?.isShared));
      setIsShared(Boolean(session?.isShared));
      if (session) persistSeq(seqRef.current, { isShared: session.isShared === true });
      return session;
    } catch (e) {
      if (generation === generationRef.current) setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }, [convex, persistSeq]);

  const goLive = useCallback(
    async (opts) => {
      if (!enabled || !opts?.clientMatchId || publishingRef.current) return null;
      const clientMatchId = liveClientMatchId(opts.clientMatchId);
      const generation = ++generationRef.current;
      publishingRef.current = true;
      clientMatchIdRef.current = clientMatchId;

      // Re-attach to a prior session (reload mid-match) so the seq continues and
      // we never fork a second live match.
      const prior = loadSession(clientMatchId);
      if (prior?.broadcastError) {
        setError(new Error(prior.broadcastError.message));
        publishingRef.current = false;
        return null;
      }
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
          clientMatchId,
          sport: opts.sport,
          scorecardKind: opts.scorecardKind,
          teamA: opts.teamA,
          teamB: opts.teamB,
          ...(opts.players ? { players: opts.players } : {}),
          visibility: 'private',
          isYouthMatch: opts.isYouthMatch ?? false,
        });
        if (generation !== generationRef.current) return null;
        matchIdRef.current = res.matchId;
        tokenRef.current = res.token;
        setToken(res.token);
        persistSeq(seqRef.current);
        // Drain older deltas first; they must never overwrite the publication snapshot.
        const drained = await flush();
        if (drained?.error || size(clientMatchId) > 0) throw new Error('Waiting for queued scores to sync');
        const snapshot = opts.getSnapshot ? opts.getSnapshot() : opts.snapshot;
        if (!snapshot) throw new Error('Sharing requires the current score snapshot');
        if (generation !== generationRef.current) return null;
        await setVisibilityM({ matchId: res.matchId, visibility: opts.visibility ?? 'public', snapshot, ...(snapshot.kabaddi ? { kabaddiHistory: opts.getKabaddiHistory ? opts.getKabaddiHistory() : opts.kabaddiHistory ?? [] } : {}) });
        if (generation !== generationRef.current) return null;
        setIsLive(opts.visibility !== 'private');
        setIsShared(opts.visibility !== 'private');
        setError(null);
        persistSeq(seqRef.current, { isShared: opts.visibility !== 'private' });
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
      if (!enabled || !clientMatchIdRef.current || loadSession(clientMatchIdRef.current)?.broadcastError) return Promise.resolve(null);
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
      if (!enabled || !clientMatchIdRef.current || loadSession(clientMatchIdRef.current)?.broadcastError) return Promise.resolve(null);
      seqRef.current += 1;
      const clientMatchId = clientMatchIdRef.current;
      const clientEventId = `${clientMatchId}:${seqRef.current}`;
      enqueue({ kind: 'undo', at, snapshot, clientMatchId, clientEventId });
      persistSeq(seqRef.current);
      return publishingRef.current ? Promise.resolve(null) : flush();
    },
    [enabled, flush, persistSeq],
  );

  const finalize = useCallback(async ({ resultType, snapshot } = {}) => {
    const clientMatchId = clientMatchIdRef.current;
    const prior = loadSession(clientMatchId);
    if (!clientMatchId || prior?.broadcastError || prior?.isShared !== true
      || (!matchIdRef.current && !snapshot)) return null;
    seqRef.current = Math.max(seqRef.current, prior?.seq ?? 0);
    if (snapshot) {
      seqRef.current += 1;
      // The server orders events; a restore-time id must not trust the cached sequence.
      const clientEventId = matchIdRef.current ? `${clientMatchId}:${seqRef.current}` : `${clientMatchId}:finalize:${crypto.randomUUID()}`;
      enqueue({ kind: 'point', team: 'A', value: 0, type: 'correction', at: Date.now(), snapshot, clientMatchId, clientEventId });
    }
    saveSession(clientMatchId, {
      ...prior,
      isShared: true,
      matchId: matchIdRef.current ?? prior?.matchId,
      token: tokenRef.current ?? prior?.token,
      seq: seqRef.current,
      finalizeIntent: { ...(resultType ? { resultType } : {}), shared: true },
    });
    // Root recovery owns a finish even if this scorer leaves before restore resolves.
    if (!matchIdRef.current) return null;
    const result = await flush();
    return result?.finalized ?? null;
  }, [flush]);

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
        const result = await setVisibilityM({ matchId, visibility, ...(snapshot ? { snapshot } : {}), ...(visibility !== 'private' && snapshot?.kabaddi ? { kabaddiHistory: opts?.getKabaddiHistory ? opts.getKabaddiHistory() : opts?.kabaddiHistory ?? [] } : {}) });
        setIsShared(visibility !== 'private');
        setIsLive(visibility !== 'private');
        const clientMatchId = clientMatchIdRef.current;
        saveSession(clientMatchId, { ...loadSession(clientMatchId), isShared: visibility !== 'private' });
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
