import PropTypes from 'prop-types';
import './kabaddiHeader.css';

// Kabaddi score header shared by both scorer variants (exploration k2, round 3 header, 2026-11-01).
// Modelled on the s2 raid-timeline header: two wide flat team cards with big scores, the raiding
// team's card carrying the raider mark, and a narrow centre column with the raider badge in the
// raiding team's colour, the half and the clock (tap to pause). Unlike s2, the mat dots and
// "Next in" sit outside the cards in their own row, and the rule cues are the s1 pills in a row of
// their own. Presentation only: every number arrives from the raid engine through the board.

const sideKey = (team) => (team === 0 ? 'a' : 'b');

export default function KabaddiHeader({ view, names, clock, halfWord, scoring, momentTeam, onClock }) {
  const raider = scoring ? view.raidingTeam : null;
  return (
    <>
      <div className="kh-strip">
        {[0, 1].map((team) => (
          <section key={team} className={`kh-team kh-team-${sideKey(team)}${momentTeam === team ? ' kh-moment' : ''}`}
            aria-label={`${names[team]} ${view.totals[team]}${raider === team ? ', raiding' : ''}`}>
            <span className="kh-name">
              {raider === team && <i className="kh-mark" aria-hidden="true" />}
              <span className="kh-name-text">{names[team]}</span>
            </span>
            <span className="kh-score">{view.totals[team]}</span>
          </section>
        ))}
        <button type="button" className="kh-mid" onClick={onClock} disabled={!scoring}
          aria-label={view.paused ? `Clock paused at ${clock}. Resume` : `${clock} left in the ${halfWord}. Pause`}>
          {raider !== null && <span className={`kh-badge kh-badge-${sideKey(raider)}`}><i className="kh-mark" aria-hidden="true" /></span>}
          <small>{halfWord}</small>
          <b>{clock}</b>
        </button>
      </div>

      <div className="kh-mat" aria-label="On the mat">
        {[0, 1].map((team) => (
          <div key={team} className={`kh-side kh-side-${sideKey(team)}`}>
            <span className="kh-dots" aria-label={`${names[team]} ${view.mat[team].on} on the mat`}>
              {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < view.mat[team].on ? 'on' : ''} />)}
              <b>{view.mat[team].on}</b>
            </span>
            <span className="kh-next">{view.mat[team].out.length ? <>Next in: <b>{view.mat[team].out[0].name}</b></> : 'All on the mat'}</span>
          </div>
        ))}
        {scoring && <span className="kh-raidno">Raid {view.raidNumber}</span>}
      </div>

      {scoring && (view.doOrDie || view.superTackleOn) && (
        <div className="kh-cues">
          {view.doOrDie && <em className="kh-cue kh-cue-dod" role="note">Do or die · {names[raider]}</em>}
          {view.superTackleOn && (
            <em className="kh-cue kh-cue-super" role="note" aria-label={`Super tackle on: ${names[1 - raider]} ${view.mat[1 - raider].on} on the mat`}>Super tackle on</em>
          )}
        </div>
      )}
    </>
  );
}

KabaddiHeader.propTypes = {
  view: PropTypes.object.isRequired,
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  clock: PropTypes.string.isRequired,
  halfWord: PropTypes.string.isRequired,
  scoring: PropTypes.bool,
  momentTeam: PropTypes.number,
  onClock: PropTypes.func.isRequired,
};
