// Team colour engine (Direction E): any team hex -> bold, blended, contrast-gated tokens.
//
// Ported from the approved mockup
// (docs/plans/2026-07-26-icp-games-design/directions/e-broadcast/volleyball.html,
// "Colour engine"), light theme only. Colours are normalised in OKLCH so that
// whatever a scorer picks (yellow v white, black v black, neon), label text on
// the team fill clears 4.5:1 and the score numeral clears 7.5:1 on its scrim.
// Pure functions, no DOM. Only engine-computed values ever leave this module,
// so a scorer-typed string can never reach a `style` attribute (OWASP A03).

export const DEFAULT_TEAM_COLOURS = Object.freeze({ a: '#d62828', b: '#1d4ed8' });

export const PRESETS = Object.freeze({
  'Red v Blue': ['#d62828', '#1d4ed8'],
  'Red v Maroon': ['#e11d2a', '#7a1020'],
  'Yellow v White': ['#facc15', '#ffffff'],
  'Black v Green': ['#111111', '#16a34a'],
  'Purple v Orange': ['#6d28d9', '#f97316'],
  'Sky v Navy': ['#38bdf8', '#1e2a5a'],
});

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * @param {unknown} input
 * @returns {string | null} '#rrggbb' (lower case) or null when input is not a plain hex colour
 */
export function normaliseHex(input) {
  if (typeof input !== 'string') return null;
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

// --- colour maths: sRGB <-> OKLab/OKLCH, WCAG 2.x luminance ---------------------------

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hexToRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const rgbToHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

function toLab(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labToLin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const lab = (L, C, h) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
const inGamut = (lin) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** @returns {{L: number, C: number, h: number}} OKLCH of a '#rrggbb' colour */
export function oklch(hex) {
  const [L, a, b] = toLab(hex);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, b), h };
}

