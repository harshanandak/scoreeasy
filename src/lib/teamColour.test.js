import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEAM_COLOURS,
  NEUTRAL,
  PRESETS,
  contrast,
  contrastReport,
  deltaE,
  deriveTeamColours,
  normaliseHex,
  oklch,
  teamColourVars,
} from './teamColour';
import { paletteHex } from '../designs/design1-mono/theme/palette';

const failing = (derived) => contrastReport(derived).filter(([, ratio, min]) => ratio < min);

const hueGap = (x, y) => {
  const d = Math.abs(oklch(x).h - oklch(y).h) % 360;
  return d > 180 ? 360 - d : d;
};

describe('NEUTRAL (engine lockstep with the tokens)', () => {
  it('gates lines and tints against the live canvas, surface and ink values', () => {
    expect(NEUTRAL).toEqual({ bg: paletteHex.canvas, surface: paletteHex.surface, ink: paletteHex.ink });
  });
});

describe('normaliseHex', () => {
  it('accepts #rgb and #rrggbb, with or without the hash, and lower-cases', () => {
    expect(normaliseHex('#D62828')).toBe('#d62828');
    expect(normaliseHex('1d4ed8')).toBe('#1d4ed8');
    expect(normaliseHex('#fff')).toBe('#ffffff');
    expect(normaliseHex('  #abc  ')).toBe('#aabbcc');
  });

  it('rejects anything that is not a plain hex colour', () => {
    for (const bad of ['red;background:url(x)', 'url(//x)', '#12345', '#1234567', 'red', '', null, undefined, 42, {}]) {
      expect(normaliseHex(bad)).toBeNull();
    }
  });
});

describe('deriveTeamColours', () => {
  it('gives red v blue deep fills with white text that clears every gate', () => {
    const d = deriveTeamColours('#d62828', '#1d4ed8');
    expect(d.A.band).toBe('deep');
    expect(d.B.band).toBe('deep');
    expect(d.A.on).toBe('#ffffff');
    expect(d.B.on).toBe('#ffffff');
    expect(failing(d)).toEqual([]);
  });

  it('returns every token the stylesheet needs, for both teams', () => {
    const d = deriveTeamColours('#d62828', '#1d4ed8');
    for (const t of [d.A, d.B]) {
      for (const key of ['hi', 'core', 'lo', 'on', 'tint', 'line', 'motifCol']) {
        expect(normaliseHex(t[key])).toBe(t[key]);
      }
      expect(['deep', 'bright']).toContain(t.band);
      expect(t.scrimA).toBeGreaterThanOrEqual(0);
      expect(t.scrimA).toBeLessThanOrEqual(0.6);
      expect(t.motifA).toBeGreaterThan(0);
    }
  });

  it.each(Object.entries(PRESETS))('%s passes every contrast gate', (_name, [a, b]) => {
    expect(failing(deriveTeamColours(a, b))).toEqual([]);
  });

  it.each([
    ['black v black', '#000000', '#000000'],
    ['white v yellow', '#ffffff', '#ffff00'],
    ['neon green v magenta', '#39ff14', '#ff00ff'],
    ['white v white', '#ffffff', '#ffffff'],
    ['yellow v yellow', '#facc15', '#facc15'],
  ])('extreme pair %s passes every contrast gate', (_name, a, b) => {
    expect(failing(deriveTeamColours(a, b))).toEqual([]);
  });

  it('splits near-identical colours apart by lightness and keeps each hue', () => {
    const d = deriveTeamColours('#e11d2a', '#e11d2b');
    expect(d.note).toMatch(/clash/);
    expect(deltaE(d.A.core, d.B.core)).toBeGreaterThanOrEqual(0.15);
    expect(hueGap(d.A.core, '#e11d2a')).toBeLessThanOrEqual(10);
    expect(hueGap(d.B.core, '#e11d2b')).toBeLessThanOrEqual(10);
  });

  it.each([
    ['yellow v yellow', '#facc15', '#facc15'],
    ['white v white', '#ffffff', '#ffffff'],
    ['white v off-white', '#ffffff', '#f4f4f5'],
    ['sky v sky', '#38bdf8', '#38bdf8'],
    ['orange v orange', '#f97316', '#f97316'],
    ['neon v neon', '#39ff14', '#39ff14'],
    ['black v black', '#000000', '#000000'],
    ['blue v blue', '#1d4ed8', '#1d4ed8'],
    ['maroon v maroon', '#7a1020', '#7a1020'],
  ])('keeps %s distinguishable (dE >= 0.15) and every gate green', (_name, a, b) => {
    const d = deriveTeamColours(a, b);
    expect(deltaE(d.A.core, d.B.core)).toBeGreaterThanOrEqual(0.15);
    expect(failing(d)).toEqual([]);
  });

  it('keeps two distinct colours as they are (no clash note)', () => {
    expect(deriveTeamColours('#d62828', '#1d4ed8').note).toBe('');
  });

  it('falls back to the default pair on invalid input and never throws', () => {
    const fallback = deriveTeamColours(DEFAULT_TEAM_COLOURS.a, DEFAULT_TEAM_COLOURS.b);
    expect(deriveTeamColours('nope', null)).toEqual(fallback);
    expect(deriveTeamColours('red;background:url(x)', undefined)).toEqual(fallback);
    expect(deriveTeamColours('#facc15', 'not-a-colour').B).toEqual(fallback.B);
  });
});

describe('teamColourVars', () => {
  it('maps both teams onto --team-* custom properties', () => {
    const d = deriveTeamColours('#d62828', '#1d4ed8');
    const vars = teamColourVars(d);
    expect(vars['--team-a-core']).toBe(d.A.core);
    expect(vars['--team-b-core']).toBe(d.B.core);
    for (const side of ['a', 'b']) {
      for (const key of ['hi', 'core', 'lo', 'on', 'tint', 'line']) {
        expect(normaliseHex(vars[`--team-${side}-${key}`])).not.toBeNull();
      }
      expect(vars[`--team-${side}-scrim`]).toMatch(/^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0\.\d+)\)$/);
      expect(vars[`--team-${side}-motif`]).toMatch(/^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0\.\d+)\)$/);
    }
  });

  it('only ever emits engine-computed values, never the raw input', () => {
    const vars = teamColourVars(deriveTeamColours('red;background:url(//x)', '#1d4ed8'));
    expect(Object.values(vars).join(' ')).not.toMatch(/url|;/);
  });
});

describe('contrast', () => {
  it('matches the WCAG ratio for black on white', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });
});
