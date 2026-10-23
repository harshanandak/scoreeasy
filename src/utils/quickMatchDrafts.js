import { clearData, loadData, saveData } from './storage';

export const QUICK_MATCH_DRAFT_PREFIX = 'se_quickmatch_draft_';
export function createQuickMatchId() {
  // Device clocks can repeat across tabs or reloads. Keep identity independent
  // of the clock; existing numeric draft ids are restored unchanged.
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
}

export function getQuickMatchDraftKey(sport, matchId) {
  return `${QUICK_MATCH_DRAFT_PREFIX}${sport}_${matchId}`;
}

// Write the complete snapshot before removing the legacy slot. A failed write
// leaves the old match reachable, including all of its undo history.
export function migrateQuickMatchDraft(sport) {
  const legacyKey = `${QUICK_MATCH_DRAFT_PREFIX}${sport}`;
  const draft = loadData(legacyKey, null);
  if (!draft || draft.phase !== 'scoring') return null;
  const matchId = draft.quickMatchId ?? createQuickMatchId();
  const key = getQuickMatchDraftKey(sport, matchId);
  const existing = loadData(key, null);
  if (existing) {
    // A retried migration must not replace a newer per-match snapshot.
    clearData(legacyKey);
    return { key, draft: existing };
  }
  const migrated = { ...draft, sport: draft.sport || sport, quickMatchId: matchId };
  if (!saveData(key, migrated)) return { key: legacyKey, draft };
  clearData(legacyKey);
  return { key, draft: migrated };
}
