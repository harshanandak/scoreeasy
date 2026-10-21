// Sport marks: a bold ball-and-action silhouette that says which game is being scored at a
// glance ("show the game", Harsha 2026-10-21; it replaces the faint court drawing on the scorer).
//
// Each mark is SVG body markup in viewBox 0 0 140 100, black on transparent, drawn travelling
// right (towards the net when it sits on the left key; the board mirrors it for the right key).
// Only alpha matters to a mask: shapes paint in the default currentColor (opaque); the two literals
// left are the luminance <mask> that cuts the seams out (white keeps, black cuts).
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

export const SPORT_MARKS = Object.freeze({
  volleyball:
    `<defs><mask id='m' maskUnits='userSpaceOnUse' x='0' y='0' width='140' height='100'>` +
    `<rect width='140' height='100' fill='#fff'/>` +
    `<g transform='translate(92 50) scale(4.6) translate(-12 -12)' fill='none' stroke='#000' ` +
    `stroke-width='1.15' stroke-linecap='round'>${VOLLEYBALL_SEAMS}</g></mask></defs>` +
    `<circle cx='92' cy='50' r='46' mask='url(#m)'/>` +
    `<path d='M16 30H34M4 50H36M16 70H34' fill='none' stroke='currentColor' stroke-width='6' stroke-linecap='round'/>`,
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
