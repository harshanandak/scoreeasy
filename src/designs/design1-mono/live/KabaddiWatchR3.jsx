import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import {
  clockText, halfStory, halfTimeScore, liveNow, playerLabel, pointsBreakdown, raidStory,
} from '../../../utils/kabaddiLiveModel';
import { HandUnderline, KitWash, SportBadge } from '../kit/KitParts';
import '../kit/kit.css';
import '../kit/live.css';
import './kabaddiWatchR3.css';

// Kabaddi live viewer, exploration k2 round 3 (notes: E:/tmp/kabaddi-k2/viewer/NOTES.md, "Round 3").
// Kit look. The score strip is the K2 scorer's round 3 header (KabaddiHeader.jsx on
// explore/kabaddi-k2-scorer) so scorer and viewer read alike, with PKL's seven player icons under the
// team name. The Raids tab is one quiet card per raid in the shape of PKL's match centre. Read-only.
// Every number comes from kabaddiLiveModel.js, which folds the raid engine's state and journal.

const key = (team) => (team === 0 ? 'a' : 'b');
const halfName = (n) => (n === 1 ? '1st half' : '2nd half');
const ended = (phase) => ['finished', 'finishReview'].includes(phase);
const list = (names) => names.join(', ');

function resultOf(live) {
  if (!ended(live.phase)) return null;
  const [a, b] = live.totals;
  if (a === b) return { winner: null, line: 'Draw', margin: 0 };
  const winner = a > b ? 0 : 1;
  return { winner, line: `${live.names[winner]} win by ${Math.abs(a - b)}`, margin: Math.abs(a - b) };
}

/* ------------------------------------------------------------------ top: header, score strip */

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

/** PKL's strip: seven player icons, bright on the mat, dark out. */
function Pips({ on }) {
  return (
    <span className="kv-pips" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <svg key={i} viewBox="0 0 10 14" className={i < on ? 'on' : undefined}>
          <circle cx="5" cy="3.1" r="2.7" />
          <path d="M0.6 14v-3.4a4.4 4.4 0 0 1 8.8 0V14z" />
        </svg>
      ))}
    </span>
  );
}
Pips.propTypes = { on: PropTypes.number.isRequired };

/**
 * The scorer's header, as a viewer sees it: two wide solid team cards (raider mark and, on a do-or-die
 * raid, the "Do or die" pill on the raiding team's name bar), a centre column with the half, the match
 * clock and the raid clock, and under each card who comes back first.
 */
