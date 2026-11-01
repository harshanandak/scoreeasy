import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import {
  clockText, halfStory, halfTimeScore, liveNow, playerLabel, pointsBreakdown, raidStory, raidWords,
} from '../../../utils/kabaddiLiveModel';
import { HandUnderline, KitWash, SportBadge } from '../kit/KitParts';
import '../kit/kit.css';
import '../kit/live.css';
import './kabaddiWatch.css';

// Kabaddi live viewer, exploration k2 round 2 (notes: E:/tmp/kabaddi-k2/viewer/NOTES.md, "Round 2").
// Kit look (the Live tab's canvas, white cards, sport tile, team dots, green Live pill) over V-a's
// score bar, with the K2 scorer's mat row so viewer and scorer read alike. Read-only. Every number
// comes from kabaddiLiveModel.js, which folds the raid engine's state and journal.

const key = (team) => (team === 0 ? 'a' : 'b');
const halfName = (n) => (n === 1 ? '1st half' : '2nd half');
const ended = (phase) => ['finished', 'finishReview'].includes(phase);

function resultOf(live) {
  if (!ended(live.phase)) return null;
  const [a, b] = live.totals;
  if (a === b) return { winner: null, line: `Draw ${a}–${b}` };
  const winner = a > b ? 0 : 1;
  return { winner, line: `${live.names[winner]} win by ${Math.abs(a - b)}` };
}

const inOrder = (list) => (list.length <= 1 ? list.join('') : `${list[0]}, then ${list.slice(1).join(', ')}`);

/* ------------------------------------------------------------------ top: header, score bar, mat row */

function Header({ live, halfMins }) {
  const status = ended(live.phase) ? 'Full time' : live.phase === 'halfTime' ? 'Half time' : 'Live';
  return (
    <header className="kv-top">
      <SportBadge sportId="kabaddi" />
      <div className="kv-top-t">
        <h1>{live.names[0]} v {live.names[1]}</h1>
        <p>Kabaddi · 2 × {halfMins} min halves</p>
      </div>
      <span className={status === 'Live' ? 'kit-live-status kv-status' : 'kit-live-paused kv-status'}>
        {status === 'Live' && <i aria-hidden="true" />}{status}
      </span>
    </header>
  );
}
Header.propTypes = { live: PropTypes.object.isRequired, halfMins: PropTypes.number.isRequired };

function ScoreBar({ live, result }) {
  const mid = result ? ['Full time', 'FT'] : live.phase === 'halfTime' ? ['Half time', 'HT'] : [halfName(live.half), clockText(live.halfLeftMs)];
  const spoken = `${live.names[0]} ${live.totals[0]}, ${live.names[1]} ${live.totals[1]}. ${result ? result.line : `${mid[0]}, ${mid[1]} left.`}`;
  return (
    <section className="kv-score" aria-label="Score">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{spoken}</p>
      {[0, 1].map((team) => {
        const flag = result ? (result.winner === team ? 'Won' : null)
          : live.inPlay && live.raider === team ? (live.raid ? 'Raiding' : 'Raid next') : null;
        return (
          <div key={team} className={`kv-team kv-team-${key(team)}`} aria-hidden="true">
            <span className="kv-team-name">{live.names[team]}</span>
            <span className="kv-team-score">{live.totals[team]}</span>
            {flag ? <span className="kv-flag">{flag}</span> : <span className="kv-flag-gap" />}
          </div>
        );
      })}
      <div className="kv-clock" aria-hidden="true">
        <b>{mid[1]}</b>
        <small>{result || live.phase === 'halfTime' ? '' : mid[0]}</small>
      </div>
    </section>
  );
}
ScoreBar.propTypes = { live: PropTypes.object.isRequired, result: PropTypes.object };

/** The scorer's mat row: dots for the seven, the count, then who comes back first, by name. */
function MatRow({ live, roster }) {
  return (
    <section className="kv-mat" aria-label="On the mat">
      {[0, 1].map((team) => {
        const order = live.sittingOrder[team].map((slot) => playerLabel(roster, slot));
        return (
          <div key={team} className={`kv-side kv-side-${key(team)}`}>
            <span className="kv-dots" role="img" aria-label={`${live.names[team]}: ${live.mat[team]} of 7 on the mat`}>
              {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < live.mat[team] ? 'on' : undefined} />)}
              <b>{live.mat[team]}</b>
            </span>
            <span className="kv-next">{order.length ? <>Next in: <b>{inOrder(order)}</b></> : 'All 7 on the mat'}</span>
          </div>
        );
      })}
    </section>
  );
}
MatRow.propTypes = { live: PropTypes.object.isRequired, roster: PropTypes.array };

