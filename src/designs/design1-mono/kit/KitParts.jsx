// Kit app-screen parts (plan 2026-10-22 §3/§4, S1): the sport tile, the row badge, the brand mark
// and the two hand-drawn accents Home uses. Colour comes only from engine output (sportIdentity,
// teamColour) and the --se-color-* tokens, so dark mode is a token swap.
import PropTypes from 'prop-types';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { ICON_BY_SPORT_ID } from '../landing/sportIcons';
import './kit.css';

/** The app mark: the hand-drawn volleyball from the app icon (PR #178), in ink, stroke 2.0. */
export function BrandMark({ size = 28 }) {
  const Ball = ICON_BY_SPORT_ID.volleyball;
  return (
    <span className="kit-brand-mark" aria-hidden="true">
      <Ball size={size} color="currentColor" strokeWidth={2} />
    </span>
  );
}
BrandMark.propTypes = { size: PropTypes.number };

/** Screen header: brand mark + a title, with an optional control on the right. */
export function KitTop({ title, children }) {
  return (
    <div className="kit-top">
      <div className="kit-brand">
        <BrandMark />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}
KitTop.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node };

/** Two soft radial tints of the screen's identity colours at the top of the canvas (Kit only). */
export function KitWash({ from, to }) {
  return <div className="kit-wash" aria-hidden="true" style={{ '--kit-w1': from, '--kit-w2': to }} />;
}
KitWash.propTypes = { from: PropTypes.string, to: PropTypes.string };

export function KitSection({ title, aside, id }) {
  return (
    <div className="kit-sec">
      <h2 id={id}>{title}</h2>
      {aside}
    </div>
  );
}
KitSection.propTypes = { title: PropTypes.string.isRequired, aside: PropTypes.node, id: PropTypes.string };

/**
 * Hand-drawn swoosh under a word (moment-underline.svg). Decorative, never under a number.
 * Its colour is --kit-underline (a sport or team line colour, >= 3:1 on the canvas) or ink.
 */
export function HandUnderline({ children }) {
  return (
    <span className="kit-underlined">
      {children}
      <svg className="kit-underline" viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M2.5 9.6C26 6.4 58 5 117 6.6C96 7.6 70 9.4 48 12.6" vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  );
}
HandUnderline.propTypes = { children: PropTypes.node.isRequired };

/** First-run coach mark (moment-arrow.svg): a hand-drawn arrow curling down onto the one Go. */
export function CoachArrow() {
  return (
    <svg className="kit-coach-arrow" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
      <path d="M5 6.5C22 3.2 41 9.6 50 24.4C55.6 33.6 55.2 44.4 49.6 55" vectorEffect="non-scaling-stroke" />
      <path d="M41.8 49.4C44.6 51.6 47 53.6 49.8 56.3C51.2 52.6 52.4 49.2 53.8 45.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Empty History (empty-history.svg from the hand-drawn layer): an open scorebook with a shuttle and
 * a pencil, built from the sport doodles. Ink, non-scaling 2.25px strokes; decorative only.
 */
export function EmptyHistoryArt() {
  const strokes = [
    'M80 34C62 27 42 26 22 30.6C22.6 50 22.4 70 21.6 88.4C42 84 62 85 80.6 92',
    'M80 34C98 27 118 26 138 30.6C137.4 50 137.6 70 138.4 88.4C118 84 98 85 79.4 92',
    'M80.2 30C80.6 50 80.4 72 80 96',
    'M31 45C45 43.4 59 44.2 71 47.4',
    'M31 57C45 55.4 59 56.2 71 59.4',
    'M31 69C43 67.6 53 68.2 62 70.4',
    'M118 99L144 71',
    'M123.6 102.6L149.4 75',
    'M118.4 98.6L114.4 106.4L123.4 102.4',
    'M144.4 70.6C146 69 148.4 69 149.8 70.6C151.2 72.2 151 74.4 149.2 75.6',
  ];
  const shuttle = [
    'M12.5 24c-2-4-3.5-10-2-16',
    'M19.5 24c2-4 3.5-10 2-16',
    'M10.5 8c1.5-1 3.2-1.5 5.5-1.5s4 0.5 5.5 1.5',
    'M13 21c-0.5-3.5-0.5-8 1-13',
    'M19 21c0.5-3.5 0.5-8-1-13',
    'M16 22v-15',
  ];
  return (
    <svg className="kit-empty-art" viewBox="0 0 160 110" aria-hidden="true" focusable="false">
      {strokes.map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
      <g transform="translate(95 34) rotate(14 16.8 16.8) scale(1.05)">
        <ellipse cx="16" cy="24" rx="3.5" ry="2.5" vectorEffect="non-scaling-stroke" />
        {shuttle.map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
      </g>
    </svg>
  );
}

/**
 * A filter chip: round, 48px, surface with a hairline; the selected one is an ink fill with
 * aria-pressed, so selection never rests on colour alone. An optional sport dot leads the label.
 */
export function FilterChip({ label, count, sportId, pressed, onClick }) {
  return (
    <button
      type="button"
      className="kit-fchip"
      aria-pressed={pressed ? 'true' : 'false'}
      style={sportId ? sportIdentityVars(sportId) : undefined}
      onClick={onClick}
    >
      {sportId && <i aria-hidden="true" />}
      {label}
      {count !== undefined && <>{' '}<b>{count}</b></>}
    </button>
  );
}
FilterChip.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number,
  sportId: PropTypes.string,
  pressed: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

/**
 * A sport tile: the engine-gated identity gradient, the clean filled mark cropped at the edge,
 * the sport name and (full tiles) its one-line hint. Never hand-drawn.
 */
export function SportTile({ sport, mini = false, selected = false, onSelect }) {
  return (
    <button
      type="button"
      id={`sport-tile-${sport.id}`}
      className={`kit-tile${mini ? ' kit-tile-mini' : ''}${selected ? ' is-selected' : ''}`}
      style={sportIdentityVars(sport.id)}
      data-sport={sport.id}
      aria-current={selected ? 'true' : undefined}
      aria-label={`Quick match: ${sport.name}`}
      onClick={() => onSelect(sport)}
    >
      <span className="kit-tile-mark" aria-hidden="true" />
      <span className="kit-tile-name">{sport.name}</span>
      {!mini && sport.desc && <span className="kit-tile-hint">{sport.desc}</span>}
    </button>
  );
}
SportTile.propTypes = {
  sport: PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired, desc: PropTypes.string }).isRequired,
  mini: PropTypes.bool,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

/**
 * A list-row / history badge: the sport's identity gradient with its hand-drawn doodle (the
 * originals from sportIcons.jsx, stroke 2 on 32) in the on-colour. Unknown sports get a neutral well.
 */
export function SportBadge({ sportId }) {
  const Doodle = Object.prototype.hasOwnProperty.call(ICON_BY_SPORT_ID, sportId) ? ICON_BY_SPORT_ID[sportId] : null;
  return (
    <span className="kit-badge" style={sportIdentityVars(sportId)} aria-hidden="true">
      {Doodle && <Doodle size={28} color="currentColor" strokeWidth={2} />}
    </span>
  );
}
SportBadge.propTypes = { sportId: PropTypes.string };

export function Chevron() {
  return (
    <svg className="kit-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function GoArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
