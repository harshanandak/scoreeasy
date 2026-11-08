import { reconcile, removeSessionItems, size } from './outbox';
import { loadSession, saveSession } from './liveSession';

// Both optimistic scorer sends and root recovery share this per-session lock.
const inFlight = new Map();

function permanentSessionError(error) {
  return ['match_not_found', 'not_authorized', 'match_final'].includes(error?.data?.code)
    || /Live match not found|Not authorized|Match is final/i.test(error?.message || '');
}

export function flushLiveSession(clientMatchId, mutations) {
  if (!clientMatchId) return Promise.resolve(null);
  if (inFlight.has(clientMatchId)) return inFlight.get(clientMatchId);
  const task = Promise.resolve().then(async () => {
    const session = loadSession(clientMatchId);
    if (!session?.matchId || session.broadcastError) return null;
    const current = () => loadSession(clientMatchId)?.matchId === session.matchId;
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
        updated.broadcastError = { code: error?.data?.code || 'session_rejected', message: 'Live sharing could not sync. Your local scores are saved.' };
        saveSession(clientMatchId, updated);
      }
    };
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
    const intent = current() && loadSession(clientMatchId)?.finalizeIntent;
    if (!intent) return result;
    try {
      const finalized = await mutations.finalize({ matchId: session.matchId, ...intent });
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