function ScoreStrip({ live, result, roster, outs }) {
  const raiderTeam = live.inPlay ? live.raider : null;
  const mid = result ? ['Full time', 'FT'] : live.phase === 'halfTime' ? ['Half time', 'HT'] : [halfName(live.half), clockText(live.halfLeftMs)];
  const spoken = `${live.names[0]} ${live.totals[0]}, ${live.names[1]} ${live.totals[1]}. ${result ? result.line : `${mid[0]}, ${mid[1]} left.`}`;
  const secs = live.raid ? Math.ceil(live.raid.leftMs / 1000) : null;
  return (
    <>
      <section className="kv-strip" aria-label="Score">
        <p className="sr-only" aria-live="polite" aria-atomic="true">{spoken}</p>
        {[0, 1].map((team) => {
          const raiding = raiderTeam === team;
          const dod = raiding && live.doOrDie;
          return (
            <div key={team} className={`kv-team kv-team-${key(team)}`} aria-hidden="true">
              <span className="kv-name">
                {raiding && <i className="kv-mark" />}
                {dod ? <em className="kv-dod">Do or die</em> : <span className="kv-name-text">{live.names[team]}</span>}
              </span>
              {result
                ? (result.winner === team ? <span className="kv-won">Won</span> : <span className="kv-pips-gap" />)
                : <Pips on={live.mat[team]} />}
              <span className="kv-score">{live.totals[team]}</span>
            </div>
          );
        })}
        <div className="kv-mid" aria-hidden="true">
          <small>{result || live.phase === 'halfTime' ? '' : mid[0]}</small>
          <b>{mid[1]}</b>
          {live.raid
            ? <span className={`kv-rpill kv-rpill-${key(live.raid.team)}`}>Raid {secs}s</span>
            : live.inPlay && <small className="kv-raidno">Raid {live.nextRaidNumber}</small>}
        </div>
      </section>
      {!result && (
        <div className="kv-next-row" aria-label="On the mat">
          {[0, 1].map((team) => {
            const order = live.sittingOrder[team].map((slot) => playerLabel(roster, slot));
            return (
              <div key={team} className={`kv-side kv-side-${key(team)}`} aria-label={`${live.names[team]}: ${live.mat[team]} of 7 on the mat`}>
                {outs[team].length ? (
                  <span className={`kv-out kv-out-${key(team)}`} role="status"><b>{list(outs[team])}</b> off the court</span>
                ) : (
                  <span className="kv-next">
                    {order.length ? <>Next in: <b>{order[0]}</b>{order.length > 1 && <> +{order.length - 1}</>}</> : 'All 7 on the mat'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
ScoreStrip.propTypes = {
  live: PropTypes.object.isRequired, result: PropTypes.object, roster: PropTypes.array,
  outs: PropTypes.array.isRequired,
};

/** Only when the rule is live: Super tackle on (Do or die lives on the raiding team's name bar). */
function Cues({ live }) {
  if (!live.inPlay || !live.superTackleOn) return null;
  return (
    <div className="kv-cues">
      <em className="kv-cue kv-cue-super">Super tackle on · {live.names[live.defender]}</em>
    </div>
  );
}
Cues.propTypes = { live: PropTypes.object.isRequired };

/** Who is raiding and how long is left; the seconds also sit in the strip. */
function RaidBar({ live, roster }) {
  const { raid } = live;
  if (!raid) return null;
  return (
    <section className={`kv-card kv-raid kv-raid-${key(raid.team)}`} aria-label="Raid in progress">
      <span className="kv-raid-t">
        <i className={`kit-live-team-dot kv-dot-${key(raid.team)}`} aria-hidden="true" />
        <span><b>{playerLabel(roster, raid.raiderSlot)}</b> raiding for {live.names[raid.team]}</span>
      </span>
      <span className="kv-raid-track" aria-hidden="true"><i style={{ width: `${(raid.leftMs / 30000) * 100}%` }} /></span>
    </section>
  );
}
RaidBar.propTypes = { live: PropTypes.object.isRequired, roster: PropTypes.array };

/* ------------------------------------------------------------------ raid cards (Live and Raids tabs) */

const OUTS = ['touch', 'bonus'];
const LOSSES = ['tackled', 'selfOut', 'doOrDieFailure'];

/** PKL's titles: Empty raid, Successful raid, Unsuccessful raid, Super raid, Super tackle. */
function raidTitle(e) {
  if (e.superTackle) return 'Super tackle';
  if (e.superRaid) return 'Super raid';
  if (e.outcome === 'empty') return 'Empty raid';
  if (OUTS.includes(e.outcome)) return 'Successful raid';
  if (LOSSES.includes(e.outcome)) return 'Unsuccessful raid';
  return 'Referee ruling';
}

function leadLine(e, teamNames) {
  const after = e.score[0] - e.score[1];
  const before = e.scoreBefore[0] - e.scoreBefore[1];
  const score = `${e.score[0]}–${e.score[1]}`;
  if (after === 0) return `All square · ${score}`;
  const leader = after > 0 ? 0 : 1;
  if (Math.sign(before) !== Math.sign(after)) return `${teamNames[leader]} take the lead · ${score}`;
  return `${teamNames[leader]} lead ${Math.abs(after) < Math.abs(before) ? 'cut' : 'up'} to ${Math.abs(after)} · ${score}`;
}

const atMinute = (e, halfMs) => `${halfName(e.half)} · ${Math.floor(Math.max(0, halfMs - e.halfLeftMs) / 60000)}'`;

/** One raid in PKL's shape: title, Raider, Tackled by or Players out, points, score after, chips. */
function RaidBody({ e, teamNames, roster, halfMs, hand = false, lead = false }) {
  // On the moment cards (hand-drawn) an all out is named as one; on the Raids tab it stays a tag.
  const title = hand && e.allOut !== null && !e.superTackle ? 'All out' : raidTitle(e);
  const outs = e.lostSlots[1 - e.team].map((slot) => playerLabel(roster, slot));
  const scorer = e.points[0] === e.points[1] ? null : e.points[0] > e.points[1] ? 0 : 1;
  let detail = null;
  if (e.outcome === 'tackled') detail = ['Tackled by', teamNames[1 - e.team]];
  else if (outs.length) detail = ['Players out', list(outs)];
  return (
    <>
      <div className="kv-rc-main">
        <h3 className={`kv-rc-title kv-ul-${key(e.allOut !== null ? 1 - e.allOut : e.superTackle ? 1 - e.team : e.team)}`}>
          <i className={`kit-live-team-dot kv-dot-${key(e.team)}`} aria-hidden="true" />
          {hand ? <HandUnderline>{title}</HandUnderline> : title}
        </h3>
        <p>Raider: <b>{playerLabel(roster, e.raiderSlot)}</b></p>
        {detail && <p>{detail[0]}: <b>{detail[1]}</b></p>}
        {e.outcome === 'selfOut' && <p><b>Raider out</b></p>}
        {lead && <p className="kv-rc-lead">{leadLine(e, teamNames)}</p>}
      </div>
      <div className="kv-rc-r">
        <b>{e.score[0]}–{e.score[1]}</b>
        {scorer !== null && <small className={`kv-pts kv-pts-${key(scorer)}`}>{[0, 1].filter((t) => e.points[t]).map((t) => `+${e.points[t]}`).join(' ')}</small>}
      </div>
      <div className="kv-rc-tags">
        <span className="kv-chip">{atMinute(e, halfMs)}</span>
        {e.doOrDie && <em className="kv-tag kv-tag-dod">Do or die</em>}
        {e.allOut !== null && title !== 'All out' && <em className="kv-tag kv-tag-gold">All out</em>}
        {e.superRaid && !e.superTackle && <em className="kv-tag kv-tag-gold">Super raid</em>}
      </div>
    </>
  );
}
RaidBody.propTypes = {
  e: PropTypes.object.isRequired, teamNames: PropTypes.array.isRequired, roster: PropTypes.array,
  halfMs: PropTypes.number.isRequired, hand: PropTypes.bool, lead: PropTypes.bool,
};

const isMoment = (e) => e.superTackle || e.allOut !== null;

/** One card on the Live tab. A super tackle or an all out puts the hand-drawn title on it; never a second card. */
function LastRaid({ entry, teamNames, roster, halfMs, total, onAll }) {
  if (!entry) return null;
  const moment = isMoment(entry);
  return (
    <section className={`kv-card kv-last${moment ? ' kv-last-moment' : ''}`} aria-label="Last raid" role={moment ? 'status' : undefined}>
      <div className="kv-card-head">
        <h2>Last raid</h2>
        <button type="button" className="kv-all" onClick={onAll}>All {total} raids</button>
      </div>
      <div className="kv-rc kv-rc-last">
        <RaidBody e={entry} teamNames={teamNames} roster={roster} halfMs={halfMs} hand={moment} lead={moment} />
      </div>
    </section>
  );
}
LastRaid.propTypes = {
  entry: PropTypes.object, teamNames: PropTypes.array.isRequired, roster: PropTypes.array,
  halfMs: PropTypes.number.isRequired, total: PropTypes.number.isRequired, onAll: PropTypes.func.isRequired,
};

/* ------------------------------------------------------------------ live tab: court */

/** Defender spots: evenly spaced behind the baulk line, bowed slightly towards the midline. */
function chain(team, n) {
  return Array.from({ length: n }, (_, i) => {
    const step = i - (n - 1) / 2;
    const fromMid = 30 - 1.2 * step * step;
    return { x: team === 0 ? 50 - fromMid : 50 + fromMid, y: 50 + step * 13 };
  });
}

function Court({ live }) {
  const { raid } = live;
  const raider = raid ? raid.team : null;
  const superHalf = live.superTackleOn ? live.defender : null;
  return (
    <section className="kv-card kv-court-card" aria-label="Court">
      <div className="kv-court" role="img" aria-label={`Court: ${live.names[0]} ${live.mat[0]} on the mat, ${live.names[1]} ${live.mat[1]} on the mat${raid ? `, ${live.names[raid.team]} raiding` : ''}`}>
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
    </section>
  );
}
Court.propTypes = { live: PropTypes.object.isRequired };

/* ------------------------------------------------------------------ raids tab */

function Raids({ match, story, teamNames, roster, halfMs }) {
  const ht = halfTimeScore(match);
  const newestFirst = [...story].reverse();
  const items = [];
  if (ended(match.state.phase)) items.push(<li key="ft" className="kv-band">Full time · {story.at(-1).score[0]}–{story.at(-1).score[1]}</li>);
  newestFirst.forEach((e, i) => {
    items.push(
      <li key={e.id} className="kv-rc">
        <RaidBody e={e} teamNames={teamNames} roster={roster} halfMs={halfMs} />
      </li>,
    );
    if (ht && e.half === 2 && newestFirst[i + 1]?.half === 1) items.push(<li key="ht" className="kv-band">Half time · {ht[0]}–{ht[1]}</li>);
  });
  return (
    <section aria-label="All raids">
      <div className="kit-sec"><h2>All raids</h2><span>Newest first</span></div>
      <ol className="kv-feed">{items}</ol>
    </section>
  );
}
Raids.propTypes = {
  match: PropTypes.object.isRequired, story: PropTypes.array.isRequired, teamNames: PropTypes.array.isRequired,
  roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
};

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

/* ------------------------------------------------------------------ full time */

/** Up to three: every all out first, then the latest super tackles, shown in match order. */
function turningPoints(story, n = 3) {
  const picks = story.filter(isMoment);
  if (picks.length <= n) return picks;
  const ranked = [...picks.filter((e) => e.allOut !== null), ...picks.filter((e) => e.allOut === null).reverse()];
  return ranked.slice(0, n).sort((a, b) => a.number - b.number);
}

function Result({ result, live, match, story, teamNames, roster, halfMs }) {
  const halves = halfStory(match);
  const turns = turningPoints(story);
  return (
    <>
      <section className="kv-card kv-result" aria-label="Result">
        <h2>
          {result.winner !== null && <i className={`kit-live-team-dot kv-dot-${key(result.winner)}`} aria-hidden="true" />}
          {result.line}
        </h2>
        <p>Final {live.totals[0]}–{live.totals[1]} · {story.length} raids</p>
        <div className="kv-result-halves">
          {halves.map((h) => (
            <span key={h.half}><small>{halfName(h.half)}</small><b>{h.points[0]}–{h.points[1]}</b></span>
          ))}
        </div>
      </section>
      {turns.length > 0 && (
        <section aria-label="Turning points">
          <div className="kit-sec"><h2>Turning points</h2></div>
          <ol className="kv-feed">
            {turns.map((e) => (
              <li key={e.id} className="kv-rc">
                <RaidBody e={e} teamNames={teamNames} roster={roster} halfMs={halfMs} hand />
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
Result.propTypes = {
  result: PropTypes.object.isRequired, live: PropTypes.object.isRequired, match: PropTypes.object.isRequired,
  story: PropTypes.array.isRequired, teamNames: PropTypes.array.isRequired, roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
};

/* ------------------------------------------------------------------ page */

/**
 * `showOut` puts the "off the court" moment under the card of whoever just lost players. A real page
 * shows it for a few seconds after the raid event arrives and drops it when the next raid starts.
 */
export default function KabaddiWatchR3({ match, now, roster, initialTab = 'live', showOut = false }) {
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
  const halfMs = match.state.rules.halfMs;
  const tabs = [['live', result ? 'Result' : 'Live'], ['raids', 'Raids'], ['stats', 'Stats']];
  const current = tabs.some(([id]) => id === tab) ? tab : 'live';
  const outs = [0, 1].map((t) => (showOut && last && !result && !live.raid && last.allOut !== t
    ? last.lostSlots[t].map((slot) => playerLabel(roster, slot)) : []));

  let body;
  if (current === 'raids') {
    body = <Raids match={match} story={story} teamNames={teamNames} roster={roster} halfMs={halfMs} />;
  } else if (current === 'stats') {
    body = (
      <>
        <Halves match={match} teamNames={teamNames} live={live} />
        <Points match={match} teamNames={teamNames} totals={live.totals} />
      </>
    );
  } else if (result) {
    body = <Result result={result} live={live} match={match} story={story} teamNames={teamNames} roster={roster} halfMs={halfMs} />;
  } else {
    body = (
      <>
        <Court live={live} />
        <LastRaid entry={last} teamNames={teamNames} roster={roster} halfMs={halfMs} total={story.length} onAll={() => setTab('raids')} />
      </>
    );
  }

  return (
    <div className="kit-screen kv" style={vars}>
      <KitWash from={sportIdentity('kabaddi')?.tint} to={sportIdentity('kabaddi')?.tint} />
      <Header live={live} halfMins={Math.round(halfMs / 60000)} />
      <ScoreStrip live={live} result={result} roster={roster} outs={outs} />
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

KabaddiWatchR3.propTypes = {
  match: PropTypes.object.isRequired,
  now: PropTypes.number.isRequired,
  roster: PropTypes.array,
  initialTab: PropTypes.oneOf(['live', 'raids', 'stats']),
  showOut: PropTypes.bool,
};
