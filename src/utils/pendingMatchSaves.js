import { loadQuickMatch, saveQuickMatch, loadSportTournaments, saveSportTournament } from './storage';
import { ConvexError } from 'convex/values';
import { getTournamentMatchClientId, getTournamentMatches, tournamentCompletionId } from './tournamentSync';
import { getSportsList } from '../models/sportRegistry';
import { isMatchOwner, fallbackCompletionMatches, loadMatchOwners, loadPendingSaveFallback, matchSaveFingerprint, storePendingSaveFallback } from './pendingMatchSaveStore';
import { guestClaimKey, readGuestClaim } from './guestMatchOwnership';
import { localOwnerEvidence, rememberMatchOwner, revokeGuestMatch } from './matchOwnershipEvidence';

export { tournamentCompletionId } from './tournamentSync';

const PREFIX = 'se_pending_match:';
export const PENDING_SAVES_CHANGED = 'se-pending-match-saves-changed';
export const RETRY_PENDING_SAVE = 'se-retry-pending-match-save';
const inFlight = new Map();
const confirmed = new Map();
// Also caches IndexedDB records so existing scorers can enqueue synchronously.
const volatileRecords = new Map();
const pendingWrites = new Map();
const revisions = new Map();
const dirtyRecords = new Set();
const keyFor = (ownerId, clientMatchId) => `${PREFIX}${encodeURIComponent(ownerId)}:${encodeURIComponent(clientMatchId)}`;
const notify = () => globalThis.dispatchEvent(new Event(PENDING_SAVES_CHANGED));
const cacheFallback = (record, previous) => record.payload ? record : { ...record, payload: previous?.payload || { clientMatchId: record.clientMatchId } };

export async function hydratePendingMatchSaves(ownerId) {
  if (!ownerId || !globalThis.indexedDB) return;
  const ownerPrefix = `${PREFIX}${encodeURIComponent(ownerId)}:`;
  await Promise.allSettled([...pendingWrites].filter(([key]) => key.startsWith(ownerPrefix)).map(([, pending]) => pending));
  const beforeRead = new Map(revisions);
  let changed = false;
  try {
    for (const stored of await loadPendingSaveFallback(ownerId)) {
      let record = cacheFallback(stored);
      if (record?.ownerId !== ownerId || !record.payload?.clientMatchId) continue;
      const key = keyFor(ownerId, record.payload.clientMatchId);
      if (beforeRead.get(key) !== revisions.get(key)) continue;
      const previous = volatileRecords.get(key);
      const matches = record.state === 'synced' && fallbackCompletionMatches(previous, stored);
      // Failed writes leave newer session state that a successful read cannot replace.
      if (dirtyRecords.has(key) && !matches) continue;
      if (matches) record = cacheFallback(stored, previous);
      dirtyRecords.delete(key);
      changed ||= JSON.stringify(volatileRecords.get(key)) !== JSON.stringify(record);
      volatileRecords.set(key, record);
      if (record.state === 'synced') confirmed.set(key, record.completionId);
    }
  } catch { /* Keep session records and their storage warning when fallback is unavailable. */ }
  if (changed) notify();
}

function persistFallback(key, record) {
  const revision = revisions.get(key);
  const pending = (pendingWrites.get(key) || Promise.resolve()).then(() =>
    storePendingSaveFallback(key, { ...record, storageFailed: false }));
  const settled = pending.then((stored) => {
    if (revisions.get(key) !== revision) return;
    if (!stored.conflictingOwners) {
      rememberMatchOwner(record.payload.clientMatchId, record.ownerId);
      updateLocalMatch(record, record.state);
    } else { try { localStorage.removeItem(key); } catch { /* The durable mismatch remains authoritative. */ } }
    if (volatileRecords.get(key) !== record && !stored.conflictingOwners) return;
    dirtyRecords.delete(key);
    volatileRecords.set(key, cacheFallback(stored, record));
    if (stored.state === 'synced') confirmed.set(key, stored.completionId);
    notify();
  }).catch(() => {
    if (volatileRecords.get(key) !== record) return;
    volatileRecords.set(key, { ...record, storageFailed: true });
    notify();
  })
    .finally(() => { if (pendingWrites.get(key) === settled) pendingWrites.delete(key); });
  pendingWrites.set(key, settled);
}

