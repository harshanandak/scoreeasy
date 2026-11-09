import { getSportsList } from '../models/sportRegistry';
import { markSaveFailed, markSaveOk } from './saveHealth';

const ROOT = 'se_local:';
const BACKUP = 'se_local_migration:';
export const MATCH_STORAGE_CHANGED = 'se-match-storage-changed';
const matchKeys = new Set(['se_custom_setup_v1', 'se_quickmatches', 'se_tournaments', 'se_statistics', 'gs_history', 'gs_sessions', 'gs_templates',
  'se_matches_pending_undo', 'se_stats_pending_undo', ...getSportsList().map(sport => sport.storageKey)]);
let activeOwner = null;
let legacyOwner = null;
let durableOwnership = null;
let ownershipRead = null;
let pendingOwnershipReader = null;
export function registerPendingOwnershipReader(read) {
  pendingOwnershipReader = read;
}
export async function resolveMatchStorageOwnership() {
  if (!pendingOwnershipReader) {
    durableOwnership = null;
    throw new Error('Pending save ownership reader is not ready');
  }
  if (!ownershipRead) {
    durableOwnership = null;
    ownershipRead = Promise.resolve().then(pendingOwnershipReader)
      .then(owners => { durableOwnership = owners; return owners; })
      .finally(() => { ownershipRead = null; });
  }
  return ownershipRead;
}
const keys = storage => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(Boolean);
const prefix = owner => owner ? `${ROOT}account:${encodeURIComponent(owner)}:` : `${ROOT}guest:`;
const logicalKey = key => key.replace(/^gamescore_/, 'se_');
const undoJournal = key => key === 'se_matches_pending_undo' || key === 'se_stats_pending_undo';
function undoJournalOwner(value) {
  const operations = Array.isArray(value) ? value : [value];
  if (operations.some(operation => !Array.isArray(operation?.items) || !operation.items.length)) return null;
  const owners = operations.flatMap(operation => operation.items.map(item => (item?.match?.record || item?.match)?.syncOwnerId));
  return owners[0] && owners.every(owner => owner === owners[0]) ? owners[0] : null;
}
const scoped = key => matchKeys.has(key) || /^se_(quickmatch_draft_|tennis_quick_draft_|kabaddi_backup_)/.test(key);
export const getMatchStorageScope = () => activeOwner;
export const matchStorageKey = (key, owner = activeOwner) => scoped(key) ? `${prefix(owner)}${key}` : key;
export function withMatchStorageScope(owner, run) {
  const previous = activeOwner;
  const previousLegacy = legacyOwner;
  if (owner !== activeOwner) legacyOwner = null;
  activeOwner = owner || null;
  try { return run(); } finally { activeOwner = previous; legacyOwner = previousLegacy; }
}
export function setMatchStorageScope(owner, convexId) {
  activeOwner = owner || null;
  legacyOwner = owner && convexId && owner !== convexId ? convexId : null;
  if (migrateMatchStorage()) globalThis.dispatchEvent(new Event(MATCH_STORAGE_CHANGED));
}

