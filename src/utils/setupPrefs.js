import { matchStorageKey } from './accountStorage';
// Remembered quick-setup choices, per sport, on this device only: the two team colours and the
// format the scorer last started with. Team names are never remembered (they belong to one match).
// Stored as one JSON object in localStorage; anything malformed (or storage that is unavailable)
// reads as "nothing remembered". This is a device convenience, not match data, so it is not
// account-scoped and deliberately does not go through the match storage module: setup screens must
// never depend on, or be broken by, that module's backend.
import { normaliseHex } from '../lib/teamColour';

export const SETUP_PREFS_KEY = 'se_setup_prefs_v1';

function readAll() {
  try {
    const raw = globalThis.localStorage?.getItem(SETUP_PREFS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    globalThis.localStorage?.setItem(SETUP_PREFS_KEY, JSON.stringify(all));
  } catch {
    // Remembering is optional; a full or blocked store must never block starting a match.
  }
}

/** @returns {{ colours: [string, string] | null, formatId: string | null } | null} */
export function loadSetupPrefs(sport) {
  const entry = readAll()[sport];
  if (!entry || typeof entry !== 'object') return null;
  const a = normaliseHex(entry.colours?.[0]);
  const b = normaliseHex(entry.colours?.[1]);
  const colours = a && b && a !== b ? [a, b] : null;
  const formatId = typeof entry.formatId === 'string' && entry.formatId ? entry.formatId : null;
  return colours || formatId ? { colours, formatId } : null;
}

export function saveSetupPrefs(sport, { colours = null, formatId = null } = {}) {
  if (!sport || (!colours && !formatId)) return;
  writeAll({ ...readAll(), [sport]: { colours, formatId } });
}

export function clearSetupPrefs(sport) {
  const all = readAll();
  if (!(sport in all)) return;
  delete all[sport];
  writeAll(all);
}

// Custom rules belong to the same guest/account scope as local matches. They never auto-apply.
export const CUSTOM_SETUP_PREFS_KEY = 'se_custom_setup_v1';
export function loadCustomSetup(sport) {
  try {
    const entry = JSON.parse(globalThis.localStorage?.getItem(matchStorageKey(CUSTOM_SETUP_PREFS_KEY)) || '{}')[sport];
    return entry?.format && typeof entry.format === 'object' && !Array.isArray(entry.format) ? entry : null;
  } catch { return null; }
}

export function saveCustomSetup(sport, { format, source = null } = {}) {
  if (!sport || !format) return;
  try {
    const key = matchStorageKey(CUSTOM_SETUP_PREFS_KEY);
    let all;
    try { all = JSON.parse(globalThis.localStorage?.getItem(key) || '{}'); } catch { all = {}; }
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    globalThis.localStorage?.setItem(key, JSON.stringify({ ...all, [sport]: { format, source } }));
  } catch { /* Remembering rules must never block starting a match. */ }
}