async function confirmFallback(record) {
  const key = keyFor(record.ownerId, record.payload.clientMatchId);
  confirmed.set(key, record.completionId);
  if (volatileRecords.has(key)) {
    write({ ...record, state: 'synced' });
    await pendingWrites.get(key);
    return volatileRecords.get(key)?.storageFailed === false;
  }
  if (!globalThis.indexedDB) return rememberMatchOwner(record.payload.clientMatchId, record.ownerId) || !loadMatchSaveLocal(record);
  try { await storePendingSaveFallback(key, { ...record, state: 'synced' }); return true; }
  catch { return false; }
}

export const isMatchSaveConfirmed = (ownerId, clientMatchId, completionId) => {
  const key = keyFor(ownerId, clientMatchId);
  return confirmed.has(key) && confirmed.get(key) === completionId;
};

export function loadMatchSaveLocal({ quickMatchId, tournamentMatch }) {
  if (!tournamentMatch) return loadQuickMatch(quickMatchId);
  const { storageKey, tournamentId, matchId } = tournamentMatch;
  const tournament = loadSportTournaments(storageKey).find((entry) => String(entry.id) === String(tournamentId));
  return [...(tournament?.matches || []), ...(tournament?.knockoutMatches || [])].find((entry) => String(entry.id) === String(matchId));
}

function localSaveConfirmed(record) {
  const match = loadMatchSaveLocal(record);
  return match?.clientMatchId === record.payload.clientMatchId && match?.syncOwnerId === record.ownerId && match?.sync?.status === 'synced'
    && (!record.completionId || (match.sync.completionId === record.completionId && tournamentCompletionId(match) === record.completionId));
}

const sameCompletion = (a, b) => a?.completionId === b?.completionId
  && (!a?.completionId || JSON.stringify(a.payload) === JSON.stringify(b?.payload));
const currentRecord = (record) => pendingMatchSaves(record.ownerId, true).find((entry) => entry.payload.clientMatchId === record.payload.clientMatchId);
const fixtureStillMatches = (record) => !record.completionId || tournamentCompletionId(loadMatchSaveLocal(record)) === record.completionId;

