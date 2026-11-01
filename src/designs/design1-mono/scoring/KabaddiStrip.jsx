import PropTypes from 'prop-types';
import { HandUnderline } from '../kit/KitParts';
import './kabaddiStrip.css';

// Kabaddi score strip, round 4 (exploration k2, 2026-11-01). One steady strip, as in PKL's TV bug:
// two wide team cards (name, 7 player icons, score) and a centre column with the raid clock ring,
// the match clock and the half. Icons are bright for on the mat and dark for out; the ones that
// changed on the last raid carry a small mark (down: went out, up: came back), and for a few
// seconds after a raid the icon row is replaced by a named "off the court" caption. The rule pills
// sit under the team they concern, outside the strip. Presentation only: every number and every
// word arrives from the raid engine through the board.

const side = (team) => (team === 0 ? 'a' : 'b');
const SEATS = 7;
const RING = 2 * Math.PI * 24;

function Person() {
  return (
    <svg viewBox="0 0 14 18" width="14" height="18" aria-hidden="true" focusable="false">
      <circle cx="7" cy="4.4" r="3.4" />
      <path d="M0.8 17.4c0-4.8 2.6-7.4 6.2-7.4s6.2 2.6 6.2 7.4z" />
    </svg>
  );
}

function Seat({ state }) {
  return <i className={`ks-seat ${state}`}><Person /></i>;
}
Seat.propTypes = { state: PropTypes.string.isRequired };

/** Seats left to right from the outer edge: bright ones, then the dark ones. Count-based on purpose:
 *  with a team list the board still never claims which named player an icon is. */
function seatStates(on, flag) {
  return Array.from({ length: SEATS }, (_, i) => {
    if (i < on) return i >= on - flag.back ? 'back' : 'on';
    return i < on + flag.out ? 'out-now' : 'out';
  });
}

function Flash({ flag }) {
  if (flag.allOut) {
    return <span className="ks-flash"><HandUnderline>All out</HandUnderline>{flag.backText ? ` · ${flag.backText}` : ' · all back'}</span>;
  }
  const parts = [flag.outText && `▼ ${flag.outText}`, flag.backText && `▲ ${flag.backText}`].filter(Boolean);
  return parts.length ? <span className="ks-flash">{parts.join('  ')}</span> : null;
}
Flash.propTypes = { flag: PropTypes.object.isRequired };

export default function KabaddiStrip({ view, names, clock, halfWord, scoring, flags, flashId, momentTeam, onClock }) {
  const raider = scoring ? view.raidingTeam : null;
  const secs = view.raidMs === null ? null : Math.ceil(view.raidMs / 1000);
  const frac = view.raidMs === null ? 0 : Math.max(0, Math.min(1, view.raidMs / view.raidTotalMs));
  const low = secs !== null && secs <= 5;
  return (
    <>
      <div className="ks-strip">
        {[0, 1].map((team) => {
          const flag = flags[team];
          const on = view.mat[team].on;
          return (
            <section key={team} className={`ks-team ks-team-${side(team)}${momentTeam === team ? ' ks-moment' : ''}`}
              aria-label={`${names[team]} ${view.totals[team]}${raider === team ? ', raiding' : ''}, ${on} of ${SEATS} on the mat`}>
              <span className="ks-name">
                {raider === team && <i className="ks-mark" aria-hidden="true" />}
                <span className="ks-name-text">{names[team]}</span>
              </span>
              <span className="ks-seats" aria-hidden="true">
                {seatStates(on, flag).map((state, i) => <Seat key={i} state={state} />)}
                {flashId && (flag.allOut || flag.outText || flag.backText) && <span key={flashId} className="ks-flash-wrap"><Flash flag={flag} /></span>}
              </span>
              <span className="ks-score">{view.totals[team]}</span>
            </section>
          );
        })}
        <button type="button" className="ks-mid" onClick={onClock} disabled={!scoring}
          aria-label={view.paused ? `Clock paused at ${clock}. Resume` : `${clock} left in the ${halfWord}${secs === null ? '' : `, raid clock ${secs} seconds`}. Pause`}>
          <span className={`ks-ring ks-ring-${raider === null ? 'a' : side(raider)}${low ? ' ks-ring-low' : ''}${secs === null ? ' ks-ring-idle' : ''}`}>
            <svg viewBox="0 0 56 56" aria-hidden="true" focusable="false">
              <circle className="ks-track" cx="28" cy="28" r="24" />
              {secs !== null && <circle className="ks-arc" cx="28" cy="28" r="24" strokeDasharray={RING} strokeDashoffset={RING * (1 - frac)} />}
            </svg>
            <span className="ks-ring-in">{secs === null ? <i className="ks-mark" aria-hidden="true" /> : <b>{secs}</b>}</span>
          </span>
          <b className="ks-clock">{clock}</b>
          <small>{halfWord}</small>
        </button>
      </div>

      {scoring && (view.doOrDie || view.superTackleOn) && (
        <div className="ks-cues">
          {view.doOrDie && <em className={`ks-cue ks-cue-dod ks-at-${side(raider)}-wide`} role="note">Do or die · {names[raider]}</em>}
          {view.superTackleOn && (
            <em className={`ks-cue ks-cue-super ks-at-${side(1 - raider)}`} role="note"
              aria-label={`Super tackle on: ${names[1 - raider]} ${view.mat[1 - raider].on} on the mat`}>Super tackle on</em>
          )}
        </div>
      )}
    </>
  );
}

KabaddiStrip.propTypes = {
  view: PropTypes.object.isRequired,
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  clock: PropTypes.string.isRequired,
  halfWord: PropTypes.string.isRequired,
  scoring: PropTypes.bool,
  flags: PropTypes.arrayOf(PropTypes.object).isRequired,
  flashId: PropTypes.string,
  momentTeam: PropTypes.number,
  onClock: PropTypes.func.isRequired,
};
