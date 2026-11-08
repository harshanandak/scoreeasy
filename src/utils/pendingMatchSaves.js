import { loadQuickMatch, saveQuickMatch } from './storage';

const PREFIX = 'se_pending_match:';
export const PENDING_SAVES_CHANGED = 'se-pending-match-saves-changed';
const inFlight = new Map();
const confirmed = new Set();
// Keep an actionable record in this session if device storage is full or blocked.
const volatileRecords = new Map();
const keyFor = (ownerId, clientMatchId) => `${PREFIX}${encodeURIComponent(ownerId)}:${encodeURIComponent(clientMatchId)}`;
const notify = () => globalThis.dispatchEvent(new Event(PENDING_SAVES_CHANGED));

export function pendingMatchSaves(ownerId) {
  if (!ownerId) return [];
  const records = new Map();
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${PREFIX}${encodeURIComponent(ownerId)}:`)) continue;
      if (confirmed.has(key)) continue;
      try {
        const record = JSON.parse(localStorage.getItem(key));
        if (record?.ownerId === ownerId && record.payload?.clientMatchId) records.set(key, record);
      } catch { /* One unreadable record must not block other pending results. */ }
    }
  } catch {
    // Do not remove unreadable records; the local match remains authoritative.
  }
  for (const [key, record] of volatileRecords) {
    if (record.ownerId === ownerId) records.set(key, record);
  }
  return [...records.values()];
}

function write(record) {
  const key = keyFor(record.ownerId, record.payload.clientMatchId);
  try {
    record = { ...record, storageFailed: false };
    localStorage.setItem(key, JSON.stringify(record));
    volatileRecords.delete(key);
  } catch {
    record = { ...record, storageFailed: true };
    volatileRecords.set(key, record);
  }
  notify();
  return record;
}

export function enqueueMatchSave(ownerId, payload, quickMatchId) {
  confirmed.delete(keyFor(ownerId, payload.clientMatchId));
  const existing = pendingMatchSaves(ownerId).find((entry) => entry.payload.clientMatchId === payload.clientMatchId);
  if (existing) return existing;
  const record = write({ ownerId, payload, quickMatchId, state: 'pending', attempts: 0, nextAttemptAt: 0 });
  updateLocalMatch(record, 'pending');
  return record;
}

function updateLocalMatch(record, status) {
  const match = loadQuickMatch(record.quickMatchId);
  if (!match) return;
  saveQuickMatch({ ...match, clientMatchId: record.payload.clientMatchId, syncOwnerId: record.ownerId, sync: { status } });
}

export function isSaveInFlight(record) {
  return inFlight.has(keyFor(record.ownerId, record.payload.clientMatchId));
}

export function attemptMatchSave(record, save, canSend = () => true) {
  const key = keyFor(record.ownerId, record.payload.clientMatchId);
  if (inFlight.has(key)) return inFlight.get(key);
  if (!canSend() || navigator.onLine === false) return Promise.resolve({ status: 'pending', clientMatchId: record.payload.clientMatchId });
  // Install the guard before notifying subscribers, which can also drain the queue.
  const request = Promise.resolve().then(async () => {
    if (!canSend()) return { status: 'pending', clientMatchId: record.payload.clientMatchId };
    record = write({ ...record, state: 'syncing' });
    try {
      await save(record.payload);
      updateLocalMatch(record, 'synced');
      confirmed.add(key);
      // Only a server acknowledgement permits removal of a pending save.
      try { localStorage.removeItem(key); } catch { /* Retrying a retained record is idempotent. */ }
      volatileRecords.delete(key);
      return { status: 'synced', clientMatchId: record.payload.clientMatchId };
    } catch {
      const attempts = record.attempts + 1;
      write({ ...record, state: 'failed', attempts, nextAttemptAt: Date.now() + Math.min(300000, 5000 * 2 ** Math.min(attempts - 1, 6)) });
      updateLocalMatch(record, 'failed');
      return { status: 'failed', error: "Couldn't save", clientMatchId: record.payload.clientMatchId };
    }
  }).finally(() => { inFlight.delete(key); notify(); });
  inFlight.set(key, request);
  return request;
}