function isTransportFailure(error) {
  if (error instanceof ConvexError || error?.name === 'ConvexError' || /\[CONVEX |ArgumentValidationError|unauthenticat|unauthoriz|forbidden|permission denied/i.test(error?.message || '')) return false;
  return /NetworkError|TimeoutError/i.test(error?.name || '') || /failed to fetch|fetch failed|network|connection|socket|timed? ?out|transport|offline|load failed|ECONN|ENET|EAI_AGAIN/i.test(error?.message || '');
}

export function pendingMatchSaves(ownerId, includeSynced = false) {
  if (!ownerId) return [];
  const records = new Map();
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${PREFIX}${encodeURIComponent(ownerId)}:`)) continue;
      try {
        const record = JSON.parse(localStorage.getItem(key));
        if (record?.ownerId === ownerId && record.payload?.clientMatchId && (includeSynced || (!isMatchSaveConfirmed(ownerId, record.payload.clientMatchId, record.completionId) && !localSaveConfirmed(record)))) records.set(key, record);
      } catch { /* One unreadable record must not block other pending results. */ }
    }
  } catch {
    // Do not remove unreadable records; the local match remains authoritative.
  }
  for (const [key, record] of volatileRecords) {
    if (record.ownerId === ownerId && (includeSynced || (!isMatchSaveConfirmed(ownerId, record.payload.clientMatchId, record.completionId) && !localSaveConfirmed(record)))) records.set(key, record);
  }
  return [...records.values()];
}

function ownershipRecords() {
  const records = [...localOwnerEvidence(), ...volatileRecords.values()];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(PREFIX) || key?.startsWith('se_guest_match_claim:')) records.push(JSON.parse(localStorage.getItem(key)));
  }
  // Read raw stores: forgiving loaders could mistake an unreadable owner marker for guest data.
  for (const match of JSON.parse(localStorage.getItem('se_quickmatches') || '[]')) {
    records.push({ clientMatchId: match.clientMatchId || `quick:${match.sport}:${match.id}`, ownerId: match.syncOwnerId });
  }
  for (const sport of getSportsList()) {
    for (const tournament of JSON.parse(localStorage.getItem(sport.storageKey) || '[]')) {
      for (const match of getTournamentMatches(tournament)) {
        records.push({ clientMatchId: match.clientMatchId || getTournamentMatchClientId({ sportId: sport.id, tournament, match }), ownerId: match.syncOwnerId });
      }
    }
  }
  return records;
}

export async function matchOwners() {
  await Promise.allSettled([...pendingWrites.values()]);
  return loadMatchOwners(ownershipRecords());
}

export function localMatchOwners() {
  let records;
  try { records = ownershipRecords(); } catch { records = [...volatileRecords.values()]; }
  const owners = new Map();
  owners.partial = true;
  for (const record of records) {
    const id = record?.clientMatchId || record?.payload?.clientMatchId;
    if (!id || record.ownerId === undefined || (record.ownershipPending && !record.conflictingOwners)) continue;
    if (!owners.has(id)) owners.set(id, new Set());
    for (const owner of record.conflictingOwners || (record.ownerId ? [record.ownerId] : [])) owners.get(id).add(owner);
  }
  return owners;
}

export function recordGuestMatch(id) {
  if (!localMatchOwners().get(id)?.size) rememberMatchOwner(id, null);
  notify();
}

export function pruneSyncedMatchSaves(ownerId) {
  for (const record of pendingMatchSaves(ownerId, true)) {
    if (record.storageBackend === 'indexedDB' && record.state === 'synced') {
      if (!record.payloadFingerprint && !pendingWrites.has(keyFor(ownerId, record.payload.clientMatchId))) write(record);
      continue;
    }
    if (!localSaveConfirmed(record)) continue;
    const key = keyFor(ownerId, record.payload.clientMatchId);
    try { localStorage.removeItem(key); } catch { /* The synced marker still prevents sending; retry cleanup on the next drain. */ }
    if (record.storageBackend === 'indexedDB') {
      if (record.state !== 'synced') {
        confirmed.set(key, record.completionId);
        write({ ...record, state: 'synced' });
      }
    } else volatileRecords.delete(key);
  }
}

function write(record) {
  const key = keyFor(record.ownerId, record.payload.clientMatchId);
  revisions.set(key, (revisions.get(key) || 0) + 1);
  // Once a record uses the fallback, keep one durable source through acknowledgement.
  let useFallback = record.storageBackend === 'indexedDB' || volatileRecords.has(key);
  if (!useFallback) {
    try {
      record = { ...record, storageFailed: false };
      localStorage.setItem(key, JSON.stringify(record));
    } catch { useFallback = true; }
  }
  if (useFallback) {
    const previous = volatileRecords.get(key);
    record = { ...record, storageBackend: 'indexedDB', storageFailed: !(previous?.storageFailed === false && sameCompletion(previous, record)) };
    dirtyRecords.add(key);
    volatileRecords.set(key, record);
  }
  if (globalThis.indexedDB) persistFallback(key, record);
  notify();
  return record;
}

export function enqueueMatchSave(ownerId, payload, quickMatchId, tournamentMatch, quickCompletion) {
  const key = keyFor(ownerId, payload.clientMatchId);
  const local = loadMatchSaveLocal({ quickMatchId, tournamentMatch });
  if (!tournamentMatch && local?.syncOwnerId && local.syncOwnerId !== ownerId) return undefined;
  let claimed;
  try { claimed = localStorage.getItem(guestClaimKey(payload.clientMatchId)) !== null; } catch { /* Ordinary signed-in saves retain the existing IndexedDB fallback. Guest claiming requires a durable claim first. */ }
  if (claimed && readGuestClaim(payload.clientMatchId)?.ownerId !== ownerId) return undefined;
  if (!revokeGuestMatch(payload.clientMatchId)) return undefined;
  const completionId = tournamentMatch ? tournamentCompletionId(local) : undefined;
  const existing = pendingMatchSaves(ownerId).find((entry) => entry.payload.clientMatchId === payload.clientMatchId);
  if (existing && (!tournamentMatch || (existing.completionId === completionId && JSON.stringify(existing.payload) === JSON.stringify(payload)))) return existing;
  const priorCompletionSaved = Boolean(tournamentMatch && (
    (confirmed.has(key) && confirmed.get(key) !== completionId)
    || (local?.syncOwnerId === ownerId && local?.sync?.status === 'synced' && local?.sync?.completionId && local.sync.completionId !== completionId)
    || existing?.priorCompletionSaved
  ));
  confirmed.delete(key);
  const conflictingOwners = globalThis.indexedDB ? []
    : [...(localMatchOwners().get(payload.clientMatchId) || [])].filter(owner => owner !== ownerId);
  // A replacement waits behind any in-flight send; its old outcome cannot overwrite this record.
  const record = write({ ownerId, payload, quickMatchId, tournamentMatch, completionId,
    ...(globalThis.indexedDB ? { ownershipPending: true } : {}),
    ...(conflictingOwners.length ? { conflictingOwners, ownerMismatch: true } : {}),
    ...(claimed ? { guestClaimed: true } : {}),
    ...(quickCompletion ? { quickCompletionFingerprint: matchSaveFingerprint(JSON.parse(tournamentCompletionId(quickCompletion))) } : {}),
    state: priorCompletionSaved && !conflictingOwners.length ? 'failed' : 'pending', terminal: priorCompletionSaved && conflictingOwners.length === 0,
    priorCompletionSaved, attempts: 0, nextAttemptAt: 0 });
  if (!globalThis.indexedDB && !conflictingOwners.length) {
    rememberMatchOwner(payload.clientMatchId, ownerId);
    updateLocalMatch(record, record.state);
  }
  notify();
  return record;
}

function updateLocalMatch(record, status) {
  if (record.conflictingOwners) return;
  const match = loadMatchSaveLocal(record);
  if (!match || !fixtureStillMatches(record) || localSaveConfirmed(record)) return;
  const updated = { ...match, clientMatchId: record.payload.clientMatchId, syncOwnerId: record.ownerId,
    sync: { status, ...(record.completionId ? { completionId: record.completionId } : {}) } };
  if (!record.tournamentMatch) {
    saveQuickMatch(updated);
    return;
  }
  const { storageKey, tournamentId, matchId } = record.tournamentMatch;
  const tournament = loadSportTournaments(storageKey).find((entry) => String(entry.id) === String(tournamentId));
  if (!tournament) return;
  const replace = (matches) => matches?.map((entry) => String(entry.id) === String(matchId) ? updated : entry);
  saveSportTournament(storageKey, { ...tournament, matches: replace(tournament.matches), knockoutMatches: replace(tournament.knockoutMatches) });
}

export function isSaveInFlight(record) {
  return inFlight.has(keyFor(record.ownerId, record.payload.clientMatchId));
}

export function resumeOwnerMatchSaves(ownerId) {
  for (const record of pendingMatchSaves(ownerId)) {
    if (record.ownerMismatch) write({ ...record, ownerMismatch: false, nextAttemptAt: 0 });
  }
}

export function attemptMatchSave(record, save, canSend = () => true, manual = false, isOwnerActive = canSend) {
  const ownerActive = canSend;
  const guestClaimed = record.guestClaimed || Boolean(readGuestClaim(record.payload.clientMatchId));
  canSend = () => ownerActive() && (!guestClaimed || readGuestClaim(record.payload.clientMatchId)?.ownerId === record.ownerId);
  const key = keyFor(record.ownerId, record.payload.clientMatchId);
  if (isMatchSaveConfirmed(record.ownerId, record.payload.clientMatchId, record.completionId) || localSaveConfirmed(record)) return Promise.resolve({ status: 'synced', clientMatchId: record.payload.clientMatchId });
  if (inFlight.has(key)) return inFlight.get(key);
  if (record.priorCompletionSaved) return Promise.resolve({ status: 'failed', clientMatchId: record.payload.clientMatchId });
  const latest = currentRecord(record);
  if (latest && !sameCompletion(latest, record)) return Promise.resolve({ status: latest.state, clientMatchId: record.payload.clientMatchId });
  if (!fixtureStillMatches(record)) {
    write({ ...record, state: 'failed', terminal: true });
    return Promise.resolve({ status: 'failed', clientMatchId: record.payload.clientMatchId });
  }
  if (!canSend() || navigator.onLine === false) return Promise.resolve({ status: 'pending', clientMatchId: record.payload.clientMatchId });
  if (!manual && (record.terminal || record.ownerMismatch || record.nextAttemptAt > Date.now())) return Promise.resolve({ status: record.state, clientMatchId: record.payload.clientMatchId });
  let persistedBeforeSend = false;
  try { persistedBeforeSend = localStorage.getItem(key) !== null; } catch { /* Volatile records still send. */ }
  // Install the guard before notifying subscribers, which can also drain the queue.
  const request = Promise.resolve().then(async () => {
    if (!canSend()) return { status: 'pending', clientMatchId: record.payload.clientMatchId };
    if (pendingWrites.has(key)) await pendingWrites.get(key);
    if (currentRecord(record)?.conflictingOwners) return { status: 'pending', clientMatchId: record.payload.clientMatchId };
    if (isMatchSaveConfirmed(record.ownerId, record.payload.clientMatchId, record.completionId) || localSaveConfirmed(record)) return { status: 'synced', clientMatchId: record.payload.clientMatchId };
    if (!sameCompletion(currentRecord(record), record) || !fixtureStillMatches(record)) return { status: 'pending', clientMatchId: record.payload.clientMatchId };
    record = write({ ...record, state: 'syncing', terminal: false });
    if (pendingWrites.has(key)) await pendingWrites.get(key);
    if (isMatchSaveConfirmed(record.ownerId, record.payload.clientMatchId, record.completionId) || localSaveConfirmed(record)) return { status: 'synced', clientMatchId: record.payload.clientMatchId };
    if (!canSend() || !sameCompletion(currentRecord(record), record) || !fixtureStillMatches(record)) return { status: 'pending', clientMatchId: record.payload.clientMatchId };
    if (globalThis.indexedDB) {
      let allowed = null;
      try { allowed = await isMatchOwner(record.payload.clientMatchId, record.ownerId); } catch { /* Unknown ownership must not send. */ }
      if (!allowed) {
        write({ ...record, state: 'pending', ownerMismatch: allowed === false, terminal: false,
          nextAttemptAt: allowed === false ? 0 : Date.now() + 5000 });
        if (pendingWrites.has(key)) await pendingWrites.get(key);
        return { status: 'pending', clientMatchId: record.payload.clientMatchId };
      }
      if (!canSend()) return { status: 'pending', clientMatchId: record.payload.clientMatchId };
    }
    try {
      await save({ ...record.payload, expectedOwnerId: record.ownerId });
      if (record.storageBackend === 'indexedDB') await hydratePendingMatchSaves(record.ownerId);
      const latest = currentRecord(record);
      if (!latest && localSaveConfirmed(record)) {
        await confirmFallback(record);
        return { status: 'synced', clientMatchId: record.payload.clientMatchId };
      }
      if (!sameCompletion(latest, record) || !fixtureStillMatches(record)) {
        if (latest) {
          const blocked = write({ ...latest, state: 'failed', terminal: true, priorCompletionSaved: true });
          updateLocalMatch(blocked, 'failed');
          if (pendingWrites.has(key)) await pendingWrites.get(key);
        }
        return { status: 'failed', clientMatchId: record.payload.clientMatchId };
      }
      updateLocalMatch(record, 'synced');
      const durable = await confirmFallback(record);
      // Only a server acknowledgement permits removal of a pending save.
      if (durable || localSaveConfirmed(record)) {
        try { localStorage.removeItem(key); } catch { /* Retrying a retained record is idempotent. */ }
      }
      if (record.storageBackend !== 'indexedDB') volatileRecords.delete(key);
      return { status: 'synced', clientMatchId: record.payload.clientMatchId };
    } catch (error) {
      if (record.storageBackend === 'indexedDB') await hydratePendingMatchSaves(record.ownerId);
      const latest = currentRecord(record);
      if (latest && !sameCompletion(latest, record)) return { status: latest.state, clientMatchId: record.payload.clientMatchId };
      let acknowledged = isMatchSaveConfirmed(record.ownerId, record.payload.clientMatchId, record.completionId) || localSaveConfirmed(record);
      try { acknowledged ||= persistedBeforeSend && localStorage.getItem(key) === null; } catch { /* A failed read is not acknowledgement. */ }
      if (acknowledged) {
        const durable = await confirmFallback(record);
        if (record.storageBackend !== 'indexedDB') volatileRecords.delete(key);
        if (durable || localSaveConfirmed(record)) {
          try { localStorage.removeItem(key); } catch { /* The confirmation suppresses this stale record. */ }
        }
        return { status: 'synced', clientMatchId: record.payload.clientMatchId };
      }
      const attempts = record.attempts + 1;
      const nextAttemptAt = Date.now() + Math.min(300000, 5000 * 2 ** Math.min(attempts - 1, 6));
      if (error?.data?.code === 'owner_mismatch') {
        const ownerActive = isOwnerActive();
        write({ ...record, state: 'pending', terminal: false, ownerMismatch: !ownerActive,
          attempts, nextAttemptAt: ownerActive ? nextAttemptAt : 0 });
        updateLocalMatch(record, 'pending');
        if (pendingWrites.has(key)) await pendingWrites.get(key);
        return { status: 'pending', clientMatchId: record.payload.clientMatchId };
      }
      write({ ...record, state: 'failed', terminal: !isTransportFailure(error), attempts, nextAttemptAt });
      updateLocalMatch(record, 'failed');
      if (pendingWrites.has(key)) await pendingWrites.get(key);
      return { status: 'failed', error: "Couldn't save", clientMatchId: record.payload.clientMatchId };
    }
  }).finally(() => { inFlight.delete(key); notify(); });
  inFlight.set(key, request);
  return request;
}
