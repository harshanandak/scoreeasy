import { getSportsList } from '../models/sportRegistry';
import { loadData } from './storage';
import { TENNIS_QUICK_DRAFT_PREFIX } from './tennisQuickMatch';
import { getActiveSessions, loadHistory } from './universalStorage';

export const APP_ENTRY_PATH = '/app';
export const PUBLIC_MARKETING_PATH = '/marketing';
export const QUICK_MATCHES_KEY = 'se_quickmatches';
export const QUICK_MATCH_DRAFT_PREFIX = 'se_quickmatch_draft_';

function getBrowserStorageKeys() {
  try {
    const { localStorage } = globalThis;
    if (!localStorage) return [];
    return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter(Boolean);
  } catch {
    return [];
  }
}

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
    .map((sport) => ({
      ...loadData(`${QUICK_MATCH_DRAFT_PREFIX}${sport.id}`, null),
      entryPath: `/${sport.id}/quick`,
    }))
    .filter((draft) => draft?.phase === 'scoring');
}

export function loadTennisQuickDrafts() {
  return getBrowserStorageKeys()
    .filter((key) => key.startsWith(TENNIS_QUICK_DRAFT_PREFIX))
    .map((key) => {
      const draft = loadData(key, null);
      const matchId = draft?.id || key.slice(TENNIS_QUICK_DRAFT_PREFIX.length);
      return {
        ...draft,
        entryPath: `/tennis/quick/live/${matchId}`,
      };
    })
    .filter((draft) => draft?.status === 'in-progress' && draft?.entryPath);
}

export function loadTournamentSummaries(sports = getSportsList()) {
  return sports.flatMap((sport) => {
    const tournaments = loadData(sport.storageKey, []);
    return Array.isArray(tournaments) ? tournaments : [];
  });
}

export function loadAppEntryState() {
  try {
    const sports = getSportsList();
    const quickMatchDrafts = [
      ...loadQuickMatchDrafts(sports),
      ...loadTennisQuickDrafts(),
    ];
    const draftEntryPath = quickMatchDrafts.find((draft) => draft.entryPath)?.entryPath || null;

    return {
      draftEntryPath,
      returningPlayerState: hasReturningPlayerState({
        activeSessions: getActiveSessions(),
        quickMatchDrafts,
        quickMatches: loadData(QUICK_MATCHES_KEY, []),
        history: loadHistory(),
        tournaments: loadTournamentSummaries(sports),
      }),
    };
  } catch {
    return {
      draftEntryPath: null,
      returningPlayerState: false,
    };
  }
}

export function loadReturningPlayerState() {
  return loadAppEntryState().returningPlayerState;
}

export function getAppEntryTarget({
  isAuthenticated = false,
  isLoading = false,
  draftEntryPath = null,
  returningPlayerState = false,
} = {}) {
  if (isLoading) return null;
  if (draftEntryPath) return draftEntryPath;
  return isAuthenticated || returningPlayerState ? APP_ENTRY_PATH : PUBLIC_MARKETING_PATH;
}