function writeVerified(storage, key, value) {
  const raw = JSON.stringify(value);
  if (storage.getItem(key) !== raw) storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error('Local match copy could not be verified');
  markSaveOk(key);
}
const rowId = row => String(row?.id ?? row?.quickMatchId ?? JSON.stringify(row));
function merge(original, existing) {
  if (!Array.isArray(original) || !Array.isArray(existing)) return existing ?? original;
  const rows = new Map(original.map(row => [rowId(row), row]));
  for (const row of existing) {
    const old = rows.get(rowId(row));
    rows.set(rowId(row), old && row && (row.matches || row.knockoutMatches) ? { ...old, ...row,
      matches: merge(old.matches, row.matches), knockoutMatches: merge(old.knockoutMatches, row.knockoutMatches),
    } : row);
  }
  return [...rows.values()];
}
function ownerOf(row, key, tournamentId, ownership) {
  if (row?.syncOwnerId) return row.syncOwnerId;
  if (row?.record || row?.match) return ownerOf(row.record || row.match, key, tournamentId, ownership);
  if (!ownership) throw new Error('Legacy ownership is unresolved');
  const sport = getSportsList().find(sport => sport.storageKey === key)?.id;
  const id = row?.clientMatchId || (key === 'se_quickmatches' ? `quick:${row?.sport}:${row?.id}`
    : tournamentId != null ? `tournament:${sport}:${tournamentId}:${row?.id}` : null);
  const owners = ownership.get(id);
  if (owners?.size > 1) throw new Error('Legacy ownership is ambiguous');
  return owners?.values().next().value || null;
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, data]) => [key,
    key === 'syncOwnerId' && data === legacyOwner ? activeOwner : canonicalize(data)]));
}
function split(value, key, ownership) {
  if (undoJournal(key)) {
    const owner = undoJournalOwner(value);
    if (!owner) throw new Error('Undo journal ownership is not explicit');
    return new Map([[owner, value]]);
  }
  const groups = new Map();
  const add = (owner, row) => groups.set(owner, [...(groups.get(owner) || []), row]);
  for (const row of Array.isArray(value) ? value : [value]) {
    const owner = item => ownerOf(item, key, row?.id, ownership);
    const fixtures = [...(row?.matches || []), ...(row?.knockoutMatches || [])];
    if (Array.isArray(row?.items)) {
      for (const account of new Set(row.items.map(item => owner(item.match)))) {
        const items = row.items.filter(item => owner(item.match) === account);
        add(account, { ...row, items, order: row.order?.filter(id => items.some(item => String(item.match?.id) === String(id))) });
      }
    } else if (!row?.syncOwnerId && fixtures.length) {
      for (const account of new Set(fixtures.map(owner))) add(account, { ...row,
        matches: row.matches?.filter(match => owner(match) === account),
        knockoutMatches: row.knockoutMatches?.filter(match => owner(match) === account),
      });
    } else add(owner(row), row);
  }
  return new Map([...groups].map(([owner, rows]) => [owner, Array.isArray(value) ? rows : rows[0]]));
}

/** Recovery copies are deliberately outside both guest and account enumeration. */
export function migrateMatchStorage(storage = globalThis.localStorage) {
  let changed = false;
  try {
    const sources = keys(storage);
    let ownership = durableOwnership;
    if (!globalThis.indexedDB) {
      ownership = new Map();
      for (const key of keys(storage).filter(key => key.startsWith('se_pending_match:'))) {
        const record = JSON.parse(storage.getItem(key));
        const id = record?.clientMatchId || record?.payload?.clientMatchId;
        if (!id || !record.ownerId) continue;
        if (!ownership.has(id)) ownership.set(id, new Set());
        ownership.get(id).add(record.ownerId);
      }
    } else if (!ownership && sources.some(source => scoped(logicalKey(source)))) {
      resolveMatchStorageOwnership().then(() => {
        if (migrateMatchStorage(storage)) globalThis.dispatchEvent(new Event(MATCH_STORAGE_CHANGED));
      }).catch(() => { /* Keep shared rows quarantined until ownership can be read. */ });
    }
    // Coalesce both prefixes before touching destinations; existing destinations still win retries.
    for (const source of sources) {
      const key = logicalKey(source);
      const aliasPrefix = legacyOwner && prefix(legacyOwner);
      const alias = aliasPrefix && source.startsWith(aliasPrefix);
      if (!alias && !scoped(key)) continue;
      const logical = alias ? source.slice(aliasPrefix.length) : key;
      const raw = storage.getItem(source);
      let value;
      try { value = JSON.parse(raw); } catch { continue; }
      const counterpart = !alias && source.startsWith('gamescore_') ? key : null;
      const preferred = counterpart && storage.getItem(counterpart);
      if (preferred != null) {
        try { value = merge(value, JSON.parse(preferred)); } catch { continue; }
      }
      if (undoJournal(logical) && !undoJournalOwner(value)) continue;
      const backup = `${BACKUP}${encodeURIComponent(source)}`;
      try {
        if (storage.getItem(backup) === null) storage.setItem(backup, raw);
        if (storage.getItem(backup) !== raw) throw new Error('Migration source changed; retain both versions');
        for (let [owner, data] of alias ? [[activeOwner, value]] : split(value, logical, ownership)) {
          if (alias) data = canonicalize(data);
          if (owner === legacyOwner && legacyOwner) { owner = activeOwner; data = canonicalize(data); }
          if (undoJournal(logical) && (!owner || undoJournalOwner(data) !== owner)) throw new Error('Undo journal owner does not match destination');
          const target = matchStorageKey(logical, owner);
          writeVerified(storage, target, merge(data, JSON.parse(storage.getItem(target))));
        }
        if (storage.getItem(source) === raw) storage.removeItem(source);
        changed = true;
        markSaveOk(source);
      } catch { markSaveFailed(source); }
    }
  } catch { /* Unreadable storage never authorizes a shared-store fallback. */ }
  return changed;
}

