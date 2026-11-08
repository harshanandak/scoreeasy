import PropTypes from 'prop-types';
import { halfTimeScore, playerLabel } from '../../../utils/kabaddiLiveModel';
import { atMinute, isEnded, outcomeWords, scorerOf, sideKey } from './kabaddiView';

// Raids tab, round 5: one timeline, one line per raid. The first team's raids sit on the left of a
// centre spine, the second team's on the right, newest first. Each raid is the raider and what
// happened in plain words. The points pill is in the colour of the team that SCORED and sits on that
// team's side (a tackle of a Royals raider shows a blue pill on the Strikers side). The spine carries
// the running score. Runs of empty raids fold into one muted line; all out, super tackle, do or die
// and half time are slim markers on the spine. Read-only; everything comes from kabaddiLiveModel's
// raid story.

const isEmptyRaid = (e) => e.outcome === 'empty';

/** Oldest-first rows, then flipped to newest first. */
function buildRows(match, story, names) {
  const ht = halfTimeScore(match);
  const lastOfFirst = story.filter((e) => e.half === 1).at(-1);
  const rows = [];
  let run = [];
  const flush = () => {
    if (run.length === 1) rows.push({ id: run[0].id, raid: run[0], muted: true });
    else if (run.length > 1) rows.push({ id: `${run[0].id}-run`, fold: { from: run[0].number, to: run.at(-1).number, count: run.length } });
    run = [];
  };
  for (const e of story) {
    if (isEmptyRaid(e)) {
      run.push(e);
    } else {
      flush();
      rows.push({ id: e.id, raid: e });
      if (e.doOrDie) rows.push({ id: `${e.id}-dod`, marker: { tone: 'danger', text: `Do or die · ${names[e.team]}` } });
      if (e.superRaid && !e.superTackle) rows.push({ id: `${e.id}-sr`, marker: { tone: 'gold', text: `Super raid · ${names[e.team]}` } });
      if (e.allOut !== null) rows.push({ id: `${e.id}-ao`, marker: { tone: 'gold', text: `All out · ${names[e.allOut]}` } });
      if (e.superTackle) rows.push({ id: `${e.id}-st`, marker: { tone: 'gold', text: `Super tackle · ${names[1 - e.team]}` } });
    }
    if (ht && lastOfFirst && e.id === lastOfFirst.id) { flush(); rows.push({ id: 'ht', band: `Half time · ${ht[0]}–${ht[1]}` }); }
  }
  flush();
  if (isEnded(match.state.phase) && story.length) {
    const end = story.at(-1).score;
    rows.push({ id: 'ft', band: `Full time · ${end[0]}–${end[1]}` });
  }
  return rows.reverse();
}

/** The raid in two short lines. `pill` is the points pill when the raiding team scored (it sits inside its own card). */
function RaidLine({ e, names, roster, halfMs, muted, pill }) {
  const raider = playerLabel(roster, e.raiderSlot) ?? `Raid ${e.number}`;
  return (
    <div className={`kw-rl kw-rl-${sideKey(e.team)}${muted ? ' is-muted' : ''}${pill ? ' has-pill' : ''}`}>
      <b className="kw-rl-who">{raider}</b>
      <span className="kw-rl-what">{outcomeWords(e, names)}</span>
      <small className="kw-rl-when">Raid {e.number} · {atMinute(e, halfMs)}</small>
      {pill}
    </div>
  );
}
RaidLine.propTypes = {
  e: PropTypes.object.isRequired, names: PropTypes.array.isRequired, roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
  muted: PropTypes.bool, pill: PropTypes.node,
};

export default function KabaddiRaids({ match, story, names, roster, halfMs }) {
  const rows = buildRows(match, story, names);
  return (
    <section aria-label="All raids" className="kw-tl-wrap">
      <div className="kw-tl-head" aria-hidden="true">
        <span className="kw-tl-team kw-tl-team-a"><i className="kit-live-team-dot kw-dot-a" />{names[0]}</span>
        <span className="kw-tl-new">Newest first</span>
        <span className="kw-tl-team kw-tl-team-b">{names[1]}<i className="kit-live-team-dot kw-dot-b" /></span>
      </div>
      <ol className="kw-tl">
        {rows.map((row, i) => {
          const delay = { '--d': `${Math.min(i, 9) * 38}ms` };
          if (row.band) return <li key={row.id} className="kw-tl-band" style={delay}><span>{row.band}</span></li>;
          if (row.marker) {
            return (
              <li key={row.id} className="kw-tl-marker" style={delay}>
                <em className={`kw-mk kw-mk-${row.marker.tone}`}>{row.marker.text}</em>
              </li>
            );
          }
          if (row.fold) {
            return (
              <li key={row.id} className="kw-tl-marker" style={delay}>
                <em className="kw-mk kw-mk-quiet">{row.fold.count} empty raids · {row.fold.from}–{row.fold.to}</em>
              </li>
            );
          }
          const e = row.raid;
          const scorer = scorerOf(e);
          const mine = sideKey(e.team);
          const spoken = scorer === null ? 'no points' : `${names[scorer]} +${e.points[scorer]}`;
          const pill = scorer === null ? null : (
            <b className={`kw-pill kw-pill-${sideKey(scorer)} kw-tl-pill kw-tl-pill-${sideKey(scorer)}`} aria-hidden="true">+{e.points[scorer]}</b>
          );
          const own = scorer === e.team;
          return (
            <li key={row.id} className={`kw-tl-raid kw-tl-raid-${mine}`} style={delay} aria-label={`Raid ${e.number}: ${spoken}. Score ${e.score[0]} to ${e.score[1]}`}>
              <RaidLine e={e} names={names} roster={roster} halfMs={halfMs} muted={row.muted} pill={own ? pill : null} />
              {!own && pill}
              {!row.muted && <span className="kw-node" aria-hidden="true"><b>{e.score[0]}</b><i>–</i><b>{e.score[1]}</b></span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
KabaddiRaids.propTypes = {
  match: PropTypes.object.isRequired, story: PropTypes.array.isRequired, names: PropTypes.array.isRequired,
  roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
};
