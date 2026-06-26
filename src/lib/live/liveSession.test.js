import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSession,
  saveSession,
  clearSession,
  sessionKey,
  getConsent,
  setConsent,
  hasSeenConsent,
} from './liveSession';

beforeEach(() => {
  localStorage.clear();
});

describe('liveSession — broadcast session persistence', () => {
  it('round-trips a session keyed by clientMatchId', () => {
    saveSession('cm1', { matchId: 'mid1', token: 'TOK', seq: 3 });
    expect(loadSession('cm1')).toEqual({ matchId: 'mid1', token: 'TOK', seq: 3 });
    // Distinct matches do not collide.
    expect(loadSession('cm2')).toBeNull();
    expect(sessionKey('cm1')).toBe('se_live_session:cm1');
  });

  it('returns null for an unknown or empty match id', () => {
    expect(loadSession('nope')).toBeNull();
    expect(loadSession('')).toBeNull();
    expect(saveSession('', { matchId: 'x' })).toBe(false);
  });

  it('clearSession forgets a session', () => {
    saveSession('cm1', { matchId: 'mid1', token: 'TOK', seq: 1 });
    clearSession('cm1');
    expect(loadSession('cm1')).toBeNull();
  });
});

describe('liveSession — one-time public consent (b0z)', () => {
  it('starts unseen, then records accepted/declined', () => {
    expect(getConsent()).toBeNull();
    expect(hasSeenConsent()).toBe(false);

    setConsent('accepted');
    expect(getConsent()).toBe('accepted');
    expect(hasSeenConsent()).toBe(true);

    setConsent('declined');
    expect(getConsent()).toBe('declined');
    expect(hasSeenConsent()).toBe(true);
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('garbage'));
    expect(getConsent()).toBeNull();
  });
});
