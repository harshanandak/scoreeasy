import { getRetiredSportsList, getSportsList } from '../models/sportRegistry';
import { loadRetiredSavedMatches } from './retiredSavedMatches';
import { isStaleQuickMatchDraft, listDataKeys, loadData } from './storage';
import { TENNIS_QUICK_DRAFT_PREFIX } from './tennisQuickMatch';
import { getTournamentMatches, isTournamentMatchCompleted } from './tournamentSync';

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
      sport: sport.id,
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
        sport: 'tennis',
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

// Read-only catalog shared by cold entry and Home. Paths identify resumable
// surfaces: a quick scorer or a tournament's fixture picker.
export function loadInProgressMatches(sports = getSportsList()) {
  const quickMatches = [
    ...loadQuickMatchDrafts(sports),
    ...loadTennisQuickDrafts(),
    ...loadQuickMatchSummaries().filter((match) => match.entryPath),
  ].map((match) => ({ ...match, kind: 'quick' }));
  const tournaments = sports.flatMap((sport) => {
    const saved = loadData(sport.storageKey, []);
    if (!Array.isArray(saved)) return [];
    return saved.filter((tournament) => {
      if (tournament?.id === undefined || tournament?.id === null) return false;
      const matches = getTournamentMatches(tournament);
      return matches.some((match) => !isTournamentMatchCompleted(match, sport.engine, match.format || tournament.format));
    }).map((tournament) => ({
      ...tournament,
      sport: sport.id,
      kind: 'tournament',
      entryPath: `/${sport.id}/tournament/${tournament.id}`,
    }));
  });
  return [...new Map([...quickMatches, ...tournaments].map((match) => [match.entryPath, match])).values()];
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
    const inProgressMatches = loadInProgressMatches(sports);
    const onlyMatch = inProgressMatches.length === 1 ? inProgressMatches[0] : null;
    // Preserve tournament-only entry at Home; only a lone quick match jumps
    // straight to scoring. Multiple entries always share Home's resume list.
    const draftEntryPath = onlyMatch?.kind === 'quick' ? onlyMatch.entryPath : null;

    return {
      draftEntryPath,
      returningPlayerState: hasReturningPlayerState({
        activeSessions: loadActiveSessionSummaries(),
        quickMatchDrafts,
        quickMatches,
        history: loadRetiredSavedMatches(),
        tournaments: loadTournamentSummaries([...sports, ...getRetiredSportsList()]),
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
