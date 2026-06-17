import { getSportsList } from '../models/sportRegistry';
import { isStaleQuickMatchDraft, listDataKeys, loadData } from './storage';
import { TENNIS_QUICK_DRAFT_PREFIX } from './tennisQuickMatch';

export const APP_ENTRY_RESOLVER_PATH = '/';
export const APP_ENTRY_PATH = '/app';
export const PUBLIC_MARKETING_PATH = '/marketing';
export const QUICK_MATCHES_KEY = 'se_quickmatches';
export const QUICK_MATCH_DRAFT_PREFIX = 'se_quickmatch_draft_';
export const SESSIONS_KEY = 'gs_sessions';

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
    .filter((draft) => draft?.phase === 'scoring' && !isStaleQuickMatchDraft(draft));
}

export function loadTennisQuickDrafts() {
  return listDataKeys()
    .filter((key) => key.startsWith(TENNIS_QUICK_DRAFT_PREFIX))
    .map((key) => {
      const draft = loadData(key, null);
      const matchId = draft?.id || key.slice(TENNIS_QUICK_DRAFT_PREFIX.length);
      return {
        ...draft,
        entryPath: `/tennis/quick/live/${matchId}`,
      };
    })
    .filter((draft) => draft?.status === 'in-progress' && draft?.entryPath && !isStaleQuickMatchDraft(draft));
}

export function loadTournamentSummaries(sports = getSportsList()) {
  return sports.flatMap((sport) => {
    const tournaments = loadData(sport.storageKey, []);
    return Array.isArray(tournaments) ? tournaments : [];
  });
}

export function loadQuickMatchSummaries() {
  const quickMatches = loadData(QUICK_MATCHES_KEY, []);
  if (!Array.isArray(quickMatches)) return [];

  return quickMatches.map((match) => {
    const isCricketTest = match?.sport === 'cricket' &&
      match?.status === 'in-progress' &&
      match?.format?.totalInnings === 4 &&
      match?.id !== undefined &&
      match?.id !== null;

    return {
      ...match,
      entryPath: isCricketTest ? `/cricket/quick/test-match/${match.id}` : null,
    };
  }).filter((match) => match?.status !== 'in-progress' || !isStaleQuickMatchDraft(match));
}

export function loadActiveSessionSummaries() {
  const sessions = loadData(SESSIONS_KEY, []);
  if (!Array.isArray(sessions)) return [];
  return sessions.filter((session) => session?.status === 'active' || session?.status === 'paused');
}

export function loadAppEntryState() {
  try {
    const sports = getSportsList();
    const quickMatchDrafts = [
      ...loadQuickMatchDrafts(sports),
      ...loadTennisQuickDrafts(),
    ];
    const quickMatches = loadQuickMatchSummaries();
    // Only auto-resume when there's exactly ONE in-progress match. If several are
    // saved (e.g. abandoned quick drafts piling up), don't force-redirect into an
    // arbitrary one — return null so the app entry lands on the dashboard and the
    // player can go home (or pick a match to resume) instead of being trapped.
    const resumableEntryPaths = [
      ...quickMatchDrafts.map((draft) => draft.entryPath),
      ...quickMatches.map((match) => match.entryPath),
    ].filter(Boolean);
    const draftEntryPath = resumableEntryPaths.length === 1 ? resumableEntryPaths[0] : null;

    return {
      draftEntryPath,
      returningPlayerState: hasReturningPlayerState({
        activeSessions: loadActiveSessionSummaries(),
        quickMatchDrafts,
        quickMatches,
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
  draftEntryPath = null,
  isAuthenticated = false,
  isLoading = false,
  returningPlayerState = false,
} = {}) {
  if (isLoading) return null;
  if (draftEntryPath) return draftEntryPath;
  return isAuthenticated || returningPlayerState ? APP_ENTRY_PATH : PUBLIC_MARKETING_PATH;
}
