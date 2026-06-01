import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  APP_ENTRY_PATH,
  PUBLIC_MARKETING_PATH,
  getAppEntryTarget,
  hasReturningPlayerState,
  loadReturningPlayerState,
} from './appEntry';

describe('app entry contract', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
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

  it('checks saved tournaments without rewriting storage during app entry', () => {
    const storedTournament = [{ id: 'cup-1', name: 'Office Cup' }];
    globalThis.localStorage.setItem('se_volleyball', JSON.stringify(storedTournament));

    expect(loadReturningPlayerState()).toBe(true);
    expect(JSON.parse(globalThis.localStorage.getItem('se_volleyball'))).toEqual(storedTournament);
  });
});
