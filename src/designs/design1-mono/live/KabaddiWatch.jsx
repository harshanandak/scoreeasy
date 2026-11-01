import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import {
  clockText, halfStory, halfTimeScore, liveNow, playerLabel, pointsBreakdown, raidStory,
} from '../../../utils/kabaddiLiveModel';
import { HandUnderline } from '../kit/KitParts';
import '../kit/kit.css';
import './kabaddiWatch.css';

// Kabaddi on the public live page (/live/:token): exploration k2 (notes: E:/tmp/kabaddi-k2/viewer/NOTES.md).
// The frame is the shipped watch page (site bar, pinned scorebug, tab bar); only the body is
// kabaddi. Read-only. Every number comes from kabaddiLiveModel.js, which folds the raid engine.
//   layout="tabs"   — Live / Raids / Stats under the pinned scorebug (the watch page's own pattern)
//   layout="scroll" — one page: court, raid timeline, where the points came from, half by half

const key = (team) => (team === 0 ? 'a' : 'b');
const halfName = (n) => (n === 1 ? '1st half' : '2nd half');
const TABS = [['live', 'Live'], ['raids', 'Raids'], ['stats', 'Stats']];

function resultOf(live) {
  if (!['finished', 'finishReview'].includes(live.phase)) return null;
  const [a, b] = live.totals;
  if (a === b) return { winner: null, line: `Draw ${a}–${b}` };
  const winner = a > b ? 0 : 1;
  return { winner, line: `${live.names[winner]} win by ${Math.abs(a - b)}` };
}

function names(list) {
  if (list.length <= 1) return list.join('');
  return `${list[0]}, then ${list.slice(1).join(', ')}`;
}

/* ------------------------------------------------------------------ frame (as MonoWatchMatch) */

function SiteBar() {
  return (
    <nav className="kw-site" aria-label="Site">
      <a href="/app" className="kw-site-brand" aria-label="Score Easy home">Score Easy</a>
      <a href="/app" className="kw-site-open font-mono">Open app</a>
    </nav>
  );
}