// OKLCH -> hex, reducing chroma (never hue) until the colour fits in sRGB.
function fromOklch({ L, C, h }) {
  L = Math.min(0.995, Math.max(0.05, L));
  if (!inGamut(labToLin(lab(L, C, h)))) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(labToLin(lab(L, mid, h)))) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  return rgbToHex(labToLin(lab(L, C, h)).map((v) => toGam(Math.min(1, Math.max(0, v)))));
}

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x contrast ratio between two '#rrggbb' colours. */
export function contrast(x, y) {
  const a = luminance(x);
  const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Euclidean distance in OKLab (0.15 ~ clearly different at a glance). */
export function deltaE(x, y) {
  const p = toLab(x);
  const q = toLab(y);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// `top` composited over `base` at alpha `al`.
const over = (base, top, al) => {
  const B = hexToRgb(base);
  const T = hexToRgb(top);
  return rgbToHex(B.map((v, i) => v * (1 - al) + T[i] * al));
};

// --- the engine -----------------------------------------------------------------------

// Light neutrals: the literal values of --background, --card and --foreground in src/index.css
// (the Kit canvas, surface and ink; teamColour.test.js pins them to palette.js).
export const NEUTRAL = Object.freeze({
  bg: '#f4f5f7',
  surface: '#ffffff',
  ink: '#0b0b0d',
});

const WHITE = '#ffffff';
const INK = '#0b0b0d';
const SHEEN = 0.07; // the white highlight the key gradient adds at its top
const TXT = 4.6; // label gate on a deep fill (0.1 head-room over 4.5)
const TXT_BRIGHT = 6.5; // dark text on a bright fill gets more, bright fills wash out in sun
const NUM = 8; // numeral-on-scrim target (gate is 7.5)
const CLASH = 0.15;

// Court-drawing line. Deep fills: white chalk where the fill has head-room, else a black
// engraving (which can only raise white-text contrast). Bright fills: ink. All gated in contrastReport.
const MOTIF = { chalk: { col: WHITE, a: 0.1 }, deep: { col: '#000000', a: 0.17 }, bright: { col: INK, a: 0.11 } };

const sheen = (hi) => over(hi, WHITE, SHEEN);

function motifFor(S, band) {
  if (band !== 'deep') return MOTIF.bright;
  const worst = Math.min(...[S.hi, S.core, S.lo, sheen(S.hi)].map((x) => contrast(WHITE, over(x, WHITE, MOTIF.chalk.a))));
  return worst >= 5.5 ? MOTIF.chalk : MOTIF.deep;
}

// 1. Bright colours (yellow, white, sky, orange) stay bright and take dark text;
//    everything else becomes a rich deep colour that takes white text.
const bandOf = (c) => (c.L >= 0.72 || (c.h >= 45 && c.h <= 125 && c.L >= 0.62 && c.C >= 0.08) ? 'bright' : 'deep');

// 2. hi/core/lo gradient stops for one team at core lightness L.
function stops(c, L, band) {
  const C = c.C < 0.035 ? 0 : Math.max(0.09, Math.min(c.C, band === 'deep' ? 0.205 : 0.19));
  const hiL = band === 'deep' ? L + 0.065 : Math.min(0.975, L + 0.045);
  const loL = band === 'deep' ? Math.max(0.17, L - 0.1) : L - 0.05;
  return {
    core: fromOklch({ L, C, h: c.h }),
    hi: fromOklch({ L: hiL, C, h: c.h }),
    lo: fromOklch({ L: loL, C: C * 0.94, h: c.h + 3 }),
  };
}

function passes(S, band) {
  const on = band === 'deep' ? WHITE : INK;
  const min = Math.min(...[S.hi, S.core, S.lo, sheen(S.hi)].map((x) => contrast(on, x)));
  return min >= (band === 'deep' ? TXT : TXT_BRIGHT);
}

// 3. Walk lightness in OKLCH until the on-colour clears the gate on every stop (incl. sheen),
//    then solve the smallest numeral scrim that clears 8:1 (with a motif line underneath).
function normalise(src, forceL, forceBand) {
  const c = oklch(src);
  const band = forceBand ?? bandOf(c);
  let L;
  if (band === 'deep') {
    L = forceL ?? Math.max(0.34, Math.min(c.L, 0.66));
    while (L > 0.2 && !passes(stops(c, L, band), band)) L -= 0.005;
  } else {
    L = forceL ?? Math.min(0.93, Math.max(c.L, 0.66));
    if (c.C < 0.035) L = Math.min(L, 0.9);
    while (L < 0.97 && !passes(stops(c, L, band), band)) L += 0.005;
  }
  const S = stops(c, L, band);
  const on = band === 'deep' ? WHITE : INK;
  const veil = band === 'deep' ? '#000000' : '#ffffff';
  const worst = band === 'deep' ? sheen(S.hi) : S.lo;
  const mo = motifFor(S, band);
  const cands = [worst, over(worst, mo.col, mo.a)];
  const lowest = (al) =>
    cands.map((x) => over(x, veil, al)).reduce((p, x) => (contrast(on, x) < contrast(on, p) ? x : p));
  let al = 0;
  while (al < 0.6 && contrast(on, lowest(al)) < NUM) al += 0.01;
  return {
    src,
    c,
    band,
    L,
    ...S,
    on,
    veil,
    scrimA: +al.toFixed(2),
    numSurf: lowest(al),
    motifCol: mo.col,
    motifA: mo.a,
  };
}

// 4. Soft chip tint + a line colour that reads on the light page (>= 3.2:1).
function accents(t) {
  const { c } = t;
  const C = c.C < 0.035 ? 0 : Math.min(c.C, 0.17);
  const tint = fromOklch({ L: 0.945, C: Math.min(C, 0.045), h: c.h });
  const ok = (x) => contrast(x, NEUTRAL.bg) >= 3.2 && contrast(x, NEUTRAL.surface) >= 3.2;
  let Ll = Math.min(0.72, Math.max(c.L, 0.4));
  while (!ok(fromOklch({ L: Ll, C, h: c.h })) && Ll > 0.2) Ll -= 0.01;
  return { tint, line: fromOklch({ L: Ll, C, h: c.h }) };
}

/**
 * Derive both teams' tokens. Invalid input falls back to that team's default; never throws.
 * @param {unknown} aInput team A colour
 * @param {unknown} bInput team B colour
 * @returns {{A: object, B: object, note: string}} each team:
 *   hi, core, lo, on, veil, scrimA, numSurf, tint, line, motifCol, motifA, band
 */
export function deriveTeamColours(aInput, bInput) {
  const aHex = normaliseHex(aInput) ?? DEFAULT_TEAM_COLOURS.a;
  const bHex = normaliseHex(bInput) ?? DEFAULT_TEAM_COLOURS.b;
  let A = normalise(aHex);
  let B = normalise(bHex);
  const before = deltaE(A.core, B.core);
  let note = '';

  // 5. Clash: too close -> spread lightness apart. Hue is kept, so each team keeps its identity.
  if (before < CLASH) {
    const darkFirst = A.L <= B.L;
    const D = darkFirst ? A : B;
    const Lt = darkFirst ? B : A;
    let nD;
    let nL = Lt;
    if (D.band === 'deep' && Lt.band === 'deep') {
      nD = normalise(D.src, 0.31);
      nL = normalise(Lt.src, Math.max(Lt.L, 0.5));
    } else if (D.band === 'bright' && Lt.band === 'bright') {
      nD = normalise(D.src, 0.8);
      nL = normalise(Lt.src, 0.93);
    } else {
      nD = normalise(D.src, 0.28);
    }
    // Two bright colours can't spread far enough while both keep dark text (e.g. white v white):
    // move the darker team into the deep band (same hue, white text), darker until it is clear.
    for (const L of [0.42, 0.36, 0.3, 0.24]) {
      if (deltaE(nD.core, nL.core) >= CLASH) break;
      nD = normalise(D.src, L, 'deep');
    }
    if (darkFirst) [A, B] = [nD, nL];
    else [B, A] = [nD, nL];
    note = `clash ΔE ${before.toFixed(2)} → ${deltaE(A.core, B.core).toFixed(2)} (lightness split)`;
  }

  const a = accents(A);
  const b = accents(B);
  if (deltaE(a.line, b.line) < 0.12) {
    // Line clash: the darker source team gets the quieter, lower line.
    const aDarker = A.c.L <= B.c.L;
    const [dk, lt, dS, lS] = aDarker ? [a, b, A, B] : [b, a, B, A];
    dk.line = fromOklch({ L: 0.38, C: Math.min(dS.c.C, 0.11), h: dS.c.h });
    lt.line = fromOklch({ L: 0.6, C: Math.min(lS.c.C, 0.17), h: lS.c.h });
  }
  return { A: { ...A, ...a }, B: { ...B, ...b }, note };
}

/**
 * Every contrast pair the board relies on, as [label, ratio, minimum] rows.
 * @param {{A: object, B: object}} derived output of deriveTeamColours
 */
export function contrastReport(derived) {
  const rows = [];
  for (const k of ['A', 'B']) {
    const t = derived[k];
    const surfaces = { hi: t.hi, core: t.core, lo: t.lo, sheen: sheen(t.hi) };
    for (const [name, s] of Object.entries(surfaces)) {
      rows.push([`${k} label on ${name}`, contrast(t.on, s), 4.5]);
      rows.push([`${k} label on ${name} + court line`, contrast(t.on, over(s, t.motifCol, t.motifA)), 4.5]);
    }
    rows.push([`${k} numeral on scrim (worst stop, incl. court line)`, contrast(t.on, t.numSurf), 7.5]);
    rows.push([`${k} chip text on tint`, contrast(NEUTRAL.ink, t.tint), 4.5]);
    rows.push([`${k} line on page`, contrast(t.line, NEUTRAL.bg), 3]);
    rows.push([`${k} line on card`, contrast(t.line, NEUTRAL.surface), 3]);
  }
  return rows;
}

const rgba = (hex, a) => `rgba(${hexToRgb(hex).map((v) => Math.round(v * 255)).join(', ')}, ${+a.toFixed(2)})`;

/**
 * CSS custom properties for a scoring screen root.
 * @param {{A: object, B: object}} derived output of deriveTeamColours
 * @returns {Record<string, string>} --team-{a,b}-{hi,core,lo,on,scrim,tint,line,motif}
 */
export function teamColourVars(derived) {
  const vars = {};
  for (const [k, side] of [['A', 'a'], ['B', 'b']]) {
    const t = derived[k];
    vars[`--team-${side}-hi`] = t.hi;
    vars[`--team-${side}-core`] = t.core;
    vars[`--team-${side}-lo`] = t.lo;
    vars[`--team-${side}-on`] = t.on;
    vars[`--team-${side}-scrim`] = rgba(t.veil, t.scrimA);
    vars[`--team-${side}-tint`] = t.tint;
    vars[`--team-${side}-line`] = t.line;
    vars[`--team-${side}-motif`] = rgba(t.motifCol, t.motifA);
  }
  return vars;
}
