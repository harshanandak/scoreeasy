import { describe, expect, it } from 'vitest';
import { getGoalsSports, getSetsSports } from '../models/sportRegistry';
import { COURT_MOTIFS, motifMaskUrl } from './courtMotifs';

const decode = (url) => {
  const m = /^url\("data:image\/svg\+xml,(.*)"\)$/.exec(url);
  expect(m).not.toBeNull();
  return decodeURIComponent(m[1]);
};

const parse = (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml');

const SCORED_SPORTS = [...getSetsSports(), ...getGoalsSports()].map((s) => s.id);

describe('court motifs', () => {
  it('covers every sets and goals sport in the registry', () => {
    expect(SCORED_SPORTS.length).toBeGreaterThanOrEqual(12);
    for (const id of SCORED_SPORTS) expect(COURT_MOTIFS[id], id).toBeTruthy();
  });

  it.each(SCORED_SPORTS)('%s: mask url decodes to a well-formed SVG with drawing in it', (id) => {
    for (const half of [undefined, 'a', 'b']) {
      const doc = parse(decode(motifMaskUrl(id, half)));
      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
      const svg = doc.documentElement;
      expect(svg.nodeName).toBe('svg');
      expect(svg.querySelectorAll('path, rect, circle, ellipse').length).toBeGreaterThan(2);
    }
  });

  it('crops to one team half for the point keys', () => {
    const view = (half) => parse(decode(motifMaskUrl('football', half))).documentElement.getAttribute('viewBox');
    expect(view()).toBe('0 0 400 260');
    expect(view('a')).toBe('0 0 200 260');
    expect(view('b')).toBe('200 0 200 260');
  });

  it('returns null for a sport without a drawing', () => {
    expect(motifMaskUrl('cricket')).toBeNull();
    expect(motifMaskUrl('nope')).toBeNull();
    expect(motifMaskUrl('toString')).toBeNull();
  });

  it('escapes both quote characters, so the url survives any quoting context', () => {
    for (const id of SCORED_SPORTS) {
      const body = motifMaskUrl(id).slice('url("'.length, -'")'.length);
      expect(body).not.toMatch(/["']/);
    }
  });
});
