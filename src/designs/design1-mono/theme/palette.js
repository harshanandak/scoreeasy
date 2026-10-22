// Score Easy colour palette: a JS snapshot of the current root CSS values.
//
// This file pins the current values (the Kit roles, plan 2026-10-22 §2: light
// `:root` and `.dark`) exactly as src/index.css declares them; it changes no pixel. palette.test.js fails if
// this file and index.css drift apart, if a documented contrast pair drops
// below its threshold, or if raw colour literals exceed the recorded baseline.
//
// Values still live in index.css (CSS is the source of truth for rendering).
// An approved colour change must update both places in the same diff;
// the drift test keeps them aligned. This snapshot approves no future style.
//
// Production consumers are not rewired by this module.

/**
 * index.css `:root` declarations, copied string-for-string (whitespace is
 * normalised by the drift test). `--se-color-*` aliases keep their `var()`.
 * @type {Readonly<Record<string, string>>}
 */
export const cssDeclarations = Object.freeze({
  // shadcn layer: the values the --se-color-* aliases resolve to (Kit, plan 2026-10-22 §2)
  '--background': '#f4f5f7',
  '--foreground': '#0b0b0d',
  '--card': '#ffffff',
  '--primary': '#00662a',
  '--primary-foreground': 'oklch(1.0000 0 0)',
  '--muted': '#eceef2',
  '--muted-foreground': '#5f6067',
  '--accent': 'oklch(0.9231 0.0773 156.7494)',
  '--accent-foreground': '#004720',
  '--destructive': '#b42318',
  '--border': '#0b0b0d',
  '--chart-5': '#4a4b52',

  // --se-color-* role layer (the intended API)
  '--se-color-action': 'var(--primary)',
  '--se-color-action-hi': '#007c34',
  '--se-color-focus-ring': 'var(--se-color-ink)',
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
  '--se-color-line-soft': 'color-mix(in srgb, var(--se-color-ink) 10%, transparent)',
  '--se-color-inverse': 'var(--primary-foreground)',
  '--se-color-on-ink': '#ffffff',
  '--se-color-live': '#00662a',
  '--se-color-live-soft': '#d9f6dd',
  '--se-color-gold': '#f5b700',
  '--se-color-gold-ink': '#7a5410',
  '--se-color-gold-soft': '#fff1c2',
  '--se-color-on-gold': '#0b0b0d',
  '--se-color-action-on-ink': '#5ee08f',
  '--se-color-warning-on-ink': 'var(--se-color-gold)',
  '--se-color-danger': '#b42318',
  '--se-color-danger-soft': '#fbe9e7',
  '--se-color-warning': 'var(--se-color-gold-ink)',
  '--se-color-warning-soft': 'var(--se-color-gold-soft)',
  '--se-color-scrim': 'rgba(11, 11, 13, 0.45)',
  '--se-color-shadow': 'var(--se-color-ink)',

  // HiFi-blend colours (FROZEN names; BLEND-GOVERNANCE.md)
  '--se-blend-green-wash': '#e7f4ee',
  '--se-blend-green-wash-strong': '#d6ecdf',
  '--se-blend-gold': 'var(--se-color-gold)',
  '--se-blend-gold-bright': '#e8b64c',
});

/**
 * index.css `.dark` declarations (Kit dark, plan 2026-10-22 §2), copied string-for-string.
 * They override cssDeclarations; anything not listed keeps its light value.
 * @type {Readonly<Record<string, string>>}
 */
export const cssDarkDeclarations = Object.freeze({
  '--background': '#0e0f12',
  '--foreground': '#f4f5f7',
  '--card': '#191a1f',
  '--muted': '#25272d',
  '--muted-foreground': '#a2a4ab',
  '--border': '#f4f5f7',
  '--chart-5': '#b9bbc2',
  '--se-color-line-soft': 'color-mix(in srgb, var(--se-color-ink) 12%, transparent)',
  '--se-color-on-ink': '#0b0b0d',
  '--se-color-action-on-ink': '#00662a',
  '--se-color-warning-on-ink': '#7a5410',
  '--se-color-live': '#7ee2a2',
  '--se-color-live-soft': '#123321',
  '--se-color-gold-ink': '#f5c84c',
  '--se-color-gold-soft': '#3a2f0c',
  '--se-color-danger': '#ff8f84',
  '--se-color-danger-soft': '#3a1714',
  '--se-color-scrim': 'rgba(0, 0, 0, 0.6)',
  '--se-color-shadow': '#000000',
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
  onInk: '--se-color-on-ink',
  live: '--se-color-live',
  liveSoft: '--se-color-live-soft',
  gold: '--se-color-gold',
  goldInk: '--se-color-gold-ink',
  goldSoft: '--se-color-gold-soft',
  onGold: '--se-color-on-gold',
  actionOnInk: '--se-color-action-on-ink',
  warningOnInk: '--se-color-warning-on-ink',
  action: '--se-color-action',
  actionHi: '--se-color-action-hi',
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

/** Follow `var(--x)` aliases inside the declarations to a literal value. */
function resolveDeclaration(name, declarations, seen = new Set()) {
  const value = declarations[name];
  if (value === undefined) throw new Error(`palette: ${name} is not pinned`);
  const ref = VAR_REF.exec(value);
  if (!ref) return value;
  if (seen.has(name)) throw new Error(`palette: alias cycle at ${name}`);
  seen.add(name);
  return resolveDeclaration(ref[1], declarations, seen);
}

const resolveRoles = (declarations) => Object.freeze(
  Object.fromEntries(Object.entries(roleTokens).map(([role, token]) => [role, resolveDeclaration(token, declarations)])),
);

/**
 * Role -> resolved literal, exactly as written in index.css (oklch or hex).
 * @type {Readonly<Record<string, string>>}
 */
export const palette = resolveRoles(cssDeclarations);

/**
 * Role -> resolved literal under `.dark` (dark overrides on top of the light declarations).
 * @type {Readonly<Record<string, string>>}
 */
export const paletteDark = resolveRoles({ ...cssDeclarations, ...cssDarkDeclarations });

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

const toHexRoles = (resolved) => Object.freeze(
  Object.fromEntries(Object.entries(resolved).map(([role, value]) => [role, toHex(value)])),
);

/**
 * Role -> sRGB hex, for JS APIs that need a literal.
 * @type {Readonly<Record<string, string>>}
 */
export const paletteHex = toHexRoles(palette);

/**
 * Role -> sRGB hex under `.dark`.
 * @type {Readonly<Record<string, string>>}
 */
export const paletteDarkHex = toHexRoles(paletteDark);

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
