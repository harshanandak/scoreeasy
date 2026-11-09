import { useEffect, useRef, useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from './useAuth';
import { addAppStateChangeListener } from '../mobile/lifecycle';
import { LIVE_SESSIONS_CHANGED, liveSessions } from '../lib/live/liveSession';
import { flushLiveSession } from '../lib/live/recovery';
import { size } from '../lib/live/outbox';
import { matchSaveOwner } from './usePendingMatchSaves';

export function usePendingLiveFinalizations() {
  const auth = useAuth();
  const { isAuthenticated, user } = auth;
  const ownerId = matchSaveOwner(auth);
  const ready = Boolean(isAuthenticated && user);
  const convex = useConvex();
  const scorePoint = useMutation(api.live.scorePoint);
  const undo = useMutation(api.live.undo);
  const finalize = useMutation(api.live.finalize);
  const setVisibility = useMutation(api.live.setVisibility);
  const mutations = useRef(null);
  mutations.current = { ownerId, scorePoint, undo, finalize, setVisibility, getOwnedSession: (clientMatchId, expectedOwnerId) => convex.query(api.live.getOwnedSession, { clientMatchId, ...(expectedOwnerId ? { expectedOwnerId } : {}) }), getOwnerId: () => mutations.current.ownerId };
  const [, refresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    const run = () => {
      if (disposed) return;
      refresh(value => value + 1);
      if (!ready || navigator.onLine === false) return;
      for (const session of liveSessions()) {
        if (session.ownerId && session.ownerId !== ownerId) continue;
        if (!session.broadcastError && (session.visibilityIntent || session.pendingFinish || session.finalizeIntent || size(session.clientMatchId) > 0)) {
          void flushLiveSession(session.clientMatchId, mutations.current).then(() => {
            if (!disposed) refresh(value => value + 1);
          });
        }
      }
    };
    const foreground = () => { if (document.visibilityState === 'visible') run(); };
    const events = ['online', 'focus', 'storage', LIVE_SESSIONS_CHANGED];
    events.forEach(event => globalThis.addEventListener(event, run));
    document.addEventListener('visibilitychange', foreground);
    let removeNative;
    void addAppStateChangeListener(({ isActive }) => { if (isActive) run(); }).then(remove => {
      if (disposed) remove();
      else removeNative = remove;
    }).catch(() => { /* Browser lifecycle listeners remain available. */ });
    run();
    return () => {
      disposed = true;
      removeNative?.();
      events.forEach(event => globalThis.removeEventListener(event, run));
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [ready, ownerId]);
  return ready ? liveSessions().filter(session => (!session.ownerId || session.ownerId === ownerId) && session.broadcastError) : [];
}
