import { describe, expect, it } from 'vitest';
import { isProtectedScoringRoute } from './backButton';

describe('isProtectedScoringRoute', () => {
  it('matches tournament scoring routes', () => {
    expect(isProtectedScoringRoute('/volleyball/tournament/123/match/abc/score')).toBe(true);
  });

  it('matches quick match routes', () => {
    expect(isProtectedScoringRoute('/volleyball/quick')).toBe(true);
  });

  it('does not match normal navigation routes', () => {
    expect(isProtectedScoringRoute('/play')).toBe(false);
    expect(isProtectedScoringRoute('/history')).toBe(false);
  });
});
