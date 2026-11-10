// Sport marks: a bold ball-and-action silhouette that says which game is being scored at a
// glance ("show the game", Harsha 2026-10-21; it replaces the faint court drawing on the scorer).
//
// Each mark is SVG body markup in viewBox 0 0 140 100, black on transparent, drawn travelling
// right (towards the net when it sits on the left key; the board mirrors it for the right key).
// Only alpha matters to a mask: shapes paint in the default currentColor (opaque). Detail is cut
// out of a solid shape with an SVG luminance <mask>; the only two colour literals that takes
// (white keeps, black cuts) live once in cutOut() below, so a new mark adds 0 raw literals.
// It is used as a CSS mask, so its colour and alpha always come from the colour engine
// (--team-x-motif) and every label and numeral over it stays contrast-gated.

// Volleyball: a filled ball with its panel seams cut out, plus three speed lines.
// Seam geometry after Lucide's `volleyball` icon (ISC licence), scaled onto a r=46 ball.
const VOLLEYBALL_SEAMS = [
  'M11.1 7.1a16.55 16.55 0 0 1 10.9 4',
  'M12 12a12.6 12.6 0 0 1-8.7 5',
  'M16.8 13.6a16.55 16.55 0 0 1-9 7.5',
  'M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10',
  'M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5',
].map((d) => `<path d='${d}'/>`).join('');

/**
 * A luminance mask that keeps the whole 140 x 100 mark box and cuts `cutMarkup` out of it.
 * `cutMarkup` inherits the cut colour from the wrapping group, so a mark only supplies
 * geometry. Reference the result with mask='url(#<id>)'.
 * @param {string} id mask id, unique within one mark
 * @param {string} cutMarkup SVG markup for what to cut (paths, lines, circles)
 * @param {{transform?: string, strokeAttrs?: string, fill?: boolean}} [options] group transform,
 *   extra stroke attributes (stroke-width, stroke-linecap, ...), and `fill` to cut filled shapes
 *   (panels) as well as strokes
 * @returns {string} a <defs><mask> block
 */
export function cutOut(id, cutMarkup, { transform = '', strokeAttrs = '', fill = false } = {}) {
  const KEEP = '#fff';
  const CUT = '#000';
  const t = transform ? ` transform='${transform}'` : '';
  const extra = strokeAttrs ? ` ${strokeAttrs}` : '';
  return `<defs><mask id='${id}' maskUnits='userSpaceOnUse' x='0' y='0' width='140' height='100'>` +
    `<rect width='140' height='100' fill='${KEEP}'/>` +
    `<g${t} fill='${fill ? CUT : 'none'}' stroke='${CUT}'${extra}>${cutMarkup}</g></mask></defs>`;
}

// Speed lines behind a ball travelling right.
const SPEED = `<path d='M16 30H34M4 50H36M16 70H34' fill='none' stroke='currentColor' stroke-width='6' stroke-linecap='round'/>`;
const BALL_CUT = "stroke-width='3.6' stroke-linecap='round'";
const ball = (cuts, r = 44) => cutOut('m', cuts, { strokeAttrs: BALL_CUT }) + `<circle cx='94' cy='50' r='${r}' mask='url(#m)'/>` + SPEED;

// Kit draft marks (plan 2026-10-22 §3, prototype MARKS). They appear on sport tiles and row
// badges now; a game PR may refine its own mark when it brings the mark onto its board.
export const SPORT_MARKS = Object.freeze({
  volleyball:
    cutOut('m', VOLLEYBALL_SEAMS, {
      transform: 'translate(92 50) scale(4.6) translate(-12 -12)',
      strokeAttrs: "stroke-width='1.15' stroke-linecap='round'",
    }) +
    `<circle cx='92' cy='50' r='46' mask='url(#m)'/>` +
    SPEED,
  cricket: ball("<path d='M72 12C90 34 100 60 112 90'/><path d='M60 18C78 40 88 66 100 94' stroke-dasharray='0.1 7'/><path d='M84 8C102 30 112 56 124 84' stroke-dasharray='0.1 7'/>"),
  football:
    cutOut('m',
      "<polygon points='94,36 107.3,45.7 102.2,61.3 85.8,61.3 80.7,45.7'/><circle cx='94' cy='6' r='11'/><circle cx='135' cy='37' r='11'/>" +
      "<circle cx='119' cy='86' r='11'/><circle cx='69' cy='86' r='11'/><circle cx='53' cy='37' r='11'/>" +
      "<path d='M94 36V14M107.3 45.7L126 39.6M102.2 61.3L113.7 77M85.8 61.3L74.3 77M80.7 45.7L62 39.6' fill='none'/>",
      { fill: true, strokeAttrs: BALL_CUT }) +
    `<circle cx='94' cy='50' r='44' mask='url(#m)'/>` + SPEED,
  basketball: ball("<path d='M94 6V94M50 50H138'/><path d='M64 16Q84 50 64 84'/><path d='M124 16Q104 50 124 84'/>"),
  tennis: ball("<path d='M60 22C80 36 80 64 60 78'/><path d='M128 22C108 36 108 64 128 78'/>", 42),
  badminton:
    cutOut('m', "<path d='M102 45L46 28M102 50H46M102 55L46 72M82 32.5V67.5'/>", { strokeAttrs: "stroke-width='3.2' stroke-linecap='round'" }) +
    `<g mask='url(#m)'><polygon points='104,40 104,60 44,84 44,16'/></g><circle cx='114' cy='50' r='15'/>` +
    `<path d='M8 30H30M2 50H32M8 70H30' fill='none' stroke='currentColor' stroke-width='6' stroke-linecap='round'/>`,
  tabletennis:
    `<circle cx='74' cy='44' r='32'/><path d='M94 66L114 90' fill='none' stroke='currentColor' stroke-width='15' stroke-linecap='round'/>` +
    `<circle cx='124' cy='22' r='10'/><path d='M14 30H32M6 48H30' fill='none' stroke='currentColor' stroke-width='6' stroke-linecap='round'/>`,
  hockey:
    `<path d='M38 4L58 74Q62 90 78 87L96 82' fill='none' stroke='currentColor' stroke-width='13' stroke-linecap='round' stroke-linejoin='round'/>` +
    `<circle cx='122' cy='78' r='12'/><path d='M100 58H116M106 44H126' fill='none' stroke='currentColor' stroke-width='6' stroke-linecap='round'/>`,
  kabaddi:
    `<circle cx='98' cy='17' r='11'/><g fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round'>` +
    `<path d='M90 33L70 58' stroke-width='14'/><path d='M86 38L124 46' stroke-width='10'/><path d='M82 41L60 30' stroke-width='10'/>` +
    `<path d='M70 58L98 70L102 94' stroke-width='12'/><path d='M70 58L46 76L20 86' stroke-width='12'/></g>`,
});

/**
 * The sport's mark as a CSS `url(...)` for `mask-image`.
 * @param {string | undefined} sportId registry id, e.g. 'volleyball'
 * @returns {string | null} null for sports without a mark
 */
export function sportMarkMaskUrl(sportId) {
  const markup = Object.prototype.hasOwnProperty.call(SPORT_MARKS, sportId) ? SPORT_MARKS[sportId] : null;
  if (!markup) return null;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 100'>${markup}</svg>`;
  // encodeURIComponent leaves ' alone; escape it too so the url survives any quoting context.
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}
