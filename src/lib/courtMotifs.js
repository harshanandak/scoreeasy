// Court line drawings (Direction E): one per sets/goals sport, drawn faintly behind the score.
//
// Each drawing is SVG body markup in viewBox 0 0 400 260, black stroke on transparent, team A's
// half on the left and B's on the right, to regulation proportions. They are used as a CSS mask,
// so the line colour and alpha always come from the colour engine (--team-x-motif) and stay
// contrast-gated. Volleyball, throwball, badminton, football, basketball and kabaddi are ported from
// docs/plans/2026-07-26-icp-games-design/directions/e-broadcast/motifs.html.

// The same markup again, mirrored about the centre line (x = 200): draw A's half once.
const mirror = (s) => `${s}<g transform='matrix(-1 0 0 1 400 0)'>${s}</g>`;
const dots = (pts, r) => pts.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='#000' stroke='none'/>`).join('');
const hatch = (id) =>
  `<defs><pattern id='${id}' width='7' height='7' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>` +
  `<path d='M0 0V7' stroke='#000' stroke-width='1.3'/></pattern></defs>`;

export const COURT_MOTIFS = Object.freeze({
  // court 18 x 9 m, net band with mesh + posts, 3 m attack lines with their dashed extensions
  volleyball:
    `<rect x='30' y='45' width='340' height='170'/>` +
    mirror(`<path d='M143.3 45V215'/><path d='M143.3 41V22M143.3 219V238' stroke-dasharray='4 4'/>`) +
    `<rect x='195' y='24' width='10' height='212' stroke-width='1.6'/>` +
    `<path d='${Array.from({ length: 20 }, (_, i) => `M195 ${34 + i * 10}H205`).join('')}' stroke-width='1'/>` +
    dots([[200, 18], [200, 242]], 4),

  // court + net, hatched neutral zone either side of the net, dashed throw arc ending in a ball
  // (Tier-0 game being added to the registry; drawn ahead so its board has a court on day one)
  throwball:
    hatch('h') +
    `<rect x='40' y='24' width='320' height='212'/><rect x='182.5' y='24' width='35' height='212' fill='url(#h)' stroke-width='1.4'/>` +
    `<path d='M200 8V252' stroke-width='3.2'/>` +
    dots([[200, 6], [200, 254]], 4) +
    `<path d='M92 214Q200 -70 302 200' stroke-dasharray='3 8' stroke-width='2.2'/><circle cx='308' cy='212' r='9' stroke-width='2.2'/>` +
    `<path d='M300 208q8 6 16 0M302 217q6 -4 12 0' stroke-width='1.4'/>`,

  // doubles court 13.4 x 6.1 m: singles + doubles sidelines, short/long service lines, centre line, net, shuttle
  badminton:
    `<rect x='30' y='52' width='340' height='156'/><path d='M30 63.7H370M30 196.3H370'/>` +
    mirror(`<path d='M149.7 52V208M49.3 52V208M30 130H149.7'/>`) +
    `<path d='M200 38V222' stroke-width='3'/>` +
    dots([[200, 36], [200, 224]], 3.5) +
    `<g transform='translate(268 236) rotate(-58)' stroke-width='1.8'><path d='M-5 0a5 5 0 0 0 10 0Z' fill='#000'/>` +
    `<path d='M-5 0L-11 -22H11L5 0M-2 0L-4 -22M2 0L4 -22M-9 -14H9'/></g>`,

  // table 2.74 x 1.525 m: edge lines, doubles centre line, net overhanging the sides, posts, ball
  tabletennis:
    `<rect x='30' y='35.5' width='340' height='189'/><path d='M30 130H370' stroke-width='1.6'/>` +
    `<path d='M200 16.5V243.5' stroke-width='3.4'/>` +
    dots([[200, 14], [200, 246]], 3.5) +
    `<circle cx='292' cy='92' r='5' stroke-width='1.8'/>`,

  // doubles court 23.77 x 10.97 m: singles sidelines, service lines, centre service line, centre marks, net
  tennis:
    `<rect x='30' y='51.5' width='340' height='157'/><path d='M30 71.1H370M30 188.9H370'/>` +
    mirror(`<path d='M108.5 71.1V188.9M108.5 130H200M30 130H37'/>`) +
    `<path d='M200 38.5V221.5' stroke-width='3'/>` +
    dots([[200, 36], [200, 224]], 3.5),

  // pitch 105 x 68 m: halfway, centre circle, boxes, spots, D, goals, corner arcs
  football:
    `<rect x='20' y='13' width='360' height='234'/><path d='M200 13V247'/><circle cx='200' cy='130' r='31.4'/>` +
    dots([[200, 130]], 2.4) +
    mirror(
      `<path d='M20 61H76.6V199H20M20 98.6H38.9V161.4H20M76.6 104.9A31.4 31.4 0 0 1 76.6 155.1` +
        `M20 117.5H13V142.5H20M20 16.4A3.4 3.4 0 0 0 23.4 13M23.4 247A3.4 3.4 0 0 0 20 243.6'/>` +
        dots([[57.7, 130]], 2),
    ),

  // court 28 x 15 m: keys, free-throw circles, 3-point arcs, hoops, centre circle
  basketball:
    `<rect x='20' y='33.5' width='360' height='193'/><path d='M200 33.5V226.5'/><circle cx='200' cy='130' r='23'/>` +
    mirror(
      `<path d='M20 98.5H94.6V161.5H20M94.6 107A23 23 0 0 1 94.6 153'/>` +
        `<path d='M94.6 107A23 23 0 0 0 94.6 153' stroke-dasharray='4 4'/>` +
        `<path d='M20 45.1H58.3A86.8 86.8 0 0 1 58.3 214.9H20'/><circle cx='40.3' cy='130' r='3.2' stroke-width='1.8'/>`,
    ),

  // pitch 91.4 x 55 m: centre line, 23 m lines, shooting circles, dashed 5 m circles, spots, goals
  hockey:
    `<rect x='20' y='21.65' width='360' height='216.7'/><path d='M200 21.65V238.35'/>` +
    mirror(
      `<path d='M110.2 21.65V238.35'/>` +
        `<path d='M20 65.2A57.6 57.6 0 0 1 77.6 122.8V137.2A57.6 57.6 0 0 1 20 194.8'/>` +
        `<path d='M20 45.5A77.3 77.3 0 0 1 97.3 122.8V137.2A77.3 77.3 0 0 1 20 214.5' stroke-dasharray='4 6'/>` +
        `<path d='M20 122.8H15.2V137.2H20'/>` +
        dots([[45.2, 130]], 2),
    ),

  // mat 13 x 10 m + 1 m lobbies, midline, baulk lines, dashed bonus lines
  kabaddi:
    `<rect x='30' y='16' width='340' height='228'/><path d='M30 35H370M30 225H370'/>` +
    `<path d='M200 16V244' stroke-width='3.4'/>` +
    mirror(`<path d='M102 35V225'/><path d='M75.7 35V225' stroke-dasharray='7 6'/>`),
});

const svgFor = (markup, viewBox) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}' preserveAspectRatio='xMidYMid slice' ` +
  `fill='none' stroke='#000' stroke-width='2.5' stroke-linecap='round'>${markup}</svg>`;

const VIEWBOX = { a: '0 0 200 260', b: '200 0 200 260' };

/**
 * The sport's court drawing as a CSS `url(...)` for `mask-image`.
 * @param {string} sportId registry id, e.g. 'football'
 * @param {'a' | 'b'} [half] crop to that team's half (for the point keys); whole court when omitted
 * @returns {string | null} null for sports without a drawing
 */
export function motifMaskUrl(sportId, half) {
  const markup = Object.prototype.hasOwnProperty.call(COURT_MOTIFS, sportId) ? COURT_MOTIFS[sportId] : null;
  if (!markup) return null;
  const svg = svgFor(markup, VIEWBOX[half] ?? '0 0 400 260');
  // encodeURIComponent leaves ' alone; escape it too so the url survives any quoting context.
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}