export function scopedMatchStorage(storage) {
  migrateMatchStorage(storage);
  const visible = () => keys(storage).flatMap(key => key.startsWith(prefix(activeOwner)) ? [key.slice(prefix(activeOwner).length)]
    : !key.startsWith(ROOT) && !key.startsWith(BACKUP) && !scoped(logicalKey(key)) ? [key] : []);
  return {
    getItem: key => storage.getItem(matchStorageKey(key)),
    setItem: (key, value) => storage.setItem(matchStorageKey(key), value),
    removeItem: key => storage.removeItem(matchStorageKey(key)),
    get length() { return visible().length; },
    key: index => visible()[index] ?? null,
  };
}

/** Reserve each guest document before copying; only verified destinations permit source removal. */
export async function claimGuestStorage(owner, reserve, storage = globalThis.localStorage) {
  const ownership = await resolveMatchStorageOwnership();
  migrateMatchStorage(storage);
  let changed = false;
  // Quarantine transient guest undo before moving matches that it could otherwise restore as guest.
  for (const source of keys(storage).filter(key => key.startsWith(prefix(null)) && undoJournal(key.slice(prefix(null).length)))) {
    try {
      const journal = JSON.parse(storage.getItem(source));
      for (const operation of Array.isArray(journal) ? journal : [journal]) {
        writeVerified(storage, `${BACKUP}${encodeURIComponent(source)}:${encodeURIComponent(rowId(operation))}`, operation);
      }
      storage.removeItem(source);
      if (storage.getItem(source) !== null) throw new Error('Guest undo journal could not be quarantined');
      changed = true;
    } catch (error) { markSaveFailed(source); throw error; }
  }
  for (const source of keys(storage).filter(key => key.startsWith(prefix(null)))) {
    const key = source.slice(prefix(null).length);
    const initial = JSON.parse(storage.getItem(source));
    for (const row of Array.isArray(initial) ? initial : [initial]) {
      if ([...split(row, key, ownership).keys()].some(account => account && account !== owner)) continue;
      const id = key === 'se_quickmatches' ? row.clientMatchId || `quick:${row.sport}:${row.id}`
        : `local:${key}:${rowId(row)}`;
      if (!await reserve({ ownerId: owner, clientMatchId: id, ...(key === 'se_quickmatches' ? { quickMatchId: row.id, noticePending: row.status === 'completed' } : {}) })) continue;
      const target = matchStorageKey(key, owner);
      try {
        const current = JSON.parse(storage.getItem(source));
        const found = Array.isArray(current) ? current.find(entry => rowId(entry) === rowId(row)) : current;
        if (JSON.stringify(found) !== JSON.stringify(row)) continue;
        writeVerified(storage, `${BACKUP}${encodeURIComponent(source)}:${encodeURIComponent(rowId(row))}`, row);
        writeVerified(storage, target, merge(Array.isArray(initial) ? [row] : row, JSON.parse(storage.getItem(target))));
        if (Array.isArray(current) && current.length > 1) writeVerified(storage, source, current.filter(entry => rowId(entry) !== rowId(row)));
        else storage.removeItem(source);
        changed = true;
        markSaveOk(source);
      } catch { markSaveFailed(target); }
    }
  }
  if (changed) globalThis.dispatchEvent(new Event(MATCH_STORAGE_CHANGED));
}
