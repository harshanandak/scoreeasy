import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_ENTRY_PATH,
  PUBLIC_MARKETING_PATH,
  getAppEntryTarget,
  hasReturningPlayerState,
  loadActiveSessionSummaries,
  loadAppEntryState,
  loadQuickMatchSummaries,
  loadReturningPlayerState,
  loadInProgressMatches,
} from './appEntry';
import { getSportsList } from '../models/sportRegistry';
import { getTennisQuickDraftKey } from './tennisQuickMatch';

describe('app entry contract', () => {
  it('lists each resumable sport draft, tennis draft, Test match and unfinished tournament once without writing storage', () => {
    const now = new Date().toISOString();
    const sports = getSportsList().filter((sport) => sport.id !== 'tennis');
    for (const sport of sports) {
      localStorage.setItem(`se_quickmatch_draft_${sport.id}`, JSON.stringify({ sport: sport.id, phase: 'scoring', updatedAt: now }));
    }
    localStorage.setItem(getTennisQuickDraftKey('tennis-1'), JSON.stringify({ id: 'tennis-1', status: 'in-progress', updatedAt: now }));
    localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'test-1', sport: 'cricket', status: 'in-progress', format: { totalInnings: 4 }, updatedAt: now },
      { id: 'finished', sport: 'cricket', status: 'completed', format: { totalInnings: 4 } },
    ]));
    localStorage.setItem('se_football', JSON.stringify([
      { id: 1, name: 'Cup', matches: [{ id: 'm1', status: 'pending' }], knockoutMatches: [] },
      { id: 2, matches: [{ status: 'completed' }] },
      { id: 3, matches: [{ status: 'completed' }], knockoutMatches: [{ status: 'pending' }] },
    ]));
    const before = JSON.stringify(localStorage);
    const entries = loadInProgressMatches();
    expect(entries.map((entry) => entry.entryPath)).toEqual(expect.arrayContaining([
      ...sports.map((sport) => `/${sport.id}/quick`),
      '/tennis/quick/live/tennis-1', '/cricket/quick/test-match/test-1',
      '/football/tournament/1', '/football/tournament/3',
    ]));
    expect(entries).toHaveLength(sports.length + 4);
    expect(new Set(entries.map((entry) => entry.entryPath)).size).toBe(entries.length);
    expect(JSON.stringify(localStorage)).toBe(before);
    expect(getAppEntryTarget(loadAppEntryState())).toBe('/app');
  });

  it('ignores retired-sport drafts and tournaments without rewriting storage', () => {
    const now = new Date().toISOString();
    const sports = ['pickleball', 'squash', 'rugby', 'futsal', 'handball'];
    for (const sport of sports) {
      localStorage.setItem(`se_quickmatch_draft_${sport}`, JSON.stringify({ phase: 'scoring', updatedAt: now }));
      localStorage.setItem(`se_${sport}`, JSON.stringify([{ id: 1, matches: [{ status: 'pending' }] }]));
    }
    localStorage.setItem('se_quickmatches', JSON.stringify(sports.map((sport) => ({
      id: sport, sport, status: 'in-progress', updatedAt: now,
    }))));
    const before = JSON.stringify(localStorage);
    expect(loadInProgressMatches()).toEqual([]);
    expect(loadAppEntryState()).toEqual({ draftEntryPath: null, returningPlayerState: false });
    expect(JSON.stringify(localStorage)).toBe(before);
  });

  it('excludes setup, expired and completed drafts from the resume catalog', () => {
    localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({ phase: 'setup' }));
    localStorage.setItem('se_quickmatch_draft_football', JSON.stringify({ phase: 'scoring', updatedAt: '2020-01-01' }));
    localStorage.setItem(getTennisQuickDraftKey('old'), JSON.stringify({ status: 'completed' }));
    expect(loadInProgressMatches()).toEqual([]);
  });
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.localStorage.clear();
  });

  it('routes authenticated players to the app dashboard', () => {
    expect(getAppEntryTarget({ isAuthenticated: true })).toBe(APP_ENTRY_PATH);
  });

  it('routes returning local players to the app dashboard', () => {
    expect(getAppEntryTarget({ returningPlayerState: true })).toBe(APP_ENTRY_PATH);
  });

  it('keeps anonymous first-time visitors on the public marketing route', () => {
    expect(getAppEntryTarget()).toBe(PUBLIC_MARKETING_PATH);
  });

  it('waits while auth state is loading', () => {
    expect(getAppEntryTarget({ isLoading: true })).toBeNull();
  });

  it('detects returning-player continuity from resume and recent-match state', () => {
    expect(hasReturningPlayerState({ activeSessions: [{ id: 'live-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ quickMatchDrafts: [{ phase: 'scoring' }] })).toBe(true);
    expect(hasReturningPlayerState({ quickMatches: [{ id: 'match-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ history: [{ id: 'history-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ tournaments: [{ id: 'cup-1' }] })).toBe(true);
    expect(hasReturningPlayerState()).toBe(false);
  });

  it('detects in-progress quick-match drafts as returning-player state', () => {
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
    }));

    expect(loadReturningPlayerState()).toBe(true);
  });

  it('routes generic draft-only app entry to the draft scorer path', () => {
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
    }));

    const state = loadAppEntryState();

    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBe('/volleyball/quick');
    expect(getAppEntryTarget(state)).toBe('/volleyball/quick');
  });

  it('ignores expired generic quick-match drafts before choosing an app-entry route', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
      updatedAt: '2026-05-30T12:00:00.000Z',
    }));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket' }]));

    const state = loadAppEntryState();

    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBeNull();
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
  });

  it('routes tennis quick-live drafts to the draft scorer path', () => {
    globalThis.localStorage.setItem(getTennisQuickDraftKey('match-1'), JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
    }));

    const state = loadAppEntryState();

    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBe('/tennis/quick/live/match-1');
    expect(getAppEntryTarget(state)).toBe('/tennis/quick/live/match-1');
  });

  it('routes in-progress cricket Test quick matches to the draft scorer path', () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{
      id: 'test-1',
      sport: 'cricket',
      status: 'in-progress',
      format: { totalInnings: 4 },
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()[0].entryPath).toBe('/cricket/quick/test-match/test-1');
    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBe('/cricket/quick/test-match/test-1');
    expect(getAppEntryTarget(state)).toBe('/cricket/quick/test-match/test-1');
  });

  it('does not use completed cricket Test quick matches as app-entry scorer routes', () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{
      id: 'test-1',
      sport: 'cricket',
      status: 'completed',
      format: { totalInnings: 4 },
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()[0].entryPath).toBeNull();
    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBeNull();
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
  });

  it('keeps older completed quick matches without explicit completed status as returning state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{
      id: 'legacy-result-1',
      sport: 'football',
      winner: 'Team A',
      completedAt: '2026-05-20T12:00:00.000Z',
      team1: 'Team A',
      team2: 'Team B',
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()).toHaveLength(1);
    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBeNull();
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
  });

  it('ignores expired cricket Test quick matches before choosing an app-entry route', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{
      id: 'test-1',
      sport: 'cricket',
      status: 'in-progress',
      updatedAt: '2026-05-30T12:00:00.000Z',
      format: { totalInnings: 4 },
    }]));

    const state = loadAppEntryState();

    expect(loadQuickMatchSummaries()).toHaveLength(0);
    expect(state.returningPlayerState).toBe(false);
    expect(state.draftEntryPath).toBeNull();
    expect(getAppEntryTarget(state)).toBe(PUBLIC_MARKETING_PATH);
  });

  it('ignores expired tennis quick-live drafts before choosing an app-entry route', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem(getTennisQuickDraftKey('match-1'), JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
      updatedAt: '2026-05-30T12:00:00.000Z',
    }));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket' }]));

    const state = loadAppEntryState();

    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBeNull();
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
  });

  it('checks saved tournaments without rewriting storage during app entry', () => {
    const storedTournament = [{ id: 'cup-1', name: 'Office Cup' }];
    globalThis.localStorage.setItem('se_volleyball', JSON.stringify(storedTournament));

    expect(loadReturningPlayerState()).toBe(true);
    expect(JSON.parse(globalThis.localStorage.getItem('se_volleyball'))).toEqual(storedTournament);
  });

  it('ignores malformed tournament storage during app entry', () => {
    globalThis.localStorage.setItem('se_volleyball', JSON.stringify({ id: 'bad-cup' }));

    expect(loadReturningPlayerState()).toBe(false);
  });

  it('keeps corrupt session storage from hiding other returning-player state', () => {
    globalThis.localStorage.setItem('gs_sessions', JSON.stringify({ id: 'bad-session' }));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket' }]));

    expect(loadActiveSessionSummaries()).toEqual([]);
    expect(loadReturningPlayerState()).toBe(true);
  });

  it('does not route legacy history-only users to an empty app dashboard', () => {
    globalThis.localStorage.setItem('gs_history', JSON.stringify([{ id: 'legacy-1' }]));

    expect(loadReturningPlayerState()).toBe(false);
    expect(getAppEntryTarget(loadAppEntryState())).toBe(PUBLIC_MARKETING_PATH);
  });
});
