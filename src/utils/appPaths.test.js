import { describe, expect, it } from 'vitest';
import { PLAY_HUB_PATH, quickMatchPath } from './appPaths';
import { DEFAULT_GUEST_SCORING_PATH } from './authRedirect';

describe('app paths', () => {
  it('starts every generic "new match" at the Play hub, where the scorer picks a game', () => {
    expect(PLAY_HUB_PATH).toBe('/play');
    expect(DEFAULT_GUEST_SCORING_PATH).toBe(PLAY_HUB_PATH);
  });

  it('builds a sport quick-match path', () => {
    expect(quickMatchPath('kabaddi')).toBe('/kabaddi/quick');
    expect(quickMatchPath('volleyball')).toBe('/volleyball/quick');
  });
});