function Scorebug({ live, result, roster }) {
  const { raid } = live;
  const raidSecs = raid ? Math.ceil(raid.leftMs / 1000) : 0;
  const period = result ? `Full time · ${result.line}`
    : live.phase === 'halfTime' ? 'Half time'
      : `${halfName(live.half)} · ${clockText(live.halfLeftMs)} left`;
  const status = result ? 'FINAL' : 'LIVE';
  const spoken = `${live.names[0]} ${live.totals[0]}, ${live.names[1]} ${live.totals[1]}. ${period}.${raid ? ` ${live.names[raid.team]} raiding, ${raidSecs} seconds left.` : ''}`;
  return (
    <header className="kw-bug" aria-label="Match scorebug">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{spoken}</p>
      <div className="kw-bug-row" aria-hidden="true">
        {[0, 1].map((team) => (
          <span key={team} className={`kw-bug-name kw-bug-name-${key(team)}`} data-won={result?.winner === team ? '' : undefined}>
            <i className={`kw-dot kw-dot-${key(team)}`} />
            <span>{result?.winner === team ? `▸ ${live.names[team]}` : live.names[team]}</span>
          </span>
        ))}
        <span className="kw-bug-score font-mono">
          <span>{live.totals[0]}</span><span className="kw-bug-dash">–</span><span>{live.totals[1]}</span>
        </span>
      </div>
      <div className="kw-bug-line" aria-hidden="true">
        <p className="kw-eyebrow">{period}</p>
        <span className="kw-status font-mono" data-final={result ? '' : undefined}><i />{status}</span>
      </div>
      {raid && (
        <div className={`kw-raid kw-raid-${key(raid.team)}`} aria-hidden="true">
          <span className="kw-raid-t">
            <b>{live.names[raid.team]} raiding</b>
            <small>{playerLabel(roster, raid.raiderSlot)}</small>
          </span>
          <b className="kw-raid-s font-mono">0:{String(raidSecs).padStart(2, '0')}</b>
          <span className="kw-raid-track"><i style={{ width: `${(raid.leftMs / 30000) * 100}%` }} /></span>
        </div>
      )}
      {live.inPlay && (
        <div className="kw-cues" aria-hidden="true">
          {!raid && <span className="kw-next"><i className={`kw-dot kw-dot-${key(live.raider)}`} />{live.names[live.raider]} raid next</span>}
          {(live.doOrDie || live.superTackleOn) && (
            <span className="kw-cue-chips">
              {live.doOrDie && <em className="kw-chip kw-chip-danger">Do or die</em>}
              {live.superTackleOn && <em className="kw-chip kw-chip-gold">Super tackle on</em>}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
Scorebug.propTypes = { live: PropTypes.object.isRequired, result: PropTypes.object, roster: PropTypes.array };

function TabBar({ tab, onTab, ended }) {
  // At full time the live view becomes the result, and Stats folds into it.
  const tabs = ended ? [['live', 'Result'], ['raids', 'Raids']] : TABS;
  return (
    <div className="kw-tabs" role="tablist" aria-label="Match views">
      {tabs.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)} className="kw-tab font-mono">
          {label}
        </button>
      ))}
    </div>
  );
}
TabBar.propTypes = { tab: PropTypes.string.isRequired, onTab: PropTypes.func.isRequired, ended: PropTypes.bool };

/* ------------------------------------------------------------------ the court (from V-a) */

/** Defender spots: evenly spaced behind the baulk line, bowed slightly towards the midline. */
function chain(team, n) {
  return Array.from({ length: n }, (_, i) => {
    const step = i - (n - 1) / 2; // -3..3 for a full side
    const fromMid = 30 - 1.2 * step * step;
    return { x: team === 0 ? 50 - fromMid : 50 + fromMid, y: 50 + step * 14 };
  });
}

function Court({ live, roster }) {
  const { raid } = live;
  const raider = live.raider;
  const raiderAt = raid ? { x: raider === 0 ? 66 : 34 } : { x: raider === 0 ? 44 : 56 };
  const superHalf = live.superTackleOn ? live.defender : null;
  const sittingWords = (team) => {
    const order = live.sittingOrder[team].map((slot) => playerLabel(roster, slot));
    return order.length ? `Next in: ${names(order)}` : 'All 7 on';
  };
  return (
    <section className="kw-court-wrap" aria-label="On the mat">
      <div className="kw-court" role="img" aria-label={`${live.names[0]} ${live.mat[0]} on the mat, ${live.names[1]} ${live.mat[1]} on the mat${raid ? `, ${live.names[raid.team]} raiding` : ''}`}>
        {[0, 1].map((team) => <i key={team} className={`kw-half kw-half-${key(team)}`} data-super={superHalf === team ? '' : undefined} />)}
        <i className="kw-ln kw-ln-mid" />
        <i className="kw-ln kw-ln-baulk kw-baulk-a" />
        <i className="kw-ln kw-ln-baulk kw-baulk-b" />
        {[0, 1].map((team) => {
          const spots = chain(team, live.mat[team] - (team === raider ? 1 : 0));
          return spots.map((p, i) => (
            <i key={`${team}-${i}`} className={`kw-tok kw-tok-${key(team)}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
          ));
        })}
        <i className={`kw-tok kw-tok-${key(raider)} kw-raider`} data-raiding={raid ? '' : undefined} style={{ left: `${raiderAt.x}%`, top: '50%' }} />
      </div>
      <div className="kw-mat">
        {[0, 1].map((team) => (
          <p key={team} className={`kw-mat-${key(team)}`}>
            <b className="font-mono">{live.mat[team]}</b> on the mat
            <small>{sittingWords(team)}</small>
          </p>
        ))}
      </div>
    </section>
  );
}
Court.propTypes = { live: PropTypes.object.isRequired, roster: PropTypes.array };

/** Only a super tackle or an all out gets the hand-drawn layer. */
function Moment({ entry, names: teamNames, roster }) {
  if (!entry || (entry.allOut === null && !entry.superTackle)) return null;
  const allOut = entry.allOut !== null;
  const team = allOut ? 1 - entry.allOut : 1 - entry.team;
  const after = entry.score[0] - entry.score[1];
  const before = entry.scoreBefore[0] - entry.scoreBefore[1];
  const leader = after > 0 ? 0 : 1;
  const lead = after === 0 ? 'All square'
    : Math.sign(before) !== Math.sign(after) ? `${teamNames[leader]} take the lead`
      : `${teamNames[leader]} lead ${Math.abs(after) < Math.abs(before) ? 'cut' : 'up'} to ${Math.abs(after)}`;
  const raiderName = playerLabel(roster, entry.raiderSlot);
  const line = allOut
    ? `Every ${teamNames[entry.allOut]} player is out. +2, and all seven come back on.`
    : `${entry.defendersAtStart} defenders stopped ${raiderName}${entry.doOrDie ? '’s do-or-die raid' : ''}.`;
  return (
    <section className={`kw-moment kw-moment-${key(team)}`} role="status">
      <h2><HandUnderline>{allOut ? 'All out!' : 'Super tackle!'}</HandUnderline></h2>
      <p><b>{teamNames[team]} +{entry.points[team]}</b> · {line}</p>
      <p className="kw-moment-lead">{lead} · {entry.score[0]}–{entry.score[1]}</p>
    </section>
  );
}
Moment.propTypes = { entry: PropTypes.object, names: PropTypes.array.isRequired, roster: PropTypes.array };

/* ------------------------------------------------------------------ raid timeline (from S2) */

function outcomeWords(e) {
  const bonus = e.bonus ? ' + bonus' : '';
  if (e.outcome === 'touch') return `${e.touches} touch${e.touches === 1 ? '' : 'es'}${bonus}`;
  if (e.outcome === 'bonus') return 'Bonus';
  if (e.outcome === 'tackled') return e.superTackle ? 'Tackled · super tackle' : `Tackled${bonus}`;
  if (e.outcome === 'selfOut') return 'Raider out';
  if (e.outcome === 'doOrDieFailure') return e.superTackle ? 'Do or die lost · super tackle' : 'Do or die lost';
  if (e.outcome === 'empty') return 'Empty';
  return 'Referee ruling';
}

function RaidRow({ e, teamNames, roster }) {
  const defender = 1 - e.team;
  const outs = e.lostSlots[defender].map((slot) => playerLabel(roster, slot));
  const raider = playerLabel(roster, e.raiderSlot);
  return (
    <li className={`kw-row kw-row-${key(e.team)}`}>
      <span className="kw-row-n font-mono">{e.number}</span>
      <span className="kw-row-body">
        <small>{teamNames[e.team]}{raider ? ` · ${raider}` : ''}</small>
        <b>{outcomeWords(e)}{outs.length > 0 && <span className="kw-row-outs"> · {outs.join(', ')} out</span>}</b>
        {(e.doOrDie || e.superRaid) && (
          <span className="kw-row-tags">
            {e.doOrDie && <em className="kw-chip kw-chip-danger">Do or die</em>}
            {e.superRaid && <em className="kw-chip kw-chip-gold">Super raid</em>}
          </span>
        )}
      </span>
      <span className="kw-row-pts">
        {[0, 1].filter((t) => e.points[t] > 0).map((t) => <b key={t} className={`kw-pill kw-pill-${key(t)}`}>+{e.points[t]}</b>)}
        {e.points[0] + e.points[1] === 0 && <span className="kw-pill-zero font-mono">0</span>}
      </span>
      <span className="kw-row-score font-mono">{e.score[0]}–{e.score[1]}</span>
    </li>
  );
}
RaidRow.propTypes = { e: PropTypes.object.isRequired, teamNames: PropTypes.array.isRequired, roster: PropTypes.array };

function Band({ children }) {
  return <li className="kw-band">{children}</li>;
}
Band.propTypes = { children: PropTypes.node.isRequired };

function Timeline({ match, story, teamNames, roster, limit, title, onAll }) {
  const ht = halfTimeScore(match);
  const ended = ['finished', 'finishReview'].includes(match.state.phase);
  const newestFirst = [...story].reverse();
  const shown = limit ? newestFirst.slice(0, limit) : newestFirst;
  const items = [];
  if (ended && !limit) items.push(<Band key="ft">Full time · {story.at(-1).score[0]}–{story.at(-1).score[1]}</Band>);
  shown.forEach((e, i) => {
    if (e.allOut !== null) items.push(<Band key={`ao-${e.id}`}>All out on {teamNames[e.allOut]} · {teamNames[1 - e.allOut]} +2 · back to 7</Band>);
    items.push(<RaidRow key={e.id} e={e} teamNames={teamNames} roster={roster} />);
    const older = shown[i + 1];
    if (ht && e.half === 2 && older?.half === 1) items.push(<Band key="ht">Half time · {ht[0]}–{ht[1]}</Band>);
  });
  return (
    <section className="kw-sec" aria-label="Raids">
      <div className="kw-sec-head"><h2 className="kw-eyebrow">{title}</h2><span className="kw-eyebrow">Newest first</span></div>
      <ol className="kw-rows">{items}</ol>
      {limit && story.length > limit && (
        <button type="button" className="kw-more font-mono" onClick={onAll}>All {story.length} raids</button>
      )}
    </section>
  );
}
Timeline.propTypes = {
  match: PropTypes.object.isRequired, story: PropTypes.array.isRequired, teamNames: PropTypes.array.isRequired,
  roster: PropTypes.array, limit: PropTypes.number, title: PropTypes.string.isRequired, onAll: PropTypes.func,
};

/* ------------------------------------------------------------------ stats (from V-b, reworked) */

function Points({ match, teamNames, totals }) {
  const pts = pointsBreakdown(match);
  const rows = [
    ['Raid', 'raid', (p) => (p.bonus ? `${p.bonus} bonus` : '')],
    ['Tackle', 'tackle', (p) => (p.superTackle ? `${p.superTackle} super` : '')],
    ['All out', 'allOut', () => ''],
    ['Extras', 'extras', () => ''],
  ].filter(([, k]) => k !== 'extras' || pts[0].extras + pts[1].extras > 0);
  const max = Math.max(1, ...rows.flatMap(([, k]) => [pts[0][k], pts[1][k]]));
  return (
    <section className="kw-sec" aria-label="Where the points came from">
      <div className="kw-sec-head"><h2 className="kw-eyebrow">Where the points came from</h2></div>
      <table className="kw-points">
        <thead>
          <tr>
            <th scope="col"><i className="kw-dot kw-dot-a" />{teamNames[0]}</th>
            <th scope="col"><span className="sr-only">Kind</span></th>
            <th scope="col">{teamNames[1]}<i className="kw-dot kw-dot-b" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, k, note]) => (
            <tr key={k}>
              <td className="font-mono"><b>{pts[0][k]}</b>{note(pts[0]) && <small>incl. {note(pts[0])}</small>}</td>
              <th scope="row">
                {label}
                <span className="kw-bars" aria-hidden="true">
                  <i className="kw-bar-a" style={{ width: `${(pts[0][k] / max) * 50}%` }} />
                  <i className="kw-bar-b" style={{ width: `${(pts[1][k] / max) * 50}%` }} />
                </span>
              </th>
              <td className="font-mono"><b>{pts[1][k]}</b>{note(pts[1]) && <small>incl. {note(pts[1])}</small>}</td>
            </tr>
          ))}
          <tr className="kw-points-total">
            <td className="font-mono"><b>{totals[0]}</b></td>
            <th scope="row">Total</th>
            <td className="font-mono"><b>{totals[1]}</b></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
Points.propTypes = { match: PropTypes.object.isRequired, teamNames: PropTypes.array.isRequired, totals: PropTypes.array.isRequired };

function Halves({ match, teamNames, live }) {
  const halves = halfStory(match);
  const ended = ['finished', 'finishReview'].includes(live.phase);
  const allOuts = [0, 1].map((t) => halves.reduce((n, h) => n + h.allOuts[t], 0));
  const supers = [0, 1].map((t) => halves.reduce((n, h) => n + h.superTackles[t], 0));
  const cols = [1, 2].map((n) => halves.find((h) => h.half === n));
  const label = (n) => halfName(n).replace(' half', '');
  const aside = ended ? 'Full time' : live.half === 2 ? '2nd half so far' : '1st half so far';
  return (
    <section className="kw-sec" aria-label="Half by half">
      <div className="kw-sec-head"><h2 className="kw-eyebrow">Half by half</h2><span className="kw-eyebrow">{aside}</span></div>
      <table className="kw-halves font-mono">
        <thead>
          <tr>
            <th scope="col">Team</th>
            {[1, 2].map((n) => <th key={n} scope="col">{label(n)}</th>)}
            <th scope="col">{ended ? 'Final' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1].map((t) => (
            <tr key={t}>
              <th scope="row"><i className={`kw-dot kw-dot-${key(t)}`} />{teamNames[t]}</th>
              {cols.map((h, i) => <td key={i}>{h ? h.points[t] : '–'}</td>)}
              <td><b>{live.totals[t]}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="kw-foot">All outs {allOuts[0]}–{allOuts[1]} · Super tackles {supers[0]}–{supers[1]}</p>
    </section>
  );
}
Halves.propTypes = { match: PropTypes.object.isRequired, teamNames: PropTypes.array.isRequired, live: PropTypes.object.isRequired };

/* ------------------------------------------------------------------ page */

export default function KabaddiWatch({ match, now, roster, layout = 'tabs', initialTab = 'live', showMoment = false }) {
  const [tab, setTab] = useState(initialTab);
  const vars = useMemo(() => {
    const [A, B] = match.state.teams.map((t) => t.colours);
    return teamColourVars(A?.core ? { A, B } : deriveTeamColours());
  }, [match]);
  const live = liveNow(match, now);
  const story = raidStory(match);
  const result = resultOf(live);
  const teamNames = live.names;
  const last = story.at(-1);
  const common = { match, story, teamNames, roster };

  const halves = <Halves match={match} teamNames={teamNames} live={live} />;
  const points = <Points match={match} teamNames={teamNames} totals={live.totals} />;
  const court = (
    <>
      {showMoment && <Moment entry={last} names={teamNames} roster={roster} />}
      <Court live={live} roster={roster} />
    </>
  );

  let body;
  if (result) {
    // Full time: the result first (half by half, where the points came from), then the raids.
    if (layout === 'scroll') body = <>{halves}{points}<Timeline {...common} title="Raids" limit={6} onAll={() => {}} /></>;
    else if (tab === 'raids') body = <Timeline {...common} title="All raids" />;
    else body = <>{halves}{points}</>;
  } else if (layout === 'scroll') {
    body = <>{court}<Timeline {...common} title="Raids" limit={6} onAll={() => {}} />{points}{halves}</>;
  } else if (tab === 'live') {
    body = <>{court}<Timeline {...common} title="Latest raids" limit={3} onAll={() => setTab('raids')} /></>;
  } else if (tab === 'raids') {
    body = <Timeline {...common} title="All raids" />;
  } else {
    body = <>{points}{halves}</>;
  }

  return (
    <div className="kw-page" style={vars}>
      <SiteBar />
      <div className="kw-sticky">
        <Scorebug live={live} result={result} roster={roster} />
        {layout === 'tabs' && <TabBar tab={tab} onTab={setTab} ended={Boolean(result)} />}
      </div>
      <main className="kw-main">{body}</main>
    </div>
  );
}

KabaddiWatch.propTypes = {
  match: PropTypes.object.isRequired,
  now: PropTypes.number.isRequired,
  roster: PropTypes.array,
  layout: PropTypes.oneOf(['tabs', 'scroll']),
  initialTab: PropTypes.oneOf(['live', 'raids', 'stats']),
  showMoment: PropTypes.bool,
};
