// Score Easy colour palette: the one JS home for colour values.
//
// Colour audit 2026-10-21 (docs/plans/2026-10-21-colour-system-audit.md),
// §6.5 "JS" row and migration PR 1. This file pins TODAY's values exactly as
// src/index.css declares them; it changes no pixel. palette.test.js fails if
// this file and index.css drift apart, if a documented contrast pair drops
// below its threshold, or if raw colour literals in shipped files go up.
//
// Values still live in index.css (CSS is the source of truth for rendering).
// When a value PR changes a colour (PR 3 green, PR 4 canvas, ...), it changes
// both places in the same diff and the drift test keeps them honest.
//
// Consumers that need a literal (Clerk appearance, Capacitor status bar, the
// team-colour engine NEUTRAL, confetti) move onto this module in later PRs.

/**
 * index.css `:root` declarations, copied string-for-string (whitespace is
 * normalised by the drift test). `--se-color-*` aliases keep their `var()`.
 * @type {Readonly<Record<string, string>>}
 */
export const cssDeclarations = Object.freeze({
  // shadcn layer: the values the --se-color-* aliases resolve to today
  '--background': 'oklch(0.9782 0.0039 145.5458)',
  '--foreground': 'oklch(0 0 0)',
  '--card': 'oklch(0.9855 0.0026 145.5558)',
  '--primary': 'oklch(0.6230 0.1688 149.1777)',
  '--primary-foreground': 'oklch(1.0000 0 0)',
  '--muted': 'oklch(0.9398 0.0035 145.5478)',
  '--muted-foreground': 'oklch(0.5103 0 0)',
  '--accent': 'oklch(0.9231 0.0773 156.7494)',
  '--accent-foreground': 'oklch(0.4104 0.1066 149.9393)',
  '--destructive': 'oklch(0.5308 0.2178 29.2339)',
  '--border': 'oklch(0 0 0)',
  '--chart-5': 'oklch(0.3211 0 0)',

  // --se-color-* role layer (the intended API)
  '--se-color-action': 'var(--primary)',
  '--se-color-focus-ring': 'oklch(0.58 0.22 255)',
  '--se-color-action-soft': 'var(--accent)',
  '--se-color-action-strong': 'var(--accent-foreground)',
  '--se-color-canvas': 'var(--background)',
  '--se-color-surface': 'var(--card)',
  '--se-color-surface-warm': 'var(--muted)',
  '--se-color-ink': 'var(--foreground)',
  '--se-color-ink-strong': 'var(--foreground)',
  '--se-color-ink-soft': 'var(--chart-5)',
  '--se-color-ink-muted': 'var(--muted-foreground)',
  '--se-color-ink-faint': 'var(--muted-foreground)',
  '--se-color-line': 'var(--border)',
  '--se-color-line-strong': 'var(--border)',
  '--se-color-inverse': 'var(--primary-foreground)',
  '--se-color-danger': 'oklch(0.49 0.17 29)',
  '--se-color-danger-soft': 'oklch(0.96 0.04 29)',
  '--se-color-warning': 'oklch(0.54 0.12 78)',
  '--se-color-warning-soft': 'oklch(0.96 0.05 86)',

  // HiFi-blend colours (FROZEN names; BLEND-GOVERNANCE.md)
  '--se-blend-green-wash': '#e7f4ee',
  '--se-blend-green-wash-strong': '#d6ecdf',
  '--se-blend-gold': '#b8862e',
  '--se-blend-gold-bright': '#e8b64c',
});

/**
 * Role name -> the CSS custom property that carries it.
 * @type {Readonly<Record<string, string>>}
 */
export const roleTokens = Object.freeze({
  canvas: '--se-color-canvas',
  surface: '--se-color-surface',
  surfaceWarm: '--se-color-surface-warm',
  ink: '--se-color-ink',
  inkStrong: '--se-color-ink-strong',
  inkSoft: '--se-color-ink-soft',
  inkMuted: '--se-color-ink-muted',
  inkFaint: '--se-color-ink-faint',
  line: '--se-color-line',
  lineStrong: '--se-color-line-strong',
  inverse: '--se-color-inverse',
  action: '--se-color-action',
  actionStrong: '--se-color-action-strong',
  actionSoft: '--se-color-action-soft',
  danger: '--se-color-danger',
  dangerSoft: '--se-color-danger-soft',
  destructive: '--destructive',
  warning: '--se-color-warning',
  warningSoft: '--se-color-warning-soft',
  focusRing: '--se-color-focus-ring',
  blendGreenWash: '--se-blend-green-wash',
  blendGreenWashStrong: '--se-blend-green-wash-strong',
  blendGold: '--se-blend-gold',
  blendGoldBright: '--se-blend-gold-bright',
});

const VAR_REF = /^var\((--[\w-]+)\)$/;

/** Follow `var(--x)` aliases inside cssDeclarations to a literal value. */
function resolveDeclaration(name, seen = new Set()) {
  const value = cssDeclarations[name];
  if (value === undefined) throw new Error(`palette: ${name} is not pinned`);
  const ref = VAR_REF.exec(value);
  if (!ref) return value;
  if (seen.has(name)) throw new Error(`palette: alias cycle at ${name}`);
  seen.add(name);
  return resolveDeclaration(ref[1], seen);
}

/**
 * Role -> resolved literal, exactly as written in index.css (oklch or hex).
 * @type {Readonly<Record<string, string>>}
 */
export const palette = Object.freeze(
  Object.fromEntries(Object.entries(roleTokens).map(([role, token]) => [role, resolveDeclaration(token)])),
);

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const encodeSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hexByte = (c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0');

/**
 * Convert a CSS `oklch(L C H)` string (L as 0-1 or %, alpha ignored) to sRGB
 * hex, gamut-clipped. Matrices from Björn Ottosson's OKLab definition.
 * @param {string} value
 * @returns {string}
 */
export function oklchToHex(value) {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(value.trim());
  if (!match) throw new Error(`palette: not an oklch() colour: ${value}`);
  const L = Number(match[1]) / (match[2] ? 100 : 1);
  const C = Number(match[3]);
  const h = (Number(match[4]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return `#${hexByte(encodeSrgb(r))}${hexByte(encodeSrgb(g))}${hexByte(encodeSrgb(bl))}`;
}

/**
 * Normalise a hex or oklch() colour to lowercase `#rrggbb`.
 * @param {string} value
 * @returns {string}
 */
export function toHex(value) {
  const v = value.trim().toLowerCase();
  if (v.startsWith('oklch(')) return oklchToHex(v);
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  throw new Error(`palette: unsupported colour literal: ${value}`);
}

/**
 * Role -> sRGB hex, for JS APIs that need a literal.
 * @type {Readonly<Record<string, string>>}
 */
export const paletteHex = Object.freeze(
  Object.fromEntries(Object.entries(palette).map(([role, value]) => [role, toHex(value)])),
);

const channel = (byte) => {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function relativeLuminance(hex) {
  const v = toHex(hex);
  const [r, g, b] = [1, 3, 5].map((i) => channel(Number.parseInt(v.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.x contrast ratio between two colours (hex or oklch()).
 * @param {string} fg
 * @param {string} bg
 * @returns {number}
 */
export function contrastRatio(fg, bg) {
  const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
