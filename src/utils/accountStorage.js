import { getSportsList } from '../models/sportRegistry';
import { markSaveFailed, markSaveOk } from './saveHealth';

const ROOT = 'se_local:';
const BACKUP = 'se_local_migration:';
export const MATCH_STORAGE_CHANGED = 'se-match-storage-changed';
const matchKeys = new Set(['se_quickmatches', 'se_tournaments', 'se_statistics', 'gs_history', 'gs_sessions', 'gs_templates',
  'se_matches_pending_undo', 'se_stats_pending_undo', ...getSportsList().map(sport => sport.storageKey)]);
let activeOwner = null;
let legacyOwner = null;
const keys = storage => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(Boolean);
const prefix = owner => owner ? `${ROOT}account:${encodeURIComponent(owner)}:` : `${ROOT}guest:`;
const logicalKey = key => key.replace(/^gamescore_/, 'se_');
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
const ownerOf = row => row?.syncOwnerId || row?.record?.syncOwnerId || row?.match?.syncOwnerId || null;
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, data]) => [key,
    key === 'syncOwnerId' && data === legacyOwner ? activeOwner : canonicalize(data)]));
}
function split(value) {
  const groups = new Map();
  const add = (owner, row) => groups.set(owner, [...(groups.get(owner) || []), row]);
  for (const row of Array.isArray(value) ? value : [value]) {
    const fixtures = [...(row?.matches || []), ...(row?.knockoutMatches || [])];
    if (!ownerOf(row) && fixtures.length) {
      for (const owner of new Set(fixtures.map(ownerOf))) add(owner, { ...row,
        matches: row.matches?.filter(match => ownerOf(match) === owner),
        knockoutMatches: row.knockoutMatches?.filter(match => ownerOf(match) === owner),
      });
    } else add(ownerOf(row), row);
  }
  return new Map([...groups].map(([owner, rows]) => [owner, Array.isArray(value) ? rows : rows[0]]));
}

/** Recovery copies are deliberately outside both guest and account enumeration. */
export function migrateMatchStorage(storage = globalThis.localStorage) {
  let changed = false;
  try {
    for (const source of keys(storage)) {
      const key = logicalKey(source);
      const aliasPrefix = legacyOwner && prefix(legacyOwner);
      const alias = aliasPrefix && source.startsWith(aliasPrefix);
      if (!alias && !scoped(key)) continue;
      const logical = alias ? source.slice(aliasPrefix.length) : key;
      const raw = storage.getItem(source);
      let value;
      try { value = JSON.parse(raw); } catch { continue; }
      const backup = `${BACKUP}${encodeURIComponent(source)}`;
      try {
        if (storage.getItem(backup) === null) storage.setItem(backup, raw);
        if (storage.getItem(backup) !== raw) throw new Error('Migration source changed; retain both versions');
        for (let [owner, data] of alias ? [[activeOwner, value]] : split(value)) {
          if (alias) data = canonicalize(data);
          if (owner === legacyOwner && legacyOwner) { owner = activeOwner; data = canonicalize(data); }
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
  migrateMatchStorage(storage);
  let changed = false;
  for (const source of keys(storage).filter(key => key.startsWith(prefix(null)))) {
    const key = source.slice(prefix(null).length);
    const initial = JSON.parse(storage.getItem(source));
    for (const row of Array.isArray(initial) ? initial : [initial]) {
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
