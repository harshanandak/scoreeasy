import PropTypes from 'prop-types';
import { getSportsByCategory } from '../../../models/sportRegistry';
import { LATER_GROUP_LABEL, PRIORITY_GROUP_LABEL } from '../../../models/sportFocus';
import { KitSection, SportTile } from './KitParts';

/* The sport picker shared by the Play hub and Home: every registered sport as an engine-gated
   identity tile, in sportFocus order. Popular is full tiles, two columns, with the hint line; More
   sports is mini tiles, three columns, name only. Nothing here navigates: `onSelect(sport)` does.
   `idPrefix` keeps the two group headings' ids unique per screen (play-popular / home-popular). */
export default function SportPicker({ onSelect, selectedId = null, idPrefix = 'play', showPopularHeading = true }) {
  const groups = getSportsByCategory();
  const popular = groups[PRIORITY_GROUP_LABEL];
  const more = groups[LATER_GROUP_LABEL];

  return (
    <>
      <section aria-labelledby={showPopularHeading ? `${idPrefix}-popular` : undefined} aria-label={showPopularHeading ? undefined : PRIORITY_GROUP_LABEL}>
        {showPopularHeading && <KitSection id={`${idPrefix}-popular`} title={PRIORITY_GROUP_LABEL} aside={<span>{popular.length} sports</span>} />}
        <div className="kit-grid2">
          {popular.map((sport) => (
            <SportTile key={sport.id} sport={sport} selected={sport.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      </section>

      {more.length > 0 && (
        <section aria-labelledby={`${idPrefix}-more`}>
          <KitSection id={`${idPrefix}-more`} title={LATER_GROUP_LABEL} />
          <div className="kit-grid3">
            {more.map((sport) => (
              <SportTile key={sport.id} sport={sport} mini selected={sport.id === selectedId} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
SportPicker.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selectedId: PropTypes.string,
  idPrefix: PropTypes.string,
  showPopularHeading: PropTypes.bool,
};
