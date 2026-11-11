import { matchStorageKey } from './accountStorage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_ENTRY_PATH,
  ENTERED_APP_KEY,
  QUICK_MATCHES_KEY,
  QUICK_MATCH_DRAFT_PREFIX,
  SESSIONS_KEY,
  PUBLIC_HOME_PATH,
  getAppEntryTarget,
  getHomePath,
  hasReturningPlayerState,
  loadActiveSessionSummaries,
  loadAppEntryState,
  loadQuickMatchSummaries,
  loadReturningPlayerState,
  loadInProgressMatches,
} from './appEntry';
import { getSportsList } from '../models/sportRegistry';
import { TENNIS_QUICK_DRAFT_PREFIX, getTennisQuickDraftKey } from './tennisQuickMatch';

function expectNativeEntry(state, draftEntryPath) {
  expect(state.returningPlayerState).toBe(true);
  expect(state.draftEntryPath).toBe(draftEntryPath);
  expect(getAppEntryTarget({ ...state, native: true })).toBe(draftEntryPath ?? APP_ENTRY_PATH);
}
const storageSnapshot = () => Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => {
  const key = localStorage.key(i);
  return [key, localStorage.getItem(key)];
}));

describe('app entry contract', () => {
  it('lists and migrates each resumable sport draft alongside tennis, Test matches and tournaments', () => {
    const now = new Date().toISOString();
    const sports = getSportsList().filter((sport) => sport.id !== 'tennis');
    for (const sport of sports) {
      localStorage.setItem(matchStorageKey(`se_quickmatch_draft_${sport.id}`), JSON.stringify({ sport: sport.id, quickMatchId: 1, phase: 'scoring', updatedAt: now }));
    }
    localStorage.setItem(matchStorageKey(getTennisQuickDraftKey('tennis-1')), JSON.stringify({ id: 'tennis-1', status: 'in-progress', updatedAt: now }));
    localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([
      { id: 'test-1', sport: 'cricket', status: 'in-progress', format: { totalInnings: 4 }, updatedAt: now },
      { id: 'finished', sport: 'cricket', status: 'completed', format: { totalInnings: 4 } },
    ]));
    localStorage.setItem(matchStorageKey('se_football'), JSON.stringify([
      { id: 1, name: 'Cup', matches: [{ id: 'm1', status: 'pending' }], knockoutMatches: [] },
      { id: 2, matches: [{ status: 'completed' }] },
      { id: 3, matches: [{ status: 'completed' }], knockoutMatches: [{ status: 'pending' }] },
    ]));
    const entries = loadInProgressMatches();
    expect(entries.map((entry) => entry.entryPath)).toEqual(expect.arrayContaining([
      ...sports.map((sport) => `/${sport.id}/quick?resume=1`),
      '/tennis/quick/live/tennis-1', '/cricket/quick/test-match/test-1',
      '/football/tournament/1', '/football/tournament/3',
    ]));
    expect(entries).toHaveLength(sports.length + 4);
    expect(new Set(entries.map((entry) => entry.entryPath)).size).toBe(entries.length);
    for (const sport of sports) expect(JSON.parse(localStorage.getItem(matchStorageKey(`se_quickmatch_draft_${sport.id}_1`))).quickMatchId).toBe(1);
    expectNativeEntry(loadAppEntryState(), null);
  });

  it('excludes setup and completed drafts but retains old scoring drafts', () => {
    localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball'), JSON.stringify({ phase: 'setup' }));
    localStorage.setItem(matchStorageKey('se_quickmatch_draft_football'), JSON.stringify({ phase: 'scoring', updatedAt: '2020-01-01' }));
    localStorage.setItem(matchStorageKey(getTennisQuickDraftKey('old')), JSON.stringify({ status: 'completed' }));
    expect(loadInProgressMatches()).toEqual([expect.objectContaining({ sport: 'football' })]);
  });
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    globalThis.localStorage.clear();
  });

  it('routes authenticated players to the app dashboard', () => {
    expect(getAppEntryTarget({ isAuthenticated: true })).toBe(APP_ENTRY_PATH);
  });

  it('routes returning local players to the app dashboard', () => {
    expect(getAppEntryTarget({ returningPlayerState: true, native: true })).toBe(APP_ENTRY_PATH);
  });

  it('keeps anonymous first-time visitors on Home', () => {
    expect(getAppEntryTarget()).toBe(PUBLIC_HOME_PATH);
  });

  it('waits while auth state is loading', () => {
    expect(getAppEntryTarget({ isLoading: true })).toBeNull();
  });

  it.each([false, true])('web ignores saved drafts and the entered flag when authenticated=%s', (isAuthenticated) => {
    expect(getAppEntryTarget({ native: false, isAuthenticated, returningPlayerState: true, draftEntryPath: '/tennis/quick/live/kept' }))
      .toBe(isAuthenticated ? APP_ENTRY_PATH : PUBLIC_HOME_PATH);
  });

  it.each([[false, false, '/'], [true, false, '/app'], [false, true, '/app'], [true, true, '/app']])('resolves shared Home for auth=%s native=%s', (auth, native, expected) => {
    expect(getHomePath(auth, native)).toBe(expected);
  });

  it.each([[false, false, '/'], [true, false, '/app'], [false, true, '/app']])('preserves native fallback for auth=%s returning=%s', (isAuthenticated, returningPlayerState, expected) => {
    expect(getAppEntryTarget({ native: true, isAuthenticated, returningPlayerState })).toBe(expected);
  });

  it('detects returning-player continuity from resume and recent-match state', () => {
    expect(hasReturningPlayerState({ activeSessions: [{ id: 'live-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ quickMatchDrafts: [{ phase: 'scoring' }] })).toBe(true);
    expect(hasReturningPlayerState({ quickMatches: [{ id: 'match-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ history: [{ id: 'history-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ tournaments: [{ id: 'cup-1' }] })).toBe(true);
    expect(hasReturningPlayerState()).toBe(false);
  });

  it.each([
    ENTERED_APP_KEY, QUICK_MATCHES_KEY, SESSIONS_KEY,
    `${QUICK_MATCH_DRAFT_PREFIX}volleyball`, `${TENNIS_QUICK_DRAFT_PREFIX}saved`,
    'gamescore_quickmatch_draft_volleyball', 'gamescore_quickmatches', 'gamescore_tennis_quick_draft_saved',
    matchStorageKey(QUICK_MATCHES_KEY, 'another account'), matchStorageKey(SESSIONS_KEY),
    matchStorageKey(`${TENNIS_QUICK_DRAFT_PREFIX}saved`, 'another account'),
    ...getSportsList().flatMap(sport => [sport.storageKey, sport.storageKey.replace(/^se_/, 'gamescore_'), matchStorageKey(sport.storageKey, 'another account')]),
  ])('offers My matches for key %s without reading values or changing storage', key => {
    localStorage.setItem(key, 'not JSON');
    const before = storageSnapshot();
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(loadReturningPlayerState()).toBe(true);
    expect(read).not.toHaveBeenCalled();
    expect(storageSnapshot()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('has no returning-player hint for an empty store', () => {
    expect(loadReturningPlayerState()).toBe(false);
    expect(storageSnapshot()).toEqual({});
  });

  it.each(['theme', 'se_migrated', 'gs_preferences', 'se_setup_prefs_v1', 'se_local:account:scorer:gs_preferences', 'unrelated_se_quickmatches'])('ignores unrelated key %s without changing storage', key => {
    localStorage.setItem(key, 'not JSON');
    const before = storageSnapshot();
    expect(loadReturningPlayerState()).toBe(false);
    expect(storageSnapshot()).toEqual(before);
  });

  it('detects in-progress quick-match drafts as returning-player state', () => {
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball'), JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
      quickMatchId: 1,
    }));

    expect(loadReturningPlayerState()).toBe(true);
  });

  it('routes generic draft-only app entry to the draft scorer path', () => {
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball'), JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
      quickMatchId: 1,
    }));

    const state = loadAppEntryState();

    expectNativeEntry(state, '/volleyball/quick?resume=1');
  });

  it('resumes old generic quick-match drafts on app entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball'), JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
      updatedAt: '2026-05-30T12:00:00.000Z',
      quickMatchId: 1,
    }));
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ id: 'recent-1', sport: 'cricket' }]));

    const state = loadAppEntryState();

    expectNativeEntry(state, '/volleyball/quick?resume=1');
  });

  it('routes tennis quick-live drafts to the draft scorer path', () => {
    globalThis.localStorage.setItem(matchStorageKey(getTennisQuickDraftKey('match-1')), JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
    }));

    const state = loadAppEntryState();

    expectNativeEntry(state, '/tennis/quick/live/match-1');
  });

  it('routes in-progress cricket Test quick matches to the draft scorer path', () => {
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{
      id: 'test-1',
      sport: 'cricket',
      status: 'in-progress',
      format: { totalInnings: 4 },
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()[0].entryPath).toBe('/cricket/quick/test-match/test-1');
    expectNativeEntry(state, '/cricket/quick/test-match/test-1');
  });

  it('does not use completed cricket Test quick matches as app-entry scorer routes', () => {
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{
      id: 'test-1',
      sport: 'cricket',
      status: 'completed',
      format: { totalInnings: 4 },
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()[0].entryPath).toBeNull();
    expectNativeEntry(state, null);
  });

  it('keeps older completed quick matches without explicit completed status as returning state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{
      id: 'legacy-result-1',
      sport: 'football',
      winner: 'Team A',
      completedAt: '2026-05-20T12:00:00.000Z',
      team1: 'Team A',
      team2: 'Team B',
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()).toHaveLength(1);
    expectNativeEntry(state, null);
  });

  it('resumes old cricket Test quick matches on app entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{
      id: 'test-1',
      sport: 'cricket',
      status: 'in-progress',
      updatedAt: '2026-05-30T12:00:00.000Z',
      format: { totalInnings: 4 },
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()).toHaveLength(1);
    expectNativeEntry(state, '/cricket/quick/test-match/test-1');
  });

  it('resumes old tennis quick-live drafts on app entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem(matchStorageKey(getTennisQuickDraftKey('match-1')), JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
      updatedAt: '2026-05-30T12:00:00.000Z',
    }));
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ id: 'recent-1', sport: 'cricket' }]));

    const state = loadAppEntryState();

    expectNativeEntry(state, '/tennis/quick/live/match-1');
  });

  it('checks saved tournaments without rewriting storage during app entry', () => {
    const storedTournament = [{ id: 'cup-1', name: 'Office Cup' }];
    globalThis.localStorage.setItem(matchStorageKey('se_volleyball'), JSON.stringify(storedTournament));

    expect(loadReturningPlayerState()).toBe(true);
    expect(JSON.parse(globalThis.localStorage.getItem(matchStorageKey('se_volleyball')))).toEqual(storedTournament);
  });

  it('offers the link for a tournament key even when its value is malformed', () => {
    globalThis.localStorage.setItem(matchStorageKey('se_volleyball'), JSON.stringify({ id: 'bad-cup' }));

    expect(loadReturningPlayerState()).toBe(true);
  });

  it('keeps corrupt session storage from hiding other returning-player state', () => {
    globalThis.localStorage.setItem(matchStorageKey('gs_sessions'), JSON.stringify({ id: 'bad-session' }));
    globalThis.localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ id: 'recent-1', sport: 'cricket' }]));

    expect(loadActiveSessionSummaries()).toEqual([]);
    expect(loadReturningPlayerState()).toBe(true);
  });

  it('offers history-only users My matches without redirecting the web root', () => {
    globalThis.localStorage.setItem(matchStorageKey('gs_history'), JSON.stringify([{ id: 'legacy-1' }]));

    expect(loadReturningPlayerState()).toBe(true);
    expect(getAppEntryTarget(loadAppEntryState())).toBe(PUBLIC_HOME_PATH);
  });
});
