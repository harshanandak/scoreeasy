import PropTypes from 'prop-types';
import { HandUnderline } from '../kit/KitParts';
import './kabaddiScoreStrip.css';

// Kabaddi score strip, round 5 (exploration k2, 2026-11-01). Two team cards in the app's own team
// gradient (hi, core, lo plus the 7% sheen, as the setup keys and the sets board use) and one centre
// disc. Players on the mat are a count and slim pips instead of seven little people: the number is
// what the scorer reads, the pips only show how full the mat is. While a raid runs, a small
// preview shows what the engine would do with the marks so far (a pending "+2", the mat count
// "6 → 4", pips going out); nothing is scored until the raid ends. Presentation only: every number
// and word arrives from the raid engine through the board.

const side = (team) => (team === 0 ? 'a' : 'b');
const RING = 2 * Math.PI * 27;

/** Pip states left to right from the card's outer edge: on, then out. A raid's marks, and the last
 *  raid's changes, only recolour pips; the row never changes width. */
function pipStates(seats, on, flag, change) {
  return Array.from({ length: seats }, (_, i) => {
    if (i < on) {
      if (change < 0 && i >= on + change) return 'going';
      return i >= on - flag.back ? 'back' : 'on';
    }
    if (change > 0 && i < on + change) return 'coming';
    return i < on + flag.out ? 'out-now' : 'out';
  });
}

function Flash({ flag }) {
  if (flag.allOut) {
    return <span className="k5-flash"><HandUnderline>All out</HandUnderline>{flag.backText ? ` · ${flag.backText}` : ' · all back'}</span>;
  }
  const parts = [flag.outText && `▼ ${flag.outText}`, flag.backText && `▲ ${flag.backText}`].filter(Boolean);
  return parts.length ? <span className="k5-flash">{parts.join('  ')}</span> : null;
}
Flash.propTypes = { flag: PropTypes.object.isRequired };

export default function KabaddiScoreStrip({ view, names, clock, halfWord, scoring, flags, flashId, momentTeam, pending, onClock }) {
  const raider = scoring ? view.raidingTeam : null;
  const secs = view.raidMs === null ? null : Math.ceil(view.raidMs / 1000);
  const frac = view.raidMs === null ? 0 : Math.max(0, Math.min(1, view.raidMs / view.raidTotalMs));
  const low = secs !== null && secs <= 5;
  return (
    <>
      <div className="k5-strip">
        {[0, 1].map((team) => {
          const flag = flags[team];
          const on = view.mat[team].on;
          const after = pending ? pending.mat[team] : on;
          const gain = pending ? pending.points[team] : 0;
          return (
            <section key={team} className={`k5-team k5-team-${side(team)}${momentTeam === team ? ' k5-moment' : ''}`}
              aria-label={`${names[team]} ${view.totals[team]}${raider === team ? ', raiding' : ''}, ${on} of ${view.seats} on the mat`}>
              <span className="k5-name">
                {raider === team && <i className="k5-mark" aria-hidden="true" />}
                <span className="k5-name-text">{names[team]}</span>
              </span>
              {gain > 0 && <em className="k5-pend" aria-label={`${gain} pending`}>+{gain}</em>}
              <span className="k5-score">{view.totals[team]}</span>
              <span className="k5-foot">
                {view.playerOuts && <>
                <span className="k5-count" aria-hidden="true">
                  {on}{after !== on && <> → {after}</>} on mat
                </span>
                <span className="k5-pips" aria-hidden="true">
                  {pipStates(view.seats, on, flag, after - on).map((state, i) => <i key={i} className={`k5-pip ${state}`} />)}
                </span>
                {flashId && (flag.allOut || flag.outText || flag.backText) && <span key={flashId} className="k5-flash-wrap" aria-hidden="true"><Flash flag={flag} /></span>}
                </>}
              </span>
            </section>
          );
        })}
        <button type="button" className="k5-mid" onClick={onClock} disabled={!scoring || !view.timed}
          aria-label={view.paused ? `Clock paused at ${clock}. Resume` : `${clock} left in the ${halfWord}${secs === null ? '' : `, raid clock ${secs} seconds`}. Pause`}>
          <span className={`k5-ring k5-ring-${raider === null ? 'a' : side(raider)}${low ? ' k5-ring-low' : ''}${secs === null ? ' k5-ring-idle' : ''}`}>
            <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <circle className="k5-track" cx="32" cy="32" r="27" />
              {secs !== null && <circle className="k5-arc" cx="32" cy="32" r="27" strokeDasharray={RING} strokeDashoffset={RING * (1 - frac)} />}
              <circle className="k5-disc" cx="32" cy="32" r="22" />
            </svg>
            <span className="k5-ring-in">{secs === null ? <i className="k5-disc-mark" aria-hidden="true" /> : <b>{secs}</b>}</span>
          </span>
          <b className="k5-clock">{view.timed ? clock : `Raid ${view.raidNumber}`}</b>
          <small>{halfWord}</small>
        </button>
      </div>

      {scoring && (view.doOrDie || view.superTackleOn) && (
        <div className="k5-cues">
          {view.doOrDie && <em className={`k5-cue k5-cue-dod k5-at-${side(raider)}-wide`} role="note">Do or die · {names[raider]}</em>}
          {view.superTackleOn && (
            <em className={`k5-cue k5-cue-super k5-at-${side(1 - raider)}`} role="note"
              aria-label={`Super tackle on: ${names[1 - raider]} ${view.mat[1 - raider].on} on the mat`}>Super tackle on</em>
          )}
        </div>
      )}
    </>
  );
}

KabaddiScoreStrip.propTypes = {
  view: PropTypes.object.isRequired,
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  clock: PropTypes.string.isRequired,
  halfWord: PropTypes.string.isRequired,
  scoring: PropTypes.bool,
  flags: PropTypes.arrayOf(PropTypes.object).isRequired,
  flashId: PropTypes.string,
  momentTeam: PropTypes.number,
  pending: PropTypes.shape({ points: PropTypes.arrayOf(PropTypes.number), mat: PropTypes.arrayOf(PropTypes.number) }),
  onClock: PropTypes.func.isRequired,
};