function Cues({ live }) {
  if (!live.inPlay || (!live.doOrDie && !live.superTackleOn)) return null;
  return (
    <div className="kv-cues">
      {live.doOrDie && <em className="kv-cue kv-cue-dod">Do or die · {live.names[live.raider]}</em>}
      {live.superTackleOn && <em className="kv-cue kv-cue-super">Super tackle on</em>}
    </div>
  );
}
Cues.propTypes = { live: PropTypes.object.isRequired };

/** The raid clock, only while a raid runs. */
function RaidBar({ live, roster }) {
  const { raid } = live;
  if (!raid) return null;
  const secs = Math.ceil(raid.leftMs / 1000);
  return (
    <section className={`kv-card kv-raid kv-raid-${key(raid.team)}`} aria-label="Raid in progress">
      <span className="kv-raid-t">
        <i className={`kit-live-team-dot kv-dot-${key(raid.team)}`} aria-hidden="true" />
        <span><b>{playerLabel(roster, raid.raiderSlot)}</b> raiding for {live.names[raid.team]}</span>
      </span>
      <b className="kv-raid-s">{secs}<small>s</small></b>
      <span className="kv-raid-track" aria-hidden="true"><i style={{ width: `${(raid.leftMs / 30000) * 100}%` }} /></span>
    </section>
  );
}
RaidBar.propTypes = { live: PropTypes.object.isRequired, roster: PropTypes.array };

/* ------------------------------------------------------------------ live tab */

/** Defender spots: evenly spaced behind the baulk line, bowed slightly towards the midline. */
function chain(team, n) {
  return Array.from({ length: n }, (_, i) => {
    const step = i - (n - 1) / 2;
    const fromMid = 30 - 1.2 * step * step;
    return { x: team === 0 ? 50 - fromMid : 50 + fromMid, y: 50 + step * 13 };
  });
}

