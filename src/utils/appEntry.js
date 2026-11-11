import { Capacitor } from '@capacitor/core';
import { getSportsList } from '../models/sportRegistry';
import { listDataKeys, loadData, saveData } from './storage';
import { KEYS as SESSION_STORAGE_KEYS } from './universalStorage';
import { QUICK_MATCH_DRAFT_PREFIX, migrateQuickMatchDraft } from './quickMatchDrafts';
import { TENNIS_QUICK_DRAFT_PREFIX } from './tennisQuickMatch';
import { getTournamentMatches, isTournamentMatchCompleted } from './tournamentSync';
import { inProgressProblem, inProgressTimestamp } from './inProgressMatch';
import { isKabaddiMigrationBackup, migrateLegacyKabaddiBackups } from './kabaddiMigrationBackups';

export const APP_ENTRY_RESOLVER_PATH = '/';
export const APP_ENTRY_PATH = '/app';
export const PUBLIC_HOME_PATH = '/';
export function getHomePath(isAuthenticated, native = Capacitor.isNativePlatform()) {
  return native || isAuthenticated ? APP_ENTRY_PATH : PUBLIC_HOME_PATH;
}

export const ENTERED_APP_KEY = 'se_entered_app';
export function markAppEntered() { saveData(ENTERED_APP_KEY, true); }
export const QUICK_MATCHES_KEY = 'se_quickmatches';
export { QUICK_MATCH_DRAFT_PREFIX } from './quickMatchDrafts';
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
  migrateLegacyKabaddiBackups();
  sports.forEach((sport) => migrateQuickMatchDraft(sport.id));
  return listDataKeys().filter(key => key.startsWith(QUICK_MATCH_DRAFT_PREFIX) && !isKabaddiMigrationBackup(key)).flatMap((key) => {
    const draft = loadData(key, null);
    const sport = draft?.sport || sports.find(sp => key === `${QUICK_MATCH_DRAFT_PREFIX}${sp.id}`)?.id;
    if (!sport || draft?.phase !== 'scoring' || !sports.some(sp => sp.id === sport)) return [];
    const legacy = key === `${QUICK_MATCH_DRAFT_PREFIX}${sport}`;
    return [{ ...draft, sport, draftKey: key, entryPath: legacy ? `/${sport}/quick` : `/${sport}/quick?resume=${encodeURIComponent(draft.quickMatchId)}` }];
  });
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
        draftKey: key,
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
  });
}

export function loadActiveSessionSummaries() {
  const sessions = loadData(SESSIONS_KEY, []);
  if (!Array.isArray(sessions)) return [];
  return sessions.filter((session) => session?.status === 'active' || session?.status === 'paused');
}

// Catalog shared by cold entry, Home and History. Paths identify resumable
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
    }).flatMap((tournament) => {
      const started = getTournamentMatches(tournament).filter(match =>
        !isTournamentMatchCompleted(match, sport.engine, match.format || tournament.format)
        && (match.draftState || match.status === 'in-progress'));
      const nameOf = (ref) => tournament.teams?.find(team => team.id === ref)?.name || tournament.teams?.[ref]?.name || String(ref || 'Team');
      // A started fixture whose team cannot be found in its tournament has no board to open.
      const hasTeam = (ref) => ref !== undefined && ref !== null
        && Boolean(tournament.teams?.some(team => team.id === ref) || tournament.teams?.[ref]);
      if (started.length) return started.map(match => ({
        ...match, sport: sport.id, kind: 'tournament-match', tournamentId: tournament.id,
        teamsMissing: !hasTeam(match.team1Id ?? match.team1) || !hasTeam(match.team2Id ?? match.team2),
        storageKey: sport.storageKey, tournamentName: tournament.name,
        team1Name: nameOf(match.team1Id ?? match.team1), team2Name: nameOf(match.team2Id ?? match.team2),
        entryPath: `/${sport.id}/tournament/${tournament.id}/match/${match.id}/score`,
      }));
      return [{ ...tournament, sport: sport.id, kind: 'tournament', entryPath: `/${sport.id}/tournament/${tournament.id}` }];
    });
  });
  return [...new Map([...quickMatches, ...tournaments].map((match) => [match.entryPath, match])).values()]
    .map((match) => ({ ...match, openProblem: inProgressProblem(match) || undefined }))
    .sort((a, b) => (inProgressTimestamp(b) || 0) - (inProgressTimestamp(a) || 0));
}

// The kept entry whose board lives at this URL, following the scorer's own restore rules (MonoQuickMatch):
// a result URL and a setup opened with newMatch/teams state restore nothing; ?resume=<id> restores that
// draft; the bare quick URL restores the newest quick draft of the sport. Anything else: null, so the
// crash screen never offers to delete a match the board did not load.
export function findKeptMatchForUrl(pathname, search = '', state = null) {
  const params = new URLSearchParams(search);
  const quick = /^\/([^/]+)\/quick\/?$/.exec(pathname);
  if (quick && (params.has('result') || state?.newMatch === true || Array.isArray(state?.teams))) return null;
  const resume = params.get('resume');
  const matches = loadInProgressMatches();
  const decode = (value) => { try { return decodeURI(value); } catch { return value; } };
  const sameUrl = (entryPath) => {
    const [entryPathname, entrySearch = ''] = entryPath.split('?');
    return decode(entryPathname) === decode(pathname) && new URLSearchParams(entrySearch).get('resume') === resume;
  };
  const exact = matches.find(match => match.kind !== 'tournament' && sameUrl(match.entryPath));
  if (exact || !quick || resume !== null) return exact || null;
  // Already newest first.
  return matches.find(match => match.kind === 'quick' && match.sport === quick[1]
    && match.draftKey?.startsWith(QUICK_MATCH_DRAFT_PREFIX)) || null;
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
    const draftEntryPath = onlyMatch?.kind === 'quick' && !onlyMatch.openProblem ? onlyMatch.entryPath : null;

    return {
      draftEntryPath,
      returningPlayerState: loadData(ENTERED_APP_KEY, false) === true || hasReturningPlayerState({
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

// A false positive only offers /app, whose readers enforce access; avoid hiding saved matches or migrating them for a link.
export function loadReturningPlayerState() {
  try {
    const storage = globalThis.localStorage;
    const matchKeys = new Set([ENTERED_APP_KEY, QUICK_MATCHES_KEY, SESSIONS_KEY, SESSION_STORAGE_KEYS.HISTORY,
      ...getSportsList().map(sport => sport.storageKey)]);
    for (let index = 0; index < storage.length; index += 1) {
      const key = (storage.key(index) || '').replace(/^se_local:(?:guest|account:[^:]+):/, '').replace(/^gamescore_/, 'se_');
      if (matchKeys.has(key) || key.startsWith(QUICK_MATCH_DRAFT_PREFIX) || key.startsWith(TENNIS_QUICK_DRAFT_PREFIX)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getAppEntryTarget({
  draftEntryPath = null,
  isAuthenticated = false,
  isLoading = false,
  returningPlayerState = false,
  native = Capacitor.isNativePlatform(),
} = {}) {
  if (isLoading) return null;
  if (!native) return getHomePath(isAuthenticated, false);
  if (draftEntryPath) return draftEntryPath;
  return isAuthenticated || returningPlayerState ? APP_ENTRY_PATH : PUBLIC_HOME_PATH;
}
