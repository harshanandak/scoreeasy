// The sport's owner-approved icon (landing/sportIcons.jsx) as a decorative mark: the tile's cropped
// motif, the serving key's silhouette, a header badge. One component so every surface that "shows
// the game" draws the same icon the Kit badges use. The caller's class sets size, position and
// colour (the icon paints in currentColor); the svg fills the box.
import PropTypes from 'prop-types';
import { ICON_BY_SPORT_ID } from '../landing/sportIcons';
import './sportMark.css';

/**
 * @param {{ sportId?: string, className?: string }} props registry id, e.g. 'volleyball'
 * @returns {JSX.Element | null} null for a sport without an icon, so callers need no guard
 */
export default function SportMark({ sportId, className = '' }) {
  const Icon = Object.prototype.hasOwnProperty.call(ICON_BY_SPORT_ID, sportId) ? ICON_BY_SPORT_ID[sportId] : null;
  if (!Icon) return null;
  return (
    <span className={`se-sport-mark ${className}`.trim()} aria-hidden="true">
      <Icon color="currentColor" />
    </span>
  );
}
SportMark.propTypes = { sportId: PropTypes.string, className: PropTypes.string };