function Court({ live, moment }) {
  const { raid } = live;
  // Between raids the next raider stays in the chain ("Raid next" is on the score card); during a
  // raid they are drawn on their own, across the midline.
  const raider = raid ? raid.team : null;
  const superHalf = live.superTackleOn ? live.defender : null;
  return (
    <section className="kv-card kv-court-card" aria-label="Court">
      <div className="kv-court" role="img" aria-label={`Court: ${live.names[0]} ${live.mat[0]} on the mat, ${live.names[1]} ${live.mat[1]} on the mat${raid ? `, ${live.names[raid.team]} raiding` : ''}`} data-moment={moment ? '' : undefined}>
        {[0, 1].map((team) => <i key={team} className={`kv-half kv-half-${key(team)}`} data-super={superHalf === team ? '' : undefined} />)}
        <i className="kv-ln kv-ln-mid" />
        <i className="kv-ln kv-baulk-a" />
        <i className="kv-ln kv-baulk-b" />
        {[0, 1].map((team) => chain(team, live.mat[team] - (team === raider ? 1 : 0)).map((p, i) => (
          <i key={`${team}-${i}`} className={`kv-tok kv-tok-${key(team)}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
        )))}
        {raider !== null && (
          <i className={`kv-tok kv-tok-${key(raider)} kv-raider`} style={{ left: `${raider === 0 ? 66 : 34}%`, top: '50%' }} />
        )}
      </div>
      {moment}
    </section>
  );
}
Court.propTypes = { live: PropTypes.object.isRequired, moment: PropTypes.node };

function leadLine(e, teamNames) {
  const after = e.score[0] - e.score[1];
  const before = e.scoreBefore[0] - e.scoreBefore[1];
  const score = `${e.score[0]}–${e.score[1]}`;
  if (after === 0) return `All square · ${score}`;
  const leader = after > 0 ? 0 : 1;
  if (Math.sign(before) !== Math.sign(after)) return `${teamNames[leader]} take the lead · ${score}`;
  return `${teamNames[leader]} lead ${Math.abs(after) < Math.abs(before) ? 'cut' : 'up'} to ${Math.abs(after)} · ${score}`;
}

/** Only a super tackle or an all out gets the hand-drawn layer. */
function Moment({ entry, teamNames, roster }) {
  if (!entry || (entry.allOut === null && !entry.superTackle)) return null;
  const allOut = entry.allOut !== null;
  const team = allOut ? 1 - entry.allOut : 1 - entry.team;
  const line = allOut
    ? `Every ${teamNames[entry.allOut]} player is out: +2, and all seven come back on.`
    : `${entry.defendersAtStart} defenders stopped ${playerLabel(roster, entry.raiderSlot)}${entry.doOrDie ? '’s do-or-die raid' : ''}.`;
  return (
    <div className={`kv-moment kv-moment-${key(team)}`} role="status">
      <h2><HandUnderline>{allOut ? 'All out!' : 'Super tackle!'}</HandUnderline></h2>
      <p className="kv-moment-who"><i className={`kit-live-team-dot kv-dot-${key(team)}`} aria-hidden="true" />{teamNames[team]} <b>+{entry.points[team]}</b></p>
      <p>{line}</p>
      <p className="kv-moment-lead">{leadLine(entry, teamNames)}</p>
    </div>
  );
}
Moment.propTypes = { entry: PropTypes.object, teamNames: PropTypes.array.isRequired, roster: PropTypes.array };

function LastRaid({ entry, teamNames, roster, total, onAll }) {
  if (!entry) return null;
  const words = raidWords(entry, teamNames);
  const raider = playerLabel(roster, entry.raiderSlot);
  const outs = entry.lostSlots[1 - entry.team].map((slot) => playerLabel(roster, slot));
  // raidWords speaks of "the Strikers raider"; the viewer knows who it was and whom they touched.
  let line = words.line.replace(new RegExp(`^${teamNames[entry.team]} (do-or-die )?raider`), (_, dod) => `${raider}${dod ? ' (do or die)' : ''}`);
  if (entry.outcome === 'touch' && outs.length) line = line.replace(/touched \d+ defenders?/, `touched ${outs.join(', ')}`);
  return (
    <section className="kv-card kv-last" aria-label="Last raid">
      <div className="kv-card-head">
        <h2>Last raid</h2>
        <span>Raid {entry.number} · {halfName(entry.half)} {clockText(entry.halfLeftMs)}</span>
      </div>
      <div className="kv-last-row">
        <div className="kv-last-text">
          <b>{words.headline}</b>
          <p>{line}</p>
          {words.extra.map((x) => <p key={x} className="kv-soft">{x}</p>)}
        </div>
        <span className="kv-last-score">{entry.score[0]}–{entry.score[1]}</span>
      </div>
      <button type="button" className="kv-all" onClick={onAll}>See all {total} raids</button>
    </section>
  );
}
LastRaid.propTypes = {
  entry: PropTypes.object, teamNames: PropTypes.array.isRequired, roster: PropTypes.array,
  total: PropTypes.number.isRequired, onAll: PropTypes.func.isRequired,
};

/* ------------------------------------------------------------------ raids tab */

function outcomeWords(e) {
  const bonus = e.bonus ? ' + bonus' : '';
  if (e.outcome === 'touch') return `${e.touches} touch${e.touches === 1 ? '' : 'es'}${bonus}`;
  if (e.outcome === 'bonus') return 'Bonus';
  if (e.outcome === 'tackled') return e.superTackle ? 'Super tackle' : `Tackled${bonus}`;
  if (e.outcome === 'selfOut') return 'Raider out';
  if (e.outcome === 'doOrDieFailure') return e.superTackle ? 'Do or die lost · super tackle' : 'Do or die lost';
  if (e.outcome === 'empty') return 'Empty';
  return 'Referee ruling';
}

function RaidRow({ e, teamNames, roster }) {
  const outs = e.lostSlots[1 - e.team].map((slot) => playerLabel(roster, slot));
  const scorer = e.points[0] === e.points[1] ? null : e.points[0] > e.points[1] ? 0 : 1;
  return (
    <li className="kv-rrow">
      <i className={`kit-live-team-dot kv-dot-${key(e.team)}`} aria-hidden="true" />
      <span className="kv-rrow-body">
        <b>{outcomeWords(e)}{outs.length > 0 && <span className="kv-soft"> · {outs.join(', ')} out</span>}</b>
        <small>
          Raid {e.number} · {playerLabel(roster, e.raiderSlot)}, {teamNames[e.team]}
          {e.doOrDie && <em className="kv-tag kv-tag-dod">Do or die</em>}
          {e.superRaid && <em className="kv-tag kv-tag-super">Super raid</em>}
        </small>
      </span>
      <span className="kv-rrow-r">
        <b>{e.score[0]}–{e.score[1]}</b>
        {scorer === null
          ? <small className="kv-soft">0</small>
          : <small className={`kv-pts kv-pts-${key(scorer)}`}>{[0, 1].filter((t) => e.points[t]).map((t) => `+${e.points[t]}`).join(' ')}</small>}
      </span>
    </li>
  );
}
RaidRow.propTypes = { e: PropTypes.object.isRequired, teamNames: PropTypes.array.isRequired, roster: PropTypes.array };

function Raids({ match, story, teamNames, roster }) {
  const ht = halfTimeScore(match);
  const newestFirst = [...story].reverse();
  const items = [];
  if (ended(match.state.phase)) items.push(<li key="ft" className="kv-band">Full time · {story.at(-1).score[0]}–{story.at(-1).score[1]}</li>);
  newestFirst.forEach((e, i) => {
    if (e.allOut !== null) items.push(<li key={`ao-${e.id}`} className="kv-band kv-band-big">All out on {teamNames[e.allOut]} · {teamNames[1 - e.allOut]} +2</li>);
    items.push(<RaidRow key={e.id} e={e} teamNames={teamNames} roster={roster} />);
    if (ht && e.half === 2 && newestFirst[i + 1]?.half === 1) items.push(<li key="ht" className="kv-band">Half time · {ht[0]}–{ht[1]}</li>);
  });
  return (
    <section aria-label="All raids">
      <div className="kit-sec"><h2>All raids</h2><span>Newest first</span></div>
      <ol className="kv-card kv-rows">{items}</ol>
    </section>
  );
}
Raids.propTypes = { match: PropTypes.object.isRequired, story: PropTypes.array.isRequired, teamNames: PropTypes.array.isRequired, roster: PropTypes.array };

/* ------------------------------------------------------------------ stats */

function Points({ match, teamNames, totals }) {
  const pts = pointsBreakdown(match);
  const rows = [
    ['Raid points', 'raid', (p) => (p.bonus ? `incl. ${p.bonus} bonus` : '')],
    ['Tackle points', 'tackle', (p) => (p.superTackle ? `incl. ${p.superTackle} super` : '')],
    ['All out points', 'allOut', () => ''],
    ['Extras', 'extras', () => ''],
  ].filter(([, k]) => k !== 'extras' || pts[0].extras + pts[1].extras > 0);
  const max = Math.max(1, ...rows.flatMap(([, k]) => [pts[0][k], pts[1][k]]));
  return (
    <section aria-label="Where the points came from">
      <div className="kit-sec"><h2>Where the points came from</h2></div>
      <table className="kv-card kv-points">
        <thead>
          <tr>
            <th scope="col"><span className="kv-th"><i className="kit-live-team-dot kv-dot-a" aria-hidden="true" />{teamNames[0]}</span></th>
            <th scope="col"><span className="sr-only">Kind</span></th>
            <th scope="col"><span className="kv-th">{teamNames[1]}<i className="kit-live-team-dot kv-dot-b" aria-hidden="true" /></span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, k, note]) => (
            <tr key={k}>
              <td><b>{pts[0][k]}</b>{note(pts[0]) && <small>{note(pts[0])}</small>}</td>
              <th scope="row">
                {label}
                <span className="kv-bars" aria-hidden="true">
                  <i className="kv-bar-a" style={{ width: `${(pts[0][k] / max) * 50}%` }} />
                  <i className="kv-bar-b" style={{ width: `${(pts[1][k] / max) * 50}%` }} />
                </span>
              </th>
              <td><b>{pts[1][k]}</b>{note(pts[1]) && <small>{note(pts[1])}</small>}</td>
            </tr>
          ))}
          <tr className="kv-points-total">
            <td><b>{totals[0]}</b></td>
            <th scope="row">Total</th>
            <td><b>{totals[1]}</b></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
Points.propTypes = { match: PropTypes.object.isRequired, teamNames: PropTypes.array.isRequired, totals: PropTypes.array.isRequired };

function Halves({ match, teamNames, live }) {
  const halves = halfStory(match);
  const done = ended(live.phase);
  const allOuts = [0, 1].map((t) => halves.reduce((n, h) => n + h.allOuts[t], 0));
  const supers = [0, 1].map((t) => halves.reduce((n, h) => n + h.superTackles[t], 0));
  const cols = [1, 2].map((n) => halves.find((h) => h.half === n));
  return (
    <section aria-label="Half by half">
      <div className="kit-sec"><h2>Half by half</h2><span>{done ? 'Full time' : `${halfName(live.half)} so far`}</span></div>
      <div className="kv-card kv-halves-card">
        <table className="kv-halves">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Team</span></th>
              <th scope="col">1st</th>
              <th scope="col">2nd</th>
              <th scope="col">{done ? 'Final' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((t) => (
              <tr key={t}>
                <th scope="row"><span className="kv-th"><i className={`kit-live-team-dot kv-dot-${key(t)}`} aria-hidden="true" />{teamNames[t]}</span></th>
                {cols.map((h, i) => <td key={i}>{h ? h.points[t] : '–'}</td>)}
                <td><b>{live.totals[t]}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="kv-foot">All outs {allOuts[0]}–{allOuts[1]} · Super tackles {supers[0]}–{supers[1]}</p>
      </div>
    </section>
  );
}
Halves.propTypes = { match: PropTypes.object.isRequired, teamNames: PropTypes.array.isRequired, live: PropTypes.object.isRequired };

function Result({ result, live, raids }) {
  return (
    <section className="kv-card kv-result" aria-label="Result">
      <h2>{result.line}</h2>
      <p>{live.totals[0]}–{live.totals[1]} · {raids} raids</p>
    </section>
  );
}
Result.propTypes = { result: PropTypes.object.isRequired, live: PropTypes.object.isRequired, raids: PropTypes.number.isRequired };

/* ------------------------------------------------------------------ page */

export default function KabaddiWatch({ match, now, roster, initialTab = 'live', showMoment = false }) {
  const [tab, setTab] = useState(initialTab);
  const vars = useMemo(() => {
    const [A, B] = match.state.teams.map((t) => t.colours);
    return { ...teamColourVars(A?.core ? { A, B } : deriveTeamColours()), ...sportIdentityVars('kabaddi') };
  }, [match]);
  const live = liveNow(match, now);
  const story = raidStory(match);
  const result = resultOf(live);
  const teamNames = live.names;
  const last = story.at(-1);
  const tabs = result ? [['live', 'Result'], ['raids', 'Raids']] : [['live', 'Live'], ['raids', 'Raids'], ['stats', 'Stats']];
  const current = tabs.some(([id]) => id === tab) ? tab : 'live';

  let body;
  if (current === 'raids') {
    body = <Raids match={match} story={story} teamNames={teamNames} roster={roster} />;
  } else if (current === 'stats' || result) {
    body = (
      <>
        {result && <Result result={result} live={live} raids={story.length} />}
        <Halves match={match} teamNames={teamNames} live={live} />
        <Points match={match} teamNames={teamNames} totals={live.totals} />
      </>
    );
  } else {
    body = (
      <>
        <Court live={live} moment={showMoment ? <Moment entry={last} teamNames={teamNames} roster={roster} /> : null} />
        <LastRaid entry={last} teamNames={teamNames} roster={roster} total={story.length} onAll={() => setTab('raids')} />
      </>
    );
  }

  return (
    <div className="kit-screen kv" style={vars}>
      <KitWash from={sportIdentity('kabaddi')?.tint} to={sportIdentity('kabaddi')?.tint} />
      <Header live={live} halfMins={Math.round(match.state.rules.halfMs / 60000)} />
      <ScoreBar live={live} result={result} />
      {!result && <MatRow live={live} roster={roster} />}
      <Cues live={live} />
      <RaidBar live={live} roster={roster} />
      <div className="kit-seg kv-tabs" role="tablist" aria-label="Match views" style={{ '--kit-seg-cols': tabs.length }}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={current === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <main className="kv-body">{body}</main>
    </div>
  );
}

KabaddiWatch.propTypes = {
  match: PropTypes.object.isRequired,
  now: PropTypes.number.isRequired,
  roster: PropTypes.array,
  initialTab: PropTypes.oneOf(['live', 'raids', 'stats']),
  showMoment: PropTypes.bool,
};
