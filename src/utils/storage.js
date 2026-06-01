// LocalStorage utility for persistent data
import { migrateTournaments } from './formatMigration';

// One-time migration from old 'gamescore_' prefix to 'se_'
function migrateStoragePrefix() {
  try {
    if (globalThis.localStorage === undefined) return;
    if (globalThis.localStorage.getItem('se_migrated')) return;
    const keysToMigrate = [];
    for (let i = 0; i < globalThis.localStorage.length; i++) {
      const key = globalThis.localStorage.key(i);
      if (key && key.startsWith('gamescore_')) {
        keysToMigrate.push(key);
      }
    }
    for (const key of keysToMigrate) {
      const newKey = key.replace('gamescore_', 'se_');
      if (!globalThis.localStorage.getItem(newKey)) {
        globalThis.localStorage.setItem(newKey, globalThis.localStorage.getItem(key));
      }
    }
    globalThis.localStorage.setItem('se_migrated', '1');
  } catch {
    // Silently fail in environments without globalThis.localStorage
  }
}
migrateStoragePrefix();

const STORAGE_KEYS = {
  TOURNAMENTS: 'se_tournaments',
  STATISTICS: 'se_statistics',
  QUICK_MATCHES: 'se_quickmatches',
};

const QUICK_MATCH_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MATCH_DURATION_SECONDS = 24 * 60 * 60;

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeWinnerToken(winner) {
  if (typeof winner !== 'string') return winner || null;
  const lower = winner.trim().toLowerCase();
  if (!lower) return null;
  if (lower === 'draw') return 'Draw';
  if (lower === 'tie' || lower === 'tied') return 'Tie';
  return winner;
}

function hasNonZeroNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0;
}

function hasMeaningfulQuickScore(match) {
  if (hasNonZeroNumber(match?.score1) || hasNonZeroNumber(match?.score2)) return true;
  if (hasNonZeroNumber(match?.setsWon1) || hasNonZeroNumber(match?.setsWon2)) return true;

  if (Array.isArray(match?.sets)) {
    return match.sets.some((set) =>
      set?.completed === true ||
      hasNonZeroNumber(set?.score1) ||
      hasNonZeroNumber(set?.score2) ||
      hasNonZeroNumber(set?.games1) ||
      hasNonZeroNumber(set?.games2)
    );
  }

  if (match?.team1Score || match?.team2Score) {
    return hasNonZeroNumber(match.team1Score?.runs) ||
      hasNonZeroNumber(match.team1Score?.wickets) ||
      hasNonZeroNumber(match.team2Score?.runs) ||
      hasNonZeroNumber(match.team2Score?.wickets);
  }

  if (Array.isArray(match?.innings)) {
    return match.innings.some((innings) =>
      hasNonZeroNumber(innings?.runs) ||
      hasNonZeroNumber(innings?.wickets) ||
      hasNonZeroNumber(innings?.balls)
    );
  }

  return false;
}

function sanitizeElapsedSeconds(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > MAX_MATCH_DURATION_SECONDS) return undefined;
  return Math.round(value);
}

