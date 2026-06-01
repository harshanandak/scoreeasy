import { getSportsList } from '../models/sportRegistry';
import { loadData, loadSportTournaments } from './storage';
import { getActiveSessions, loadHistory } from './universalStorage';

export const APP_ENTRY_PATH = '/app';
export const PUBLIC_MARKETING_PATH = '/marketing';
export const QUICK_MATCHES_KEY = 'se_quickmatches';

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

export function hasReturningPlayerState({
  activeSessions = [],
  quickMatches = [],
  history = [],
  tournaments = [],
} = {}) {
  return hasItems(activeSessions) ||
    hasItems(quickMatches) ||
    hasItems(history) ||
    hasItems(tournaments);
}

export function loadReturningPlayerState() {
  try {
    const tournaments = getSportsList().flatMap((sport) => loadSportTournaments(sport.storageKey));
    return hasReturningPlayerState({
      activeSessions: getActiveSessions(),
      quickMatches: loadData(QUICK_MATCHES_KEY, []),
      history: loadHistory(),
      tournaments,
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
