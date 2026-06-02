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
} from './appEntry';
import { getTennisQuickDraftKey } from './tennisQuickMatch';

describe('app entry contract', () => {
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

  it('keeps generic draft-only app entry on the app dashboard', () => {
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
    }));

    const state = loadAppEntryState();

    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBe('/volleyball/quick');
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
  });

  it('ignores expired generic quick-match drafts before choosing an app-entry route', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
      phase: 'scoring',
      sport: 'volleyball',
      updatedAt: '2026-05-30T12:00:00.000Z',
    }));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1' }]));

    const state = loadAppEntryState();

    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBeNull();
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
  });

  it('detects tennis quick-live drafts without bypassing the app dashboard', () => {
    globalThis.localStorage.setItem(getTennisQuickDraftKey('match-1'), JSON.stringify({
      id: 'match-1',
      sport: 'tennis',
      status: 'in-progress',
    }));

    const state = loadAppEntryState();

    expect(state.returningPlayerState).toBe(true);
    expect(state.draftEntryPath).toBe('/tennis/quick/live/match-1');
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
  });

  it('detects in-progress cricket Test quick matches without bypassing the app dashboard', () => {
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
    expect(getAppEntryTarget(state)).toBe(APP_ENTRY_PATH);
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
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1' }]));

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
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1' }]));

    expect(loadActiveSessionSummaries()).toEqual([]);
    expect(loadReturningPlayerState()).toBe(true);
  });

  it('does not route legacy history-only users to an empty app dashboard', () => {
    globalThis.localStorage.setItem('gs_history', JSON.stringify([{ id: 'legacy-1' }]));

    expect(loadReturningPlayerState()).toBe(false);
    expect(getAppEntryTarget(loadAppEntryState())).toBe(PUBLIC_MARKETING_PATH);
  });
});
