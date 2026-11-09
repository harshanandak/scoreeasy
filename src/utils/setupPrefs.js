import { matchStorageKey } from './accountStorage';
// Per-sport team colours and last customised rules, scoped to the current guest or signed-in
// account with matchStorageKey. Names and toss results are never preferences. Colours auto-fill;
// saved custom rules are opt-in, and blocked or malformed storage never prevents match setup.
import { resolveKabaddiRules } from './kabaddiRules';
import { normaliseHex } from '../lib/teamColour';

export const SETUP_PREFS_KEY = 'se_setup_prefs_v1';

function readAll() {
  try {
    const raw = globalThis.localStorage?.getItem(matchStorageKey(SETUP_PREFS_KEY));
    const all = raw ? JSON.parse(raw) : {};
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    globalThis.localStorage?.setItem(matchStorageKey(SETUP_PREFS_KEY), JSON.stringify(all));
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
    if (!entry?.format || typeof entry.format !== 'object' || Array.isArray(entry.format)) return null;
    const format = withoutSetupToss(entry.format);
    if (sport === 'kabaddi') {
      if (!format.kabaddiRules) return null;
      format.kabaddiRules = resolveKabaddiRules('custom', format.kabaddiRules);
    }
    return { ...entry, format, source: entry.source ? { ...entry.source, format: withoutSetupToss(entry.source.format) } : null };
  } catch { return null; }
}

export function saveCustomSetup(sport, { format, source = null } = {}) {
  if (!sport || !format) return;
  try {
    const key = matchStorageKey(CUSTOM_SETUP_PREFS_KEY);
    let all;
    try { all = JSON.parse(globalThis.localStorage?.getItem(key) || '{}'); } catch { all = {}; }
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    globalThis.localStorage?.setItem(key, JSON.stringify({ ...all, [sport]: { format: withoutSetupToss(format), source: source ? { ...source, format: withoutSetupToss(source.format) } : null } }));
  } catch { /* Remembering rules must never block starting a match. */ }
}

/** Toss choices belong to this match; frozen set rules are rebuilt from the editable values. */
export function withoutSetupToss(format = {}) {
  const { openingRaidTeam: _raid, initialServer: _server, battingTeam: _bat, openingBattingTeam: _openingBat, setsRules: _frozen, ...rules } = format;
  return rules;
}
