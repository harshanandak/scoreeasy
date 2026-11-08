import PropTypes from 'prop-types';
import { halfTimeScore, playerLabel } from '../../../utils/kabaddiLiveModel';
import { atMinute, isEnded, joinNames, outcomeWords, playersOut, scorerOf, sideKey } from './kabaddiView';

// Raids tab, round 4: one timeline of everything that happened. The first team's raids sit on the
// left of a centre spine, the second team's on the right, newest first. The spine carries the
// running score after each raid, and the markers (all out, super tackle, do or die, half time).
// Read-only; everything comes from kabaddiLiveModel's raid story.

/** Oldest-first rows with their markers, then flipped to newest first. */
function buildRows(match, story, names) {
  const ht = halfTimeScore(match);
  const lastOfFirst = story.filter((e) => e.half === 1).at(-1);
  const rows = [];
  for (const e of story) {
    if (e.doOrDie) rows.push({ id: `${e.id}-dod`, marker: { tone: 'danger', text: `Do or die · ${names[e.team]}` } });
    rows.push({ id: e.id, raid: e });
    if (e.superRaid && !e.superTackle) rows.push({ id: `${e.id}-sr`, marker: { tone: 'gold', text: `Super raid · ${names[e.team]}` } });
    if (e.allOut !== null) rows.push({ id: `${e.id}-ao`, marker: { tone: 'gold', text: `All out · ${names[e.allOut]}` } });
    if (e.superTackle) rows.push({ id: `${e.id}-st`, marker: { tone: 'gold', text: `Super tackle · ${names[1 - e.team]}` } });
    if (ht && lastOfFirst && e.id === lastOfFirst.id) rows.push({ id: 'ht', band: `Half time · ${ht[0]}–${ht[1]}` });
  }
  if (isEnded(match.state.phase) && story.length) {
    const end = story.at(-1).score;
    rows.push({ id: 'ft', band: `Full time · ${end[0]}–${end[1]}` });
  }
  return rows.reverse();
}

function RaidCard({ e, names, roster, halfMs }) {
  const out = playersOut(e, roster);
  const scorer = scorerOf(e);
  const side = sideKey(e.team);
  const lossOut = ['tackled', 'selfOut', 'doOrDieFailure'].includes(e.outcome);
  return (
    <article className={`k4w-rc k4w-rc-${side}`}>
      <header>
        <span className="k4w-rc-no">Raid {e.number}</span>
        {scorer !== null
          ? <b className={`k4w-pill k4w-pill-${sideKey(scorer)}`}>+{e.points[scorer]}</b>
          : <b className="k4w-pill k4w-pill-none">0</b>}
      </header>
      <h3>{playerLabel(roster, e.raiderSlot) ?? `Raid ${e.number}`}</h3>
      <p className="k4w-rc-what">{outcomeWords(e, names)}</p>
      {out.length > 0 && <p className="k4w-rc-out">{lossOut ? 'Raider out' : 'Out'}{lossOut ? '' : `: ${joinNames(out)}`}</p>}
      <small className="k4w-rc-when">{atMinute(e, halfMs)}</small>
    </article>
  );
}
RaidCard.propTypes = {
  e: PropTypes.object.isRequired, names: PropTypes.array.isRequired, roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
};

export default function KabaddiRaidsR4({ match, story, names, roster, halfMs }) {
  const rows = buildRows(match, story, names);
  return (
    <section aria-label="All raids" className="k4w-tl-wrap">
      <div className="k4w-tl-head" aria-hidden="true">
        <span className="k4w-tl-team k4w-tl-team-a"><i className="kit-live-team-dot k4w-dot-a" />{names[0]}</span>
        <span className="k4w-tl-new">Newest first</span>
        <span className="k4w-tl-team k4w-tl-team-b">{names[1]}<i className="kit-live-team-dot k4w-dot-b" /></span>
      </div>
      <ol className="k4w-tl">
        {rows.map((row, i) => {
          const delay = { '--d': `${Math.min(i, 9) * 38}ms` };
          if (row.band) return <li key={row.id} className="k4w-tl-band" style={delay}><span>{row.band}</span></li>;
          if (row.marker) {
            return (
              <li key={row.id} className="k4w-tl-marker" style={delay}>
                <em className={`k4w-mk k4w-mk-${row.marker.tone}`}>{row.marker.text}</em>
              </li>
            );
          }
          const e = row.raid;
          return (
            <li key={row.id} className={`k4w-tl-raid k4w-tl-raid-${sideKey(e.team)}`} style={delay}>
              <RaidCard e={e} names={names} roster={roster} halfMs={halfMs} />
              <span className="k4w-node" aria-label={`Score ${e.score[0]} to ${e.score[1]}`}><b>{e.score[0]}</b><i>–</i><b>{e.score[1]}</b></span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
KabaddiRaidsR4.propTypes = {
  match: PropTypes.object.isRequired, story: PropTypes.array.isRequired, names: PropTypes.array.isRequired,
  roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
};
