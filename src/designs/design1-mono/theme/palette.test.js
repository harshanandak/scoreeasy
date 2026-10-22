// Guards for the current root CSS colour snapshot.
//   (a) drift    — palette.js mirrors src/index.css string-for-string.
//   (b) contrast — every documented pair meets its threshold, or is an honest,
//                  named known gap that must be updated if its values change.
//   (c) ratchet  — raw colour literals in shipped src/ files match a pinned count.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  cssDarkDeclarations,
  cssDeclarations,
  oklchToHex,
  palette,
  paletteDarkHex,
  paletteHex,
  roleTokens,
  toHex,
} from './palette';

const SRC_DIR = join(import.meta.dirname, '..', '..', '..');
const INDEX_CSS = readFileSync(join(SRC_DIR, 'index.css'), 'utf8');

const normalise = (value) => value.replaceAll(/\s+/g, ' ').trim();

// Declarations of the first top-level `<header> { ... }` block in index.css.
function parseBlockDeclarations(css, header) {
  const found = css.indexOf(`\n${header} {`);
  if (found === -1) throw new Error(`index.css has no ${header} block`);
  const start = found + 1;
  let depth = 0;
  let end = start;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(css.indexOf('{', start) + 1, end).replaceAll(/\/\*[\s\S]*?\*\//g, '');
  const declarations = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declarations[match[1]] = normalise(match[2]);
  }
  return declarations;
}

const rootDeclarations = parseBlockDeclarations(INDEX_CSS, ':root');
const darkDeclarations = parseBlockDeclarations(INDEX_CSS, '.dark');