function getQuickMatchTimestamp(match) {
  const timestamps = [
    parseTimestamp(match?.updatedAt),
    parseTimestamp(match?.savedAt),
    parseTimestamp(match?.draftState?.savedAt),
    parseTimestamp(match?.completedAt),
    parseTimestamp(match?.date),
    parseTimestamp(match?.createdAt),
  ].filter(Number.isFinite);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function isStaleQuickDraft(match) {
  const status = String(match?.status || '').toLowerCase();
  if (status !== 'in-progress' && status !== 'active' && status !== 'paused') return false;

  const timestamp = getQuickMatchTimestamp(match);
  if (timestamp === null) return false;

  return Date.now() - timestamp > QUICK_MATCH_DRAFT_TTL_MS;
}

export function isStaleQuickMatchDraft(draft) {
  if (!draft || typeof draft !== 'object') return false;
  if (draft.status === 'completed') return false;
  const timestamp = getQuickMatchTimestamp(draft);
  if (timestamp === null) return false;
  return Date.now() - timestamp > QUICK_MATCH_DRAFT_TTL_MS;
}

function isCompletionSignal(match) {
  if (match?.status === 'completed') return true;
  if (match?.completedAt || match?.endedAt) return true;
  return Boolean(match?.winner && hasMeaningfulQuickScore(match));
}

function normalizeQuickMatchForStorage(match) {
  if (!match || typeof match !== 'object' || match.id === undefined || match.id === null) {
    return null;
  }

  const completed = isCompletionSignal(match);
  if (!completed && isStaleQuickDraft(match)) return null;
  if (completed && !hasMeaningfulQuickScore(match) && normalizeWinnerToken(match.winner) === 'Tie') return null;

  const timestamp = getQuickMatchTimestamp(match);
  const completedAt = completed
    ? (match.completedAt || match.endedAt || match.date || match.savedAt || match.createdAt || new Date(timestamp ?? Date.now()).toISOString())
    : match.completedAt;

  return {
    ...match,
    winner: normalizeWinnerToken(match.winner),
    status: completed ? 'completed' : (match.status || 'in-progress'),
    completedAt,
    elapsedSeconds: sanitizeElapsedSeconds(match.elapsedSeconds),
    draftState: completed ? undefined : match.draftState,
  };
}

function normalizedQuickMatches(matches) {
  if (!Array.isArray(matches)) return [];
  return matches
    .map(normalizeQuickMatchForStorage)
    .filter(Boolean);
}

// --- Safari Private Mode Detection & Memory Fallback ---

function createMemoryFallback() {
  const store = {};
  return {
    getItem(key) {
      return key in store ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };
}

function isStorageAvailable() {
  const testKey = '__gs_storage_test__';
  try {
    globalThis.localStorage.setItem(testKey, 'test');
    const result = globalThis.localStorage.getItem(testKey);
    globalThis.localStorage.removeItem(testKey);
    return result === 'test';
  } catch {
    return false;
  }
}

const storageAvailable = isStorageAvailable();
const memoryFallback = storageAvailable ? null : createMemoryFallback();
const isPrivateMode = !storageAvailable;

// Get the active storage backend
function getStorage() {
  return storageAvailable ? globalThis.localStorage : memoryFallback;
}

// --- Quota Handling ---

/**
 * Safely saves data, catching QuotaExceededError.
 * Returns { success: true } or { success: false, error: string }
 */
function safeSave(key, data) {
  try {
    getStorage().setItem(key, JSON.stringify(data));
    return { success: true };
  } catch (error) {
    if (
      error?.name === 'QuotaExceededError' ||
      error?.code === 22 ||
      error?.code === 1014 // Firefox
    ) {
      console.warn(`[ScoreEasy] Storage quota exceeded when saving "${key}".`);
      return { success: false, error: 'QuotaExceededError' };
    }
    console.warn(`[ScoreEasy] Storage save failed for "${key}":`, error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Estimate storage usage. Returns { used, total, percentage }.
 * total is estimated at 5MB for globalThis.localStorage.
 */
function getStorageUsage() {
  const ESTIMATED_TOTAL = 5 * 1024 * 1024; // 5 MB
  let used = 0;
  try {
    // For memory fallback, we can't measure usage
    if (storageAvailable) {
      for (let i = 0; i < globalThis.localStorage.length; i++) {
        const key = globalThis.localStorage.key(i);
        const value = globalThis.localStorage.getItem(key);
        used += (key.length + (value ? value.length : 0)) * 2; // UTF-16
      }
    }
  } catch {
    // If we can't measure, return 0
  }
  return {
    used,
    total: ESTIMATED_TOTAL,
    percentage: ESTIMATED_TOTAL > 0 ? used / ESTIMATED_TOTAL : 0,
  };
}

/**
 * Returns true if storage usage exceeds the threshold (default 80%).
 */
function isStorageNearFull(threshold = 0.8) {
  const { percentage } = getStorageUsage();
  return percentage >= threshold;
}

// --- Generic storage functions ---

export const saveData = (key, data) => {
  const result = safeSave(key, data);
  if (!result.success) {
    console.warn(`[ScoreEasy] Failed to save "${key}": ${result.error}`);
    return false;
  }
  return true;
};

export const loadData = (key, defaultValue = null) => {
  try {
    const data = getStorage().getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error('Error loading data:', error);
    return defaultValue;
  }
};

export const clearData = (key) => {
  try {
    getStorage().removeItem(key);
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
};


const isPlainPreferenceString = (value) => typeof value === 'string';

export const savePreference = (key, value) => {
  try {
    const serialized = isPlainPreferenceString(value) ? value : JSON.stringify(value);
    getStorage().setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`Error saving preference '${key}':`, error);
    return false;
  }
};

export const loadPreference = (key, defaultValue = null) => {
  try {
    const value = getStorage().getItem(key);
    if (value === null) return defaultValue;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error(`Error loading preference '${key}':`, error);
    return defaultValue;
  }
};
// Statistics storage
export const saveStatistics = (sport, stats) => {
  const allStats = loadData(STORAGE_KEYS.STATISTICS, {});
  allStats[sport] = stats;
  return saveData(STORAGE_KEYS.STATISTICS, allStats);
};

export const loadAllStatistics = () => {
  return loadData(STORAGE_KEYS.STATISTICS, {});
};

// === GENERIC SPORT STORAGE (works with any sport via storageKey) ===
export const saveSportTournament = (storageKey, tournamentData) => {
  const tournaments = loadData(storageKey, []);
  const existingIndex = tournaments.findIndex(t => t.id === tournamentData.id);

  if (existingIndex >= 0) {
    tournaments[existingIndex] = tournamentData;
  } else {
    tournaments.push(tournamentData);
  }

  return saveData(storageKey, tournaments);
};

export const loadSportTournaments = (storageKey) => {
  const tournaments = loadData(storageKey, []);

  // Apply format migration for backward compatibility
  const migratedTournaments = migrateTournaments(tournaments);

  // If any tournament was migrated, save the updated data back
  const needsSave = migratedTournaments.some((t, i) =>
    t.format?.formatMode && !tournaments[i]?.format?.formatMode
  );

  if (needsSave) {
    saveData(storageKey, migratedTournaments);
  }

  return migratedTournaments;
};

export const deleteSportTournament = (storageKey, tournamentId) => {
  const tournaments = loadData(storageKey, []);
  const filtered = tournaments.filter(t => t.id !== tournamentId);
  return saveData(storageKey, filtered);
};

// Quick Match storage (for test matches that navigate to a separate page)
export const saveQuickMatches = (matches) => {
  return saveData(STORAGE_KEYS.QUICK_MATCHES, normalizedQuickMatches(matches));
};

export const loadQuickMatches = () => {
  const stored = loadData(STORAGE_KEYS.QUICK_MATCHES, []);
  const normalized = normalizedQuickMatches(stored);
  if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
    saveData(STORAGE_KEYS.QUICK_MATCHES, normalized);
  }
  return normalized;
};

export const loadCompletedQuickMatches = () => {
  return loadQuickMatches().filter(m => m.status === 'completed');
};

export const replaceCompletedQuickMatches = (completedMatches) => {
  const activeMatches = loadQuickMatches().filter(m => m.status !== 'completed');
  return saveQuickMatches([...activeMatches, ...completedMatches]);
};

export const clearCompletedQuickMatches = () => {
  return replaceCompletedQuickMatches([]);
};

export const saveQuickMatch = (match) => {
  const normalized = normalizeQuickMatchForStorage(match);
  const matches = loadQuickMatches();
  const idx = matches.findIndex(m => m.id === match.id);
  if (!normalized) {
    if (idx >= 0) {
      matches.splice(idx, 1);
      return saveQuickMatches(matches);
    }
    return true;
  }

  if (idx >= 0) {
    matches[idx] = normalized;
  } else {
    matches.push(normalized);
  }
  return saveQuickMatches(matches);
};

export const loadQuickMatch = (matchId) => {
  const matches = loadQuickMatches();
  return matches.find(m => m.id === matchId || m.id === Number(matchId)) || null;
};

export const deleteQuickMatch = (matchId) => {
  const matches = loadQuickMatches();
  const filtered = matches.filter(m => String(m.id) !== String(matchId));
  return saveQuickMatches(filtered);
};

export {
  STORAGE_KEYS,
  safeSave,
  getStorageUsage,
  isStorageNearFull,
  isStorageAvailable,
  isPrivateMode,
  createMemoryFallback,
};
