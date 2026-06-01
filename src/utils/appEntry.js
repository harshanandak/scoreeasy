import { getSportsList } from '../models/sportRegistry';
import { loadData } from './storage';
import { getActiveSessions, loadHistory } from './universalStorage';

export const APP_ENTRY_PATH = '/app';
export const PUBLIC_MARKETING_PATH = '/marketing';
export const QUICK_MATCHES_KEY = 'se_quickmatches';
export const QUICK_MATCH_DRAFT_PREFIX = 'se_quickmatch_draft_';

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

export function hasReturningPlayerState({
  activeSessions = [],
  quickMatchDrafts = [],
  quickMatches = [],
  history = [],
  tournaments = [],
} = {}) {
  return hasItems(activeSessions) ||
    hasItems(quickMatchDrafts) ||
    hasItems(quickMatches) ||
    hasItems(history) ||
    hasItems(tournaments);
}

export function loadQuickMatchDrafts(sports = getSportsList()) {
  return sports
    .map((sport) => loadData(`${QUICK_MATCH_DRAFT_PREFIX}${sport.id}`, null))
    .filter((draft) => draft?.phase === 'scoring');
}

export function loadTournamentSummaries(sports = getSportsList()) {
  return sports.flatMap((sport) => loadData(sport.storageKey, []));
}

export function loadReturningPlayerState() {
  try {
    const sports = getSportsList();
    return hasReturningPlayerState({
      activeSessions: getActiveSessions(),
      quickMatchDrafts: loadQuickMatchDrafts(sports),
      quickMatches: loadData(QUICK_MATCHES_KEY, []),
      history: loadHistory(),
      tournaments: loadTournamentSummaries(sports),
    });
  } catch {
    return false;
  }
}

export function getAppEntryTarget({
  isAuthenticated = false,
  isLoading = false,
  returningPlayerState = false,
} = {}) {
  if (isLoading) return null;
  return isAuthenticated || returningPlayerState ? APP_ENTRY_PATH : PUBLIC_MARKETING_PATH;
}
