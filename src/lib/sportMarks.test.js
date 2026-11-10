import { describe, expect, it } from 'vitest';
import { SPORT_MARKS, cutOut, sportMarkMaskUrl } from './sportMarks';
import { getSportById, getSportsList } from '../models/sportRegistry';

// The "show the game" mark on the scorer: a sport's ball-and-action silhouette, used as a CSS
// mask so its colour and alpha come from the colour engine (--team-x-motif) and stay gated.

describe('sportMarkMaskUrl', () => {
  it('only defines marks for registered sports', () => {
    for (const id of Object.keys(SPORT_MARKS)) expect(getSportById(id), id).not.toBeNull();
  });
  it('draws a mark for volleyball as an svg data url safe for any quoting context', () => {
    const url = sportMarkMaskUrl('volleyball');
    expect(url).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(url).not.toMatch(/['<>\s]/);
    expect(decodeURIComponent(url)).toContain('<svg');
  });

  it('cuts the ball seams out of the silhouette (a mask, not a stroke)', () => {
    expect(SPORT_MARKS.volleyball).toContain('<mask');
  });

  it('cuts with the shared luminance mask, so a mark carries no colour literal of its own', () => {
    const mask = cutOut('x', "<path d='M0 0H1'/>", { transform: 'scale(2)', strokeAttrs: "stroke-width='3'" });
    expect(mask).toBe(
      "<defs><mask id='x' maskUnits='userSpaceOnUse' x='0' y='0' width='140' height='100'>"
        + "<rect width='140' height='100' fill='#fff'/>"
        + "<g transform='scale(2)' fill='none' stroke='#000' stroke-width='3'><path d='M0 0H1'/></g></mask></defs>",
    );
    expect(cutOut('y', '')).toContain("<g fill='none' stroke='#000'></g>");
    // Everything a mark adds beyond cutOut() is geometry: no hex or colour function.
    for (const [id, markup] of Object.entries(SPORT_MARKS)) {
      const own = markup.replace(/<defs>[\s\S]*?<\/defs>/g, '');
      expect(own, id).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/i);
    }
  });

  it('draws a mark for every registered sport (tiles and row badges show them)', () => {
    for (const sport of getSportsList()) expect(sportMarkMaskUrl(sport.id), sport.id).toMatch(/^url\("data:/);
  });

  it('cuts filled panels too when asked, with the same two literals', () => {
    expect(cutOut('z', "<circle r='1'/>", { fill: true })).toContain("<g fill='#000' stroke='#000'>");
  });

  it('returns null for ids without a mark, including inherited keys', () => {
    expect(sportMarkMaskUrl('not-a-sport')).toBeNull();
    expect(sportMarkMaskUrl('toString')).toBeNull();
    expect(sportMarkMaskUrl(undefined)).toBeNull();
  });
});
