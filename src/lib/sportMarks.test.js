import { describe, expect, it } from 'vitest';
import { SPORT_MARKS, sportMarkMaskUrl } from './sportMarks';

// The "show the game" mark on the scorer: a sport's ball-and-action silhouette, used as a CSS
// mask so its colour and alpha come from the colour engine (--team-x-motif) and stay gated.

describe('sportMarkMaskUrl', () => {
  it('draws a mark for volleyball as an svg data url safe for any quoting context', () => {
    const url = sportMarkMaskUrl('volleyball');
    expect(url).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(url).not.toMatch(/['<>\s]/);
    expect(decodeURIComponent(url)).toContain('<svg');
  });

  it('cuts the ball seams out of the silhouette (a mask, not a stroke)', () => {
    expect(SPORT_MARKS.volleyball).toContain('<mask');
  });

  it('returns null for sports without a mark, including inherited keys', () => {
    expect(sportMarkMaskUrl('cricket')).toBeNull();
    expect(sportMarkMaskUrl('toString')).toBeNull();
    expect(sportMarkMaskUrl(undefined)).toBeNull();
  });
});
