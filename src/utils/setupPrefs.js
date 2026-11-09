// Remembered quick-setup choices, per sport, on this device only: the two team colours and the
// format the scorer last started with. Team names are never remembered (they belong to one match).
// Stored as one preference object through the app's storage helpers; anything malformed reads as
// "nothing remembered".
import { loadPreference, savePreference } from './storage';
import { normaliseHex } from '../lib/teamColour';

export const SETUP_PREFS_KEY = 'se_setup_prefs_v1';

function readAll() {
  const all = loadPreference(SETUP_PREFS_KEY, {});
  return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
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
  savePreference(SETUP_PREFS_KEY, { ...readAll(), [sport]: { colours, formatId } });
}

export function clearSetupPrefs(sport) {
  const all = readAll();
  if (!(sport in all)) return;
  delete all[sport];
  savePreference(SETUP_PREFS_KEY, all);
}
