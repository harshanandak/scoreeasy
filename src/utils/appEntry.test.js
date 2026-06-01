import { describe, expect, it } from 'vitest';
import {
  APP_ENTRY_PATH,
  PUBLIC_MARKETING_PATH,
  getAppEntryTarget,
  hasReturningPlayerState,
} from './appEntry';

describe('app entry contract', () => {
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
    expect(hasReturningPlayerState({ quickMatches: [{ id: 'match-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ history: [{ id: 'history-1' }] })).toBe(true);
    expect(hasReturningPlayerState({ tournaments: [{ id: 'cup-1' }] })).toBe(true);
    expect(hasReturningPlayerState()).toBe(false);
  });
});
