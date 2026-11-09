import { enqueue, reconcile, removeSessionItems, size } from './outbox';
import { loadSession, saveSession } from './liveSession';

// Both optimistic scorer sends and root recovery share this per-session lock.
const inFlight = new Map();
const publications = new Set();
// Give a submitted publication time to settle after reload without unbounded retention.
export const PUBLICATION_RESOLUTION_WINDOW_MS = 2 * 60 * 1000;

// A live request owns resolution; after reload only the owned-session query can.
export function beginLivePublication(clientMatchId) {
  publications.add(clientMatchId);
  return (sharedSession = null) => {
    publications.delete(clientMatchId);
    resolvePendingLiveFinish(clientMatchId, sharedSession, { publicationComplete: true });
  };
}

export function resolvePendingLiveFinish(clientMatchId, sharedSession, { publicationComplete = false } = {}) {
  const latest = loadSession(clientMatchId);
  if (!latest?.pendingFinish || publications.has(clientMatchId)) return false;
  const { pendingFinish, ...session } = latest;
  const shared = sharedSession?.isShared === true;
  const promoted = shared && sharedSession.matchId && pendingFinish.snapshot && !session.broadcastError;
  if (promoted) {
    const seq = Math.max(session.seq ?? 0, sharedSession.lastSeq ?? 0) + 1;
    enqueue({ kind: 'point', team: 'A', value: 0, type: 'correction',
      at: pendingFinish.at, snapshot: pendingFinish.snapshot, clientMatchId, clientEventId: pendingFinish.clientEventId });
    saveSession(clientMatchId, { ...session, isShared: true, matchId: sharedSession.matchId,
      token: sharedSession.token ?? session.token, seq,
      finalizeIntent: { ...(pendingFinish.resultType ? { resultType: pendingFinish.resultType } : {}), shared: true } });
  } else {
    const deadline = pendingFinish.publicationDeadline ?? pendingFinish.at + PUBLICATION_RESOLUTION_WINDOW_MS;
    if (!publicationComplete && Date.now() < deadline) return false;
    saveSession(clientMatchId, { ...session, isShared: shared });
  }
  return Boolean(promoted);
}

function permanentSessionError(error) {
  return ['match_not_found', 'not_authorized', 'match_final'].includes(error?.data?.code)
    || /Live match not found|Not authorized|Match is final/i.test(error?.message || '');
}

export function flushLiveSession(clientMatchId, mutations) {
  if (!clientMatchId) return Promise.resolve(null);
  if (inFlight.has(clientMatchId)) return inFlight.get(clientMatchId);
  const task = Promise.resolve().then(async () => {
    let session = loadSession(clientMatchId);
    if (!session || session.broadcastError || (session.finalizeIntent && session.finalizeIntent.shared !== true)) return null;
    const current = () => {
      const latest = loadSession(clientMatchId);
      return Boolean(latest && latest.matchId === session.matchId);
    };
    const send = async (item) => {
      if (!current()) return;
      const common = { matchId: session.matchId, clientEventId: item.clientEventId, at: item.at, snapshot: item.snapshot };
      if (item.kind === 'undo') return mutations.undo(common);
      return mutations.scorePoint({ ...common, team: item.team, value: item.value, type: item.type, ...(item.kabaddi ? { kabaddi: item.kabaddi } : {}) });
    };
    const rejectSession = (error) => {
      if (current()) {
        removeSessionItems(clientMatchId);
        const updated = loadSession(clientMatchId);
        delete updated.finalizeIntent;
        delete updated.pendingFinish;
        updated.broadcastError = { code: error?.data?.code || 'session_rejected', message: 'Live sharing could not sync. Your local scores are saved.' };
        saveSession(clientMatchId, updated);
      }
    };
    if (session.pendingFinish && !publications.has(clientMatchId)) {
      if (!mutations.getOwnedSession) return null;
      try {
        const restored = await mutations.getOwnedSession(clientMatchId);
        const latest = loadSession(clientMatchId);
        if (publications.has(clientMatchId)) return null;
        if (latest?.pendingFinish) {
          if (latest.pendingFinish.clientEventId !== session.pendingFinish.clientEventId
            || !resolvePendingLiveFinish(clientMatchId, restored)) return null;
        } else if (latest?.finalizeIntent?.shared !== true) return null;
        session = loadSession(clientMatchId);
      } catch (error) {
        if (permanentSessionError(error)) rejectSession(error);
        return { error };
      }
    }
    if (!session.matchId && session.finalizeIntent && mutations.getOwnedSession) {
      try {
        const restored = await mutations.getOwnedSession(clientMatchId);
        const latest = loadSession(clientMatchId);
        if (!latest?.finalizeIntent || latest.broadcastError) return null;
        if (!latest.matchId && !restored) {
          const error = Object.assign(new Error('Live match not found'), { data: { code: 'match_not_found' } });
          rejectSession(error);
          return { error };
        }
        if (!latest.matchId && restored?.matchId) {
          saveSession(clientMatchId, { ...latest, matchId: restored.matchId, token: restored.token, isShared: restored.isShared === true, seq: Math.max(latest.seq ?? 0, restored.lastSeq ?? 0) });
        }
        session = loadSession(clientMatchId);
      } catch (error) {
        if (permanentSessionError(error)) rejectSession(error);
        return { error };
      }
    }
    if (!session?.matchId || (session.finalizeIntent && session.finalizeIntent.shared !== true)) return null;
    let result = await reconcile(send, { clientMatchId });
    // A terminal snapshot may be appended while an empty drain is resolving.
    while (!result.error && current() && size(clientMatchId) > 0) {
      const next = await reconcile(send, { clientMatchId });
      result = { ...next, sent: result.sent + next.sent };
    }
    if (result.error) {
      if (permanentSessionError(result.error)) rejectSession(result.error);
      return result;
    }
    const latest = current() && loadSession(clientMatchId);
    // Stop changes current visibility, not permission for an already-queued finish.
    const intent = latest?.finalizeIntent?.shared === true && latest.finalizeIntent;
    if (!intent) return result;
    try {
      const finalized = await mutations.finalize({ matchId: session.matchId, ...(intent.resultType ? { resultType: intent.resultType } : {}) });
      if (current()) {
        const updated = loadSession(clientMatchId);
        delete updated.finalizeIntent;
        saveSession(clientMatchId, updated);
      }
      return { ...result, finalized };
    } catch (error) {
      if (permanentSessionError(error)) rejectSession(error);
      return { ...result, error };
    }
  }).finally(() => { inFlight.delete(clientMatchId); });
  inFlight.set(clientMatchId, task);
  return task;
}
