import { useEffect, useRef, useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from './useAuth';
import { addAppStateChangeListener } from '../mobile/lifecycle';
import { attemptMatchSave, isSaveInFlight, pendingMatchSaves, pruneSyncedMatchSaves, PENDING_SAVES_CHANGED, RETRY_PENDING_SAVE } from '../utils/pendingMatchSaves';

export function matchSaveOwner({ isAuthenticated, clerkUser, user }) {
  return isAuthenticated ? (clerkUser?.id || user?._id || null) : null;
}

export function usePendingMatchSaveStatus() {
  const auth = useAuth();
  const client = useConvex();
  const ownerId = client ? matchSaveOwner(auth) : null;
  const [, refresh] = useState(0);
  useEffect(() => {
    const changed = () => refresh((value) => value + 1);
    const events = [PENDING_SAVES_CHANGED, 'storage', 'online', 'offline'];
    events.forEach((event) => globalThis.addEventListener(event, changed));
    return () => events.forEach((event) => globalThis.removeEventListener(event, changed));
  }, []);
  return {
    ownerId,
    records: pendingMatchSaves(ownerId),
    retry: (clientMatchId) => globalThis.dispatchEvent(new CustomEvent(RETRY_PENDING_SAVE, { detail: { ownerId, clientMatchId } })),
  };
}

export function usePendingMatchSaves(authOverride) {
  const auth = useAuth();
  const currentAuth = authOverride || auth;
  const ownerId = matchSaveOwner(currentAuth);
  const ready = Boolean(ownerId && currentAuth.user);
  const save = useMutation(api.matches.save);
  const active = useRef(null);
  active.current = { ownerId, ready, save };
  const [, refresh] = useState(0);
  const send = (clientMatchId, manual = false) => {
    const record = pendingMatchSaves(ownerId).find((entry) => entry.payload.clientMatchId === clientMatchId);
    if (!record) return Promise.resolve({ status: 'idle', clientMatchId });
    return attemptMatchSave(record, save, () => active.current.ownerId === ownerId && active.current.ready, manual);
  };
  useEffect(() => {
    let timer;
    let disposed = false;
    const run = () => {
      if (disposed) return;
      clearTimeout(timer);
      pruneSyncedMatchSaves(ownerId);
      refresh((value) => value + 1);
      if (!ready || navigator.onLine === false) return;
      const records = pendingMatchSaves(ownerId).filter((entry) => !entry.terminal && !isSaveInFlight(entry));
      for (const record of records) {
        if (record.nextAttemptAt <= Date.now()) {
          void attemptMatchSave(record, active.current.save, () => !disposed && active.current.ownerId === ownerId && active.current.ready);
        }
      }
      const upcoming = pendingMatchSaves(ownerId).filter((entry) => !entry.terminal && !isSaveInFlight(entry));
      if (upcoming.length) timer = setTimeout(() => run(), Math.max(1000, Math.min(...upcoming.map((entry) => entry.nextAttemptAt)) - Date.now()));
    };
    const changed = () => run();
    const manualRetry = ({ detail }) => {
      if (detail?.ownerId === ownerId) void send(detail.clientMatchId, true);
    };
    const reconnect = () => run();
    const foreground = () => { if (document.visibilityState === 'visible') run(); };
    globalThis.addEventListener(PENDING_SAVES_CHANGED, changed);
    globalThis.addEventListener(RETRY_PENDING_SAVE, manualRetry);
    globalThis.addEventListener('storage', changed);
    globalThis.addEventListener('online', reconnect);
    globalThis.addEventListener('offline', changed);
    globalThis.addEventListener('focus', reconnect);
    document.addEventListener('visibilitychange', foreground);
    let removeNative;
    void addAppStateChangeListener(({ isActive }) => { if (isActive) reconnect(); }).then((remove) => {
      if (disposed) remove();
      else removeNative = remove;
    }).catch(() => { /* Browser foreground listeners remain available. */ });
    run();
    return () => {
      disposed = true;
      clearTimeout(timer);
      removeNative?.();
      globalThis.removeEventListener(PENDING_SAVES_CHANGED, changed);
      globalThis.removeEventListener(RETRY_PENDING_SAVE, manualRetry);
      globalThis.removeEventListener('storage', changed);
      globalThis.removeEventListener('online', reconnect);
      globalThis.removeEventListener('offline', changed);
      globalThis.removeEventListener('focus', reconnect);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [ownerId, ready]);
  return { ownerId, records: pendingMatchSaves(ownerId), retry: (id) => send(id, true), send, save, ready };
}