describe('palette.js mirrors index.css (drift)', () => {
  it.each(Object.entries(cssDeclarations))('%s matches its index.css declaration', (name, value) => {
    expect(rootDeclarations[name], `${name} is not declared in index.css :root`).toBeDefined();
    expect(normalise(value)).toBe(rootDeclarations[name]);
  });

  it('covers every --se-color-* role and every --se-blend-* colour declared in index.css', () => {
    const colourLike = /(#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\()/i;
    const expected = Object.entries(rootDeclarations)
      .filter(([name, value]) => name.startsWith('--se-color-')
        || (name.startsWith('--se-blend-') && colourLike.test(value) && !name.includes('shadow')))
      .map(([name]) => name)
      .sort();
    const pinned = Object.keys(cssDeclarations).filter((name) => expected.includes(name)).sort();
    expect(pinned).toEqual(expected);
  });

  it.each(Object.entries(cssDarkDeclarations))('dark %s matches its index.css .dark declaration', (name, value) => {
    expect(darkDeclarations[name], `${name} is not declared in index.css .dark`).toBeDefined();
    expect(normalise(value)).toBe(darkDeclarations[name]);
  });

  it('pins every dark --se-color-* role and every dark override of a pinned light value', () => {
    const expected = Object.keys(darkDeclarations)
      .filter((name) => name.startsWith('--se-color-') || name in cssDeclarations)
      .sort();
    expect(Object.keys(cssDarkDeclarations).sort()).toEqual(expected);
  });

  it('resolves every role to a literal colour value, never a var()', () => {
    for (const [role, token] of Object.entries(roleTokens)) {
      expect(cssDeclarations[token], `${role} -> ${token}`).toBeDefined();
      expect(palette[role]).not.toMatch(/var\(/);
      expect(paletteHex[role]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('follows each alias to the shadcn variable it points at', () => {
    expect(cssDeclarations['--se-color-action']).toBe('var(--primary)');
    expect(palette.action).toBe(cssDeclarations['--primary']);
    expect(palette.surface).toBe(cssDeclarations['--card']);
    expect(palette.inkSoft).toBe(cssDeclarations['--chart-5']);
  });
});

describe('oklch -> sRGB conversion', () => {
  it('matches reference conversions of the current CSS values', () => {
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000');
    expect(oklchToHex('oklch(1.0000 0 0)')).toBe('#ffffff');
    // The pre-Kit --primary ≈ #16a249 and --se-color-danger ≈ #ac281e.
    expect(oklchToHex('oklch(0.6230 0.1688 149.1777)')).toBe('#16a249');
    expect(oklchToHex('oklch(0.49 0.17 29)')).toBe('#ac281e');
    expect(toHex('#e7f4ee')).toBe('#e7f4ee');
    expect(toHex('#FFF')).toBe('#ffffff');
  });

  it('computes WCAG 2.x contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});

// Kit pairs (plan 2026-10-22 §2). `knownGap` describes a pair below its threshold today;
// the test asserts it STILL fails so a value change must update the entry.
// `themes` defaults to both; a light-only pair names a role the dark block does not
// redefine yet (dark is opt-in and no screen sets it).
const BOTH = ['light', 'dark'];
const LIGHT = ['light'];
const CONTRAST_PAIRS = [
  { fg: 'ink', bg: 'canvas', min: 4.5, use: 'body text on the page' },
  { fg: 'ink', bg: 'surface', min: 4.5, use: 'text on cards, dialogs, sheets' },
  { fg: 'inkSoft', bg: 'canvas', min: 4.5, use: 'secondary text on the page' },
  { fg: 'inkSoft', bg: 'surface', min: 4.5, use: 'body copy, overlines' },
  { fg: 'inkMuted', bg: 'surface', min: 4.5, use: 'meta and placeholder text' },
  { fg: 'inkMuted', bg: 'canvas', min: 4.5, use: 'meta text on the page' },
  { fg: 'inkMuted', bg: 'surfaceWarm', min: 4.5, use: 'meta text in a sunk well' },
  { fg: 'ink', bg: 'actionSoft', min: 4.5, use: 'ink on the green wash', themes: LIGHT },
  { fg: 'inverse', bg: 'action', min: 4.5, use: 'Go label on the core stop' },
  { fg: 'inverse', bg: 'actionHi', min: 4.5, use: 'Go label on the lightest stop' },
  { fg: 'inverse', bg: 'actionStrong', min: 4.5, use: 'Go label on the deepest stop' },
  { fg: 'action', bg: 'canvas', min: 4.5, use: 'green text on the page', themes: LIGHT },
  { fg: 'onInk', bg: 'ink', min: 4.5, use: 'label on an ink fill' },
  { fg: 'actionOnInk', bg: 'ink', min: 4.5, use: 'green text on an ink banner or hero card' },
  { fg: 'warningOnInk', bg: 'ink', min: 4.5, use: 'paused / warning text on an ink card' },
  { fg: 'action', bg: 'ink', min: 4.5, use: 'Go green is a fill, never text on ink: use actionOnInk', knownGap: 'Go green as text on ink is 2.75:1 by design', themes: LIGHT },
  { fg: 'live', bg: 'liveSoft', min: 4.5, use: 'the Live chip' },
  { fg: 'onGold', bg: 'gold', min: 4.5, use: 'ink text on the gold fill' },
  { fg: 'goldInk', bg: 'goldSoft', min: 4.5, use: 'warning / offline banner text' },
  { fg: 'goldInk', bg: 'surface', min: 4.5, use: 'gold-ink text on a card' },
  { fg: 'danger', bg: 'surface', min: 4.5, use: 'danger text' },
  { fg: 'danger', bg: 'dangerSoft', min: 4.5, use: 'error notice text' },
  { fg: 'onInk', bg: 'danger', min: 4.5, use: 'label on the destructive fill' },
  { fg: 'warning', bg: 'surface', min: 4.5, use: 'warning text' },
  { fg: 'warning', bg: 'warningSoft', min: 4.5, use: 'warning notice text' },
  { fg: 'focusRing', bg: 'canvas', min: 3, use: 'focus ring on the page (non-text, 1.4.11)' },
  { fg: 'focusRing', bg: 'surface', min: 3, use: 'focus ring on a card or sheet (non-text, 1.4.11)' },
  { fg: 'surface', bg: 'canvas', min: 1.1, use: 'card separates from page', knownGap: 'cards separate by hairline and lift, not fill (§2)', themes: LIGHT },
];

const THEMES = { light: paletteHex, dark: paletteDarkHex };
const casesFor = (pairs) => pairs.flatMap((pair) => (pair.themes ?? BOTH)
  .map((theme) => ({ ...pair, theme, ratio: contrastRatio(THEMES[theme][pair.fg], THEMES[theme][pair.bg]) })));

describe('documented contrast pairs', () => {
  it.each(casesFor(CONTRAST_PAIRS.filter((pair) => !pair.knownGap)))(
    '$theme: $fg on $bg >= $min ($use)',
    ({ ratio, min }) => {
      expect(ratio).toBeGreaterThanOrEqual(min);
    },
  );

  it.each(casesFor(CONTRAST_PAIRS.filter((pair) => pair.knownGap)))(
    '$theme: $fg on $bg is a known gap: $knownGap',
    ({ ratio, min }) => {
      // If this fails, the value got fixed: remove `knownGap` from the entry.
      expect(ratio).toBeLessThan(min);
    },
  );

  it('the focus ring is ink in both themes', () => {
    expect(paletteHex.focusRing).toBe(paletteHex.ink);
    expect(paletteDarkHex.focusRing).toBe(paletteDarkHex.ink);
  });
});

// ---------------------------------------------------------------------------
// (c) Raw colour literal ratchet.
//
// Counted: every occurrence of a hex colour (#rgb, #rgba, #rrggbb, #rrggbbaa)
// or a colour function call (rgb( rgba( hsl( hsla( oklch( ) in shipped
// src/ files (.js .jsx .css), INCLUDING literals inside custom-property
// definitions outside index.css. Not counted: comments (stripped first),
// `&#9679;`-style HTML entities, hex runs glued to word characters, and named
// colours (`white`, `black`, ...).
//
// Excluded:
//   - tests (*.test.*, *.spec.*) and src/test/ setup;
//   - token definitions: src/index.css, theme/palette.js, theme/sportsTokens.js,
//     clerkTheme.js; dynamic colour engine: src/lib/teamColour.js;
//   - dev-only showcases and dead code, listed below.
//
// Counts above or below BASELINE fail: use tokens for new colours and lower
// the baseline when removing literals.
// At 0 the ratchet becomes a ban.
// ---------------------------------------------------------------------------
// Baseline measured on master 4ed7ad8: 667, up from the old 651 by
// TeamColourPicker.jsx (+12) and lib/courtMotifs.js (+4).
// 669 on feat/team-colour-volleyball (PR #157): lib/sportMarks.js (+2), the white/black
// luminance <mask> inside its data-URI SVG, where CSS variables cannot reach.
// Removing the unused court hatch helper drops one raw literal: 669 -> 668.
// Kit F0 (plan 2026-10-22): the confirm dialogs and sheet move onto tokens, 668 -> 662.
// ConfirmActionPanel drops its four inline reds (-4); the dialog CSS that left index.jsx's
// inline <style> (-1) and the sheet backdrop in mono.css (-1) each lose an rgba() scrim to
// --se-color-scrim. New marks add 0: their mask literals live once in sportMarks.js cutOut().
// Kit S1 (Home + Play hub), 662 -> 653: Home drops its #999/#333/#444 ink-card greys and three
// #dc2626 "live" dots (-6); the Guided wizard (NewUserFlow.jsx, only the old Play hub reached it)
// goes with its #fff/#aaa literals and two rgba() (-12); the registry gains the nine sport
// identity sources (+9), which the engine gates before anything is painted. The eight new tile
// marks add 0 (cutOut()).
// Kit S3 (Finish), 653 -> 651: the quick-match result drops its set breakdown's two #666 greys.
// The winner card, loser row and set chips take only tokens and teamColour.js engine output; the
// hand-drawn confetti, trophy and circle paint in currentColor and --se-color-gold (+0).
// Kit S2 (Quick setup), 651 -> 638: the setup screen drops its twelve greys, whites and rgba()
// shadows (#aaa, #333, #fff x2, #eee x3, #f5f5f5 x2, #dbeafe, two rgba()) for tokens (-12), and
// TeamColourPicker loses the #000000 custom-input fallback (-1). Its eleven kit source colours stay;
// swatches paint engine output (deriveIdentityColour), and the setup's hand-drawn "v" is ink (+0).
// Kit S4 (History + Profile), 638 -> 601: Profile drops its #888 x18, #bbb x3, #111 x8, #666 and
// #eee greys (-31) and History its six #111 inks (-6). The month bar, legend, chips, ring and row
// badges paint sportIdentity engine output; the empty-history scorebook is ink (+0).
const BASELINE = 601;

const EXCLUDED_FILES = new Set([
  // Token definitions
  'index.css',
  'designs/design1-mono/theme/palette.js',
  'designs/design1-mono/theme/sportsTokens.js',
  'designs/design1-mono/clerkTheme.js',
  // Dynamic colour engine (not a static palette consumer)
  'lib/teamColour.js',
  // Internal showcases (dev-only routes)
  'designs/design1-mono/MonoSetDisplayShowcase.jsx',
  'designs/design1-mono/MonoMatchCardShowcase.jsx',
  'designs/design1-mono/landing-designs/BrutalistColorShowcase.jsx',
  'designs/design1-mono/landing-designs/LandingDesignA.jsx',
  'designs/design1-mono/landing/DashboardShowcase.jsx',
  // Unused legacy screens
  'designs/design1-mono/landing-designs/BrutalistBlueVariants.jsx',
  'designs/design1-mono/MonoSportHome_TABBED.jsx',
  'designs/design1-mono/MonoHome.jsx',
  'designs/design1-mono/MonoSetup.jsx',
  'designs/design1-mono/MonoLiveGame.jsx',
]);

const COLOUR_LITERAL = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch)\(/gi;

// Comments are stripped first: `#108`-style issue refs and colours quoted in
// prose are not shipped colour. Line comments skip `://` so URLs survive.
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(?<!:)\/\/.*$/gm;

function countColourLiterals(source) {
  const code = source.replaceAll(BLOCK_COMMENT, '').replaceAll(LINE_COMMENT, '');
  return code.match(COLOUR_LITERAL)?.length ?? 0;
}

function listShippedFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listShippedFiles(full));
      continue;
    }
    const rel = relative(SRC_DIR, full).split(sep).join('/');
    if (!/\.(?:js|jsx|css)$/.test(rel)) continue;
    if (/\.(?:test|spec)\./.test(rel) || rel.startsWith('test/')) continue;
    if (EXCLUDED_FILES.has(rel)) continue;
    files.push(rel);
  }
  return files;
}

describe('raw colour literal ratchet', () => {
  it('counts hex and colour functions, not entities or ids', () => {
    expect(countColourLiterals('color: #fff; background: #0066ff;')).toBe(2);
    expect(countColourLiterals('rgba(0, 0, 0, 0.28) hsl(0 0% 0%) oklch(0.5 0 0) rgb(1,2,3)')).toBe(4);
    expect(countColourLiterals('&#9679; #root #c0ffee80 #abcd')).toBe(2);
    expect(countColourLiterals('color-mix(in oklch, var(--x) 20%, transparent)')).toBe(0);
    expect(countColourLiterals('// fixes #108 and #fff\n/* #000 */ a { color: #111; } // #222')).toBe(1);
    expect(countColourLiterals("const u = 'https://x.y/#abc'; // note #ccc")).toBe(1);
  });

  it('every excluded file still exists (keep the list honest)', () => {
    for (const rel of EXCLUDED_FILES) {
      expect(() => statSync(join(SRC_DIR, rel)), rel).not.toThrow();
    }
  });

  it(`raw colour literals in shipped files match the baseline (${BASELINE})`, () => {
    const perFile = listShippedFiles(SRC_DIR)
      .map((rel) => [rel, countColourLiterals(readFileSync(join(SRC_DIR, rel), 'utf8'))])
      .filter(([, count]) => count > 0);
    const total = perFile.reduce((sum, [, count]) => sum + count, 0);

    const message = total > BASELINE
      ? `Raw colour literals rose to ${total}, use var(--se-color-*) (baseline ${BASELINE}).`
      : `Raw colour literals fell to ${total}, lower BASELINE to ${total}.`;
    expect(
      total,
      `${message}\n`
        + perFile.sort((a, b) => b[1] - a[1]).map(([rel, count]) => `  ${count}\t${rel}`).join('\n'),
    ).toBe(BASELINE);
  });
});
