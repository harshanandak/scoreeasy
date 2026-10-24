import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import {
  clockText, halfStory, halfTimeScore, keyMoments, liveNow, pointsBreakdown, raidStory, raidWords,
} from '../../../utils/kabaddiLiveModel';
import { HandUnderline, KitWash, SportBadge } from '../kit/KitParts';
import '../kit/live.css';
import './kabaddiLive.css';

// Kabaddi LIVE VIEWER (spectator page) — exploration `v` (docs: E:/tmp/kabaddi-explore/v/NOTES.md).
// Read-only: no scoring control anywhere. Two directions over the same engine match:
//   variant="broadcast" — a TV-style scorebug, the court with each side's mat and sitting block,
//                         the last raid in words, and big-moment treatments (all out, super tackle).
//   variant="story"     — the progress of the game first: lead-by-raid chart with all outs and super
//                         tackles marked, key moments, points by kind, mat strength, the half story.
// Every number is read from kabaddiLiveModel.js, which folds the raid engine's state and journal.

const key = (team) => (team === 0 ? 'a' : 'b');
const halfLabel = (n) => (n === 1 ? '1st half' : '2nd half');

function useVars(match) {
  return useMemo(() => {
    // The engine stores each team's derived colours with the match, so the viewer paints exactly
    // what the scorer's board paints.
    const [A, B] = match.state.teams.map((t) => t.colours);
    return { ...teamColourVars(A?.core ? { A, B } : deriveTeamColours()), ...sportIdentityVars('kabaddi') };
  }, [match]);
}

/** Header: the sport badge, the fixture, and the live state (LIVE / HALF TIME / FULL TIME). */
function ViewerTop({ now: n, live }) {
  const status = live.phase === 'finished' || live.phase === 'finishReview' ? 'Full time'
    : live.phase === 'halfTime' ? 'Half time' : 'Live';
  return (
    <header className="kl-top">
      <SportBadge sportId="kabaddi" />
      <div className="kl-top-t">
        <b>{live.names[0]} v {live.names[1]}</b>
        <small>Kabaddi · 2 × {Math.round(n.halfMs / 60000)} min · club rules</small>
      </div>
      <span className={status === 'Live' ? 'kl-pill kl-pill-live' : 'kl-pill'}>
        {status === 'Live' && <i aria-hidden="true" />}{status}
      </span>
    </header>
  );
}
ViewerTop.propTypes = { now: PropTypes.object.isRequired, live: PropTypes.object.isRequired };

/** The situation tags a kabaddi fan reads first. */
function Cues({ live, big = false }) {
  if (!live.inPlay) return null;
  const tags = [];
  if (live.doOrDie) tags.push(<em key="dod" className="kl-cue kl-cue-danger">Do or die · {live.names[live.raider]}</em>);
  if (live.superTackleOn) tags.push(<em key="st" className="kl-cue kl-cue-gold">Super tackle on</em>);
  if (live.bonusLive && live.raid) tags.push(<em key="bonus" className="kl-cue">Bonus line live</em>);
  if (!tags.length) return null;
  return <div className={`kl-cues${big ? ' kl-cues-big' : ''}`}>{tags}</div>;
}
Cues.propTypes = { live: PropTypes.object.isRequired, big: PropTypes.bool };

/* ------------------------------------------------------------------ the court (broadcast) */

/** Defender positions: a chain between the end line and the baulk line, bowed towards the midline. */
function chain(team, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : (i - (n - 1) / 2) / 3; // slots stay 1/7 apart whatever the count
    const fromMid = 34 - 7 * t * t; // % of the court width from the midline: behind the baulk line
    return { x: team === 0 ? 50 - fromMid : 50 + fromMid, y: 50 + t * 40 };
  });
}

function LiveCourt({ live, moment }) {
  const { raid } = live;
  const sides = [0, 1].map((team) => {
    const raiding = live.inPlay && team === live.raider;
    const onMat = live.mat[team] - (raiding ? 1 : 0); // the raider is drawn on their own
    return { team, raiding, spots: chain(team, onMat), sitting: live.sitting[team] };
  });
  const raider = live.inPlay ? live.raider : null;
  const raiderAt = raider === null ? null : raid
    ? { x: raider === 0 ? 69 : 31, y: 50 } // across the midline, short of the baulk line
    : { x: raider === 0 ? 45 : 55, y: 50 }; // waiting on its own side of the midline
  const superHalf = live.superTackleOn ? live.defender : null;
  return (
    <div className="kl-court-wrap" data-moment={moment?.kind}>
      <div className="kl-court" role="img" aria-label={`Court: ${live.names[0]} ${live.mat[0]} on mat, ${live.sitting[0]} sitting; ${live.names[1]} ${live.mat[1]} on mat, ${live.sitting[1]} sitting${raid ? `; ${live.names[raid.team]} raiding` : ''}`}>
        {[0, 1].map((team) => (
          <div key={team} className={`kl-sit kl-sit-${key(team)}`} aria-hidden="true">
            {sides[team].sitting > 0 && <small>out</small>}
            {Array.from({ length: sides[team].sitting }, (_, i) => (
              <i key={i} className={`kl-seat kl-seat-${key(team)}`} data-next={i === 0 ? '' : undefined} />
            ))}
          </div>
        ))}
        <div className="kl-mat" aria-hidden="true">
          <i className="kl-half kl-half-a" data-super={superHalf === 0 ? '' : undefined} />
          <i className="kl-half kl-half-b" data-super={superHalf === 1 ? '' : undefined} />
          <i className="kl-ln kl-ln-lobby kl-ln-top" />
          <i className="kl-ln kl-ln-lobby kl-ln-bot" />
          {[0, 1].map((team) => (
            <span key={team}>
              <i className={`kl-ln kl-ln-v kl-baulk-${key(team)}`} />
              <i className={`kl-ln kl-ln-v kl-ln-bonus kl-bonus-${key(team)}`} data-live={live.bonusLive && team === live.defender ? '' : undefined} />
            </span>
          ))}
          <i className="kl-ln kl-ln-v kl-ln-mid" />
          {live.bonusLive && live.inPlay && <b className={`kl-lbl kl-lbl-bonus kl-lbl-${key(live.defender)}`}>bonus</b>}
          {superHalf !== null && !moment && <b className={`kl-lbl kl-lbl-super kl-lbl-${key(superHalf)}`}>Super tackle on</b>}
          {sides.map((side) => side.spots.map((p, i) => (
            <i key={`${side.team}-${i}`} className={`kl-tok kl-tok-${key(side.team)}`} style={{ left: `${p.x}%`, top: `${p.y}%`, '--i': i }} />
          )))}
          {raid && <i className={`kl-trail kl-trail-${key(raider)}`} />}
          {raiderAt && (
            <span className={`kl-raider kl-tok-${key(raider)}`} data-raiding={raid ? '' : undefined} data-dod={live.doOrDie ? '' : undefined} style={{ left: `${raiderAt.x}%`, top: `${raiderAt.y}%` }}>
              <i className="kl-raider-mark" />
            </span>
          )}
          {raid && <b className={`kl-lbl kl-lbl-raider kl-lbl-${key(raider)}`}>{live.doOrDie ? 'Do or die' : 'Raiding'}</b>}
          {!raid && raiderAt && <b className={`kl-lbl kl-lbl-next kl-lbl-${key(raider)}`}>raids next</b>}
        </div>
        {moment && <MomentCard moment={moment} names={live.names} />}
      </div>
      <div className="kl-court-legend">
        {[0, 1].map((team) => (
          <span key={team} className={`kl-cl kl-cl-${key(team)}`}>
            <b>{live.mat[team]}</b> on mat
            <small>{live.sitting[team] ? `${live.sitting[team]} out · back in order` : 'all 7 in'}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
LiveCourt.propTypes = { live: PropTypes.object.isRequired, moment: PropTypes.object };

/** The big-moment card: the only place the hand-drawn layer appears. */
function MomentCard({ moment, names }) {
  const team = moment.team;
  const title = moment.kind === 'allOut' ? 'All out!' : 'Super tackle!';
  return (
    <div className={`kl-moment kl-moment-${key(team)}`} role="status">
      <svg className="kl-burst" viewBox="0 0 120 40" aria-hidden="true" focusable="false">
        <path d="M8 30 2 22M14 14 9 5M26 8 25 1M94 8 95 1M106 14 111 5M112 30 118 22" vectorEffect="non-scaling-stroke" />
      </svg>
      <h2><HandUnderline>{title}</HandUnderline></h2>
      <p className="kl-moment-who"><i className={`kl-dot kl-dot-${key(team)}`} />{names[team]} <b>+{moment.points}</b></p>
      <p>{moment.line}</p>
      <p className="kl-moment-lead">{moment.lead}</p>
    </div>
  );
}
MomentCard.propTypes = { moment: PropTypes.object.isRequired, names: PropTypes.array.isRequired };

/* ------------------------------------------------------------------ shared rows */

function RecentRaids({ story, names, count = 9 }) {
  const recent = story.slice(-count);
  return (
    <ol className="kl-recent" aria-label="Recent raids, oldest to newest">
      {recent.map((e) => {
        const scorer = e.points[0] === e.points[1] ? null : (e.points[0] > e.points[1] ? 0 : 1);
        const code = e.allOut !== null ? 'AO' : e.superTackle ? 'ST' : e.outcome === 'empty' ? '0'
          : scorer === e.team ? `+${e.points[e.team]}` : `+${e.points[1 - e.team]}`;
        const label = `Raid ${e.number}, ${names[e.team]} raid: ${raidWords(e, names).headline}`;
        return (
          <li key={e.id} className="kl-rr" data-scorer={scorer === null ? undefined : key(scorer)} data-big={e.allOut !== null || e.superTackle ? '' : undefined} aria-label={label}>
            <i className={`kl-dot kl-dot-${key(e.team)}`} aria-hidden="true" />
            <b aria-hidden="true">{code}</b>
          </li>
        );
      })}
    </ol>
  );
}
RecentRaids.propTypes = { story: PropTypes.array.isRequired, names: PropTypes.array.isRequired, count: PropTypes.number };

function LastRaid({ entry, names }) {
  if (!entry) return null;
  const words = raidWords(entry, names);
  return (
    <section className="kl-card kl-last" aria-label="Last raid">
      <div className="kl-eyebrow">
        <span>Last raid · #{entry.number}</span>
        <span>{halfLabel(entry.half)} · {clockText(entry.halfLeftMs)}</span>
      </div>
      <div className="kl-last-row">
        <i className={`kl-raid-chip kl-tok-${key(entry.team)}`} aria-hidden="true"><i className="kl-raider-mark" /></i>
        <div className="kl-last-text">
          <b>{words.headline}</b>
          <p>{words.line}</p>
          {words.extra.map((x) => <p key={x} className="kl-last-extra">{x}</p>)}
        </div>
        <span className="kl-last-score"><small>Score</small>{entry.score[0]}–{entry.score[1]}</span>
      </div>
    </section>
  );
}
LastRaid.propTypes = { entry: PropTypes.object, names: PropTypes.array.isRequired };

/* ------------------------------------------------------------------ BROADCAST */

/** Three numbers of context under the live court: the half-time score, this half, all outs. */
function SoFar({ match, live }) {
  const halves = halfStory(match);
  const ht = halfTimeScore(match);
  const now = halves.find((h) => h.half === live.half);
  const allOuts = [0, 1].map((t) => halves.reduce((n, h) => n + h.allOuts[t], 0));
  const tiles = [];
  if (ht && live.half === 2) tiles.push(['Half time', `${ht[0]}–${ht[1]}`]);
  if (now) tiles.push([live.half === 2 ? '2nd half so far' : '1st half so far', `${now.points[0]}–${now.points[1]}`]);
  tiles.push(['All outs', `${allOuts[0]}–${allOuts[1]}`]);
  return (
    <div className="kl-sofar">
      {tiles.map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}
    </div>
  );
}
SoFar.propTypes = { match: PropTypes.object.isRequired, live: PropTypes.object.isRequired };

function Scorebug({ live, result }) {
  const raidClock = live.raid ? Math.ceil(live.raid.leftMs / 1000) : null;
  return (
    <section className="kl-bug" aria-label="Scorebug">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`${live.names[0]} ${live.totals[0]}, ${live.names[1]} ${live.totals[1]}. ${result ? result.line : `${halfLabel(live.half)}, ${clockText(live.halfLeftMs)} left.`}${live.raid ? ` ${live.names[live.raid.team]} raiding, ${raidClock} seconds.` : ''}`}
      </p>
      <div className="kl-bug-row" aria-hidden="true">
        {[0, 1].map((team) => (
          <div key={team} className={`kl-bug-team kl-bug-${key(team)}`} data-raiding={live.inPlay && live.raider === team ? '' : undefined} data-won={result?.winner === team ? '' : undefined}>
            <span className="kl-bug-name">{live.names[team]}</span>
            <span className="kl-bug-score">{live.totals[team]}</span>
            {live.inPlay && live.raider === team && <span className="kl-bug-flag">{live.raid ? 'Raiding' : 'Raid next'}</span>}
            {result?.winner === team && <span className="kl-bug-flag">Won</span>}
          </div>
        ))}
        <div className="kl-bug-mid">
          {result ? <><small>Final</small><b>FT</b></> : live.phase === 'halfTime'
            ? <><small>Half</small><b>HT</b></>
            : <><small>{live.half === 1 ? 'H1' : 'H2'}</small><b>{clockText(live.halfLeftMs)}</b></>}
        </div>
      </div>
      {live.raid && (
        <div className={`kl-raidbar kl-raidbar-${key(live.raid.team)}`} aria-hidden="true">
          <span className="kl-raidbar-t"><i className="kl-raider-mark" />{live.names[live.raid.team]} raid · #{live.raid.number}</span>
          <span className="kl-raidbar-track"><i style={{ width: `${(live.raid.leftMs / 30000) * 100}%` }} /></span>
          <b className="kl-raidbar-s">{raidClock}<small>s</small></b>
        </div>
      )}
      <Cues live={live} big />
    </section>
  );
}
Scorebug.propTypes = { live: PropTypes.object.isRequired, result: PropTypes.object };

function resultOf(live) {
  if (!['finished', 'finishReview'].includes(live.phase)) return null;
  const [a, b] = live.totals;
  if (a === b) return { winner: null, line: `Draw ${a}–${b}` };
  const winner = a > b ? 0 : 1;
  return { winner, line: `${live.names[winner]} win by ${Math.abs(a - b)}` };
}

/** What a raid did to the lead, in words: level, a new leader, a lead cut or stretched. */
function leadLine(e, names) {
  const before = e.scoreBefore[0] - e.scoreBefore[1];
  const after = e.score[0] - e.score[1];
  const score = `${e.score[0]}–${e.score[1]}`;
  if (after === 0) return `All square at ${score}`;
  const leader = after > 0 ? 0 : 1;
  if (Math.sign(before) !== Math.sign(after)) return `${names[leader]} take the lead · ${score}`;
  return `${names[leader]} lead ${Math.abs(after) < Math.abs(before) ? 'cut' : 'up'} to ${Math.abs(after)} · ${score}`;
}

function momentOf(last, names, show) {
  if (!show || !last) return null;
  if (last.allOut !== null) {
    const team = 1 - last.allOut;
    return { kind: 'allOut', team, points: last.points[team], line: `Every ${names[last.allOut]} player out: +2 on top, and all seven come back on.`, lead: leadLine(last, names) };
  }
  if (last.superTackle) {
    const team = 1 - last.team;
    return { kind: 'superTackle', team, points: last.points[team], line: `Only ${last.defendersAtStart} on the mat, and they stopped the ${names[last.team]} ${last.doOrDie ? 'do-or-die ' : ''}raider.`, lead: leadLine(last, names) };
  }
  return null;
}

function Broadcast({ match, live, story, showMoment }) {
  const names = live.names;
  const last = story.at(-1);
  const result = resultOf(live);
  const moment = momentOf(last, names, showMoment);
  if (result) {
    const halves = halfStory(match);
    const pts = pointsBreakdown(match);
    const moments = keyMoments(match).filter((m) => ['allOut', 'superTackle', 'leadChange'].includes(m.kind)).slice(0, 7).reverse();
    return (
      <>
        <Scorebug live={live} result={result} />
        <section className="kl-card kl-result" aria-label="Result">
          <h2><HandUnderline>{result.line}</HandUnderline></h2>
          <div className="kl-result-halves">
            {halves.map((h) => (
              <span key={h.half}><small>{halfLabel(h.half)}</small><b>{h.points[0]}–{h.points[1]}</b></span>
            ))}
            <span><small>Raids</small><b>{story.length}</b></span>
          </div>
          <table className="kl-mini-break">
            <thead><tr><th scope="col">Points</th><th scope="col">{names[0]}</th><th scope="col">{names[1]}</th></tr></thead>
            <tbody>
              {[['Raid', 'raid'], ['Tackle', 'tackle'], ['All out', 'allOut'], ['Extras', 'extras']].map(([label, k]) => (
                <tr key={k}><th scope="row">{label}</th><td>{pts[0][k]}</td><td>{pts[1][k]}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="kl-card kl-turns" aria-label="Turning points">
          <div className="kl-eyebrow"><span>Turning points</span><span>in order</span></div>
          <ul>
            {moments.map((m) => (
              <li key={`${m.kind}-${m.raid}`}>
                <i className={`kl-dot kl-dot-${key(m.team)}`} aria-hidden="true" />
                <span><b>{m.text}</b> <small>{m.half === 1 ? 'H1' : 'H2'} {m.clock}</small></span>
                <strong>{m.score[0]}–{m.score[1]}</strong>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }
  return (
    <>
      <Scorebug live={live} />
      <LiveCourt live={live} moment={moment} />
      <LastRaid entry={last} names={names} />
      <div className="kl-sec"><h2>Recent raids</h2><span>dot raided · underline scored</span></div>
      <RecentRaids story={story} names={names} />
      <SoFar match={match} live={live} />
    </>
  );
}
Broadcast.propTypes = { match: PropTypes.object.isRequired, live: PropTypes.object.isRequired, story: PropTypes.array.isRequired, showMoment: PropTypes.bool };

/* ------------------------------------------------------------------ STORY */

function ScoreLine({ live }) {
  const result = resultOf(live);
  const raidClock = live.raid ? Math.ceil(live.raid.leftMs / 1000) : null;
  let status;
  if (result) status = <><b>{result.line}</b></>;
  else if (live.phase === 'halfTime') status = <b>Half time</b>;
  else if (live.raid) status = <><b className={`kl-now kl-now-${key(live.raid.team)}`}>{live.names[live.raid.team]} raiding · {raidClock}s</b></>;
  else status = <><span>{live.names[live.raider]} raid next</span></>;
  return (
    <section className="kl-line" aria-label="Score">
      <div className="kl-line-row">
        <span className="kl-line-team kl-line-a"><i className="kl-dot kl-dot-a" aria-hidden="true" />{live.names[0]}</span>
        <span className="kl-line-score">{live.totals[0]}<i>–</i>{live.totals[1]}</span>
        <span className="kl-line-team kl-line-b">{live.names[1]}<i className="kl-dot kl-dot-b" aria-hidden="true" /></span>
      </div>
      <div className="kl-line-meta">
        <span className="kl-line-clock">{result ? 'Full time' : live.phase === 'halfTime' ? 'Half time' : `${live.half === 1 ? 'H1' : 'H2'} · ${clockText(live.halfLeftMs)} left`}</span>
        <span className="kl-line-status">{status}</span>
      </div>
      {!live.raid && <Cues live={live} />}
    </section>
  );
}
ScoreLine.propTypes = { live: PropTypes.object.isRequired };

const MARK = { allOut: 'AO', superTackle: 'ST' };

/**
 * How the lead moved: Royals' lead after every raid (above the line) or Strikers' (below), with a
 * gap at half time. All outs and super tackles are marked where they happened. Tap/hover a raid
 * to read it; the readout defaults to the latest raid, so the numbers never rest on colour alone.
 */
function LeadChart({ story, names, live }) {
  const [pick, setPick] = useState(null);
  const n = story.length;
  const total = Math.max(n + (live.raid ? 1 : 0), 10);
  const W = 340; const H = 156; const P = { l: 26, r: 10, t: 19, b: 20 };
  const margins = story.map((e) => e.score[0] - e.score[1]);
  // Each side of the line is scaled to its own biggest lead (at least 5), so a one-sided match
  // doesn't spend half the chart on empty space.
  const up = Math.max(5, Math.ceil(Math.max(0, ...margins) / 5) * 5);
  const down = Math.max(5, Math.ceil(Math.max(0, ...margins.map((m) => -m)) / 5) * 5);
  const halfGap = story.some((e) => e.half === 2) ? 1 : 0;
  const xOf = (i, half) => P.l + ((i + (half === 2 ? halfGap : 0) + 0.5) / (total + halfGap)) * (W - P.l - P.r);
  const yOf = (m) => P.t + ((up - m) / (up + down)) * (H - P.t - P.b);
  const y0 = yOf(0);
  const pts = story.map((e, i) => ({ x: xOf(i, e.half), y: yOf(margins[i]), e, m: margins[i] }));
  const step = (list) => list.reduce((d, p, i) => `${d}${i ? `H${p.x}V${p.y}` : `M${p.x} ${p.y}`}`, '');
  const halves = [1, 2].map((h) => pts.filter((p) => p.e.half === h)).filter((l) => l.length);
  const area = (list) => `${step(list)}H${list.at(-1).x + 4}V${y0}H${list[0].x}Z`;
  const htX = halfGap ? (xOf(story.filter((e) => e.half === 1).length - 1, 1) + xOf(story.filter((e) => e.half === 1).length, 2)) / 2 : null;
  const shown = pick ?? (n - 1);
  const sel = pts[shown];
  const words = sel && raidWords(sel.e, names);
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i; });
    setPick(best);
  };
  const marks = pts.filter((p) => p.e.allOut !== null || p.e.superTackle);
  return (
    <section className="kl-card kl-chart" aria-label="How the lead moved">
      <div className="kl-chart-hd">
        <h2>How the lead moved</h2>
        <span className="kl-legend">
          <span><i className="kl-sw kl-sw-a" />{names[0]} ahead</span>
          <span><i className="kl-sw kl-sw-b" />{names[1]} ahead</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="kl-chart-svg" role="img"
        aria-label={`Lead by raid over ${n} raids. Now ${margins.at(-1) === 0 ? 'level' : `${names[margins.at(-1) > 0 ? 0 : 1]} by ${Math.abs(margins.at(-1))}`}. Marked: ${marks.map((p) => `${MARK[p.e.allOut !== null ? 'allOut' : 'superTackle'] === 'AO' ? 'all out' : 'super tackle'} on raid ${p.e.number}`).join(', ')}.`}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setPick(null)}>
        <defs>
          <clipPath id="kl-above"><rect x="0" y="0" width={W} height={y0} /></clipPath>
          <clipPath id="kl-below"><rect x="0" y={y0} width={W} height={H - y0} /></clipPath>
        </defs>
        {[...Array.from({ length: up / 5 }, (_, i) => up - i * 5), ...Array.from({ length: down / 5 }, (_, i) => -(i + 1) * 5)].map((m) => (
          <g key={m} className="kl-grid">
            <line x1={P.l} x2={W - P.r} y1={yOf(m)} y2={yOf(m)} />
            <text x={P.l - 5} y={yOf(m) + 3}>{Math.abs(m)}</text>
          </g>
        ))}
        {htX && <g className="kl-ht"><line x1={htX} x2={htX} y1={P.t - 4} y2={H - P.b + 2} /><text x={htX} y={H - 6}>HT</text></g>}
        <text className="kl-axis" x={P.l} y={H - 6}>Raid 1</text>
        <text className="kl-axis kl-axis-end" x={W - P.r} y={H - 6}>{live.raid ? `#${live.raid.number} live` : `#${story.at(-1)?.number ?? 0}`}</text>
        {halves.map((list) => (
          <g key={list[0].e.half}>
            <path d={area(list)} className="kl-area kl-area-a" clipPath="url(#kl-above)" />
            <path d={area(list)} className="kl-area kl-area-b" clipPath="url(#kl-below)" />
            <path d={`${step(list)}H${list.at(-1).x + 4}`} className="kl-lead kl-lead-a" clipPath="url(#kl-above)" />
            <path d={`${step(list)}H${list.at(-1).x + 4}`} className="kl-lead kl-lead-b" clipPath="url(#kl-below)" />
          </g>
        ))}
        <line className="kl-zero" x1={P.l} x2={W - P.r} y1={y0} y2={y0} />
        {live.raid && <circle className={`kl-livedot kl-fill-${key(live.raid.team)}`} cx={xOf(n, 2)} cy={pts.at(-1).y} r="4" />}
        {sel && <line className="kl-cross" x1={sel.x} x2={sel.x} y1={P.t} y2={H - P.b} />}
        {marks.map((p) => {
          const kind = p.e.allOut !== null ? 'allOut' : 'superTackle';
          const team = kind === 'allOut' ? 1 - p.e.allOut : 1 - p.e.team;
          let ly = p.m >= 0 ? p.y - 13 : p.y + 13;
          if (ly + 7 > H - P.b) ly = p.y - 13; // keep the tag inside the plot
          if (ly - 7 < 0) ly = p.y + 13;
          return (
            <g key={p.e.id} className={`kl-mark kl-mark-${kind}`}>
              <circle cx={p.x} cy={p.y} r="4.5" className={`kl-fill-${key(team)}`} />
              <rect x={p.x - 10} y={ly - 7} width="20" height="13" rx="4" className={`kl-tagbg kl-tagbg-${kind}`} />
              <text x={p.x} y={ly + 2.5}>{MARK[kind]}</text>
            </g>
          );
        })}
        {sel && <circle className={`kl-seldot kl-fill-${key(sel.m > 0 ? 0 : sel.m < 0 ? 1 : sel.e.team)}`} cx={sel.x} cy={sel.y} r="4" />}
      </svg>
      {sel && (
        <p className="kl-readout" aria-live="polite">
          <b>#{sel.e.number}</b> <span>{sel.e.half === 1 ? 'H1' : 'H2'} {clockText(sel.e.halfLeftMs)}</span>
          <span className="kl-readout-t">{names[sel.e.team]} raid · {words.headline}</span>
          <strong>{sel.e.score[0]}–{sel.e.score[1]}</strong>
        </p>
      )}
    </section>
  );
}
LeadChart.propTypes = { story: PropTypes.array.isRequired, names: PropTypes.array.isRequired, live: PropTypes.object.isRequired };

const MOMENT_TAG = { allOut: 'AO', superTackle: 'ST', superRaid: 'SR', doOrDieWon: 'DD', doOrDieLost: 'DD', leadChange: '⇄', halfTime: 'HT' };

const TURNING = ['allOut', 'superTackle', 'leadChange', 'halfTime'];

/** Live: every key moment, newest first. Full time: the turning points, in the order they came. */
function MomentsFeed({ match, fresh, limit = 6, final = false }) {
  const all = keyMoments(match);
  const list = final ? all.filter((m) => TURNING.includes(m.kind)).slice(0, limit).reverse() : all.slice(0, limit);
  return (
    <section className="kl-card kl-feed" aria-label={final ? 'Turning points' : 'Key moments'}>
      <div className="kl-chart-hd"><h2>{final ? 'Turning points' : 'Key moments'}</h2><span className="kl-muted">{final ? 'in order' : 'newest first'}</span></div>
      <ol>
        {list.map((m, i) => (
          <li key={`${m.kind}-${m.raid}`} data-kind={m.kind} data-fresh={fresh && i === 0 ? '' : undefined}>
            <span className={`kl-mt kl-mt-${m.kind}${m.team === null ? '' : ` kl-mt-${key(m.team)}`}`} aria-hidden="true">{MOMENT_TAG[m.kind]}</span>
            <span className="kl-feed-t">
              <b>{fresh && i === 0 ? <HandUnderline>{m.text}</HandUnderline> : m.text}</b>
              <small>{m.detail}</small>
            </span>
            <span className="kl-feed-r"><strong>{m.score[0]}–{m.score[1]}</strong><small>{m.kind === 'halfTime' ? 'H1 end' : `${m.half === 1 ? 'H1' : 'H2'} ${m.clock}`}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
MomentsFeed.propTypes = { match: PropTypes.object.isRequired, fresh: PropTypes.bool, limit: PropTypes.number, final: PropTypes.bool };

function Breakdown({ match, names }) {
  const pts = pointsBreakdown(match);
  const rows = [
    ['Raid points', 'raid', (t) => (pts[t].bonus ? `incl. ${pts[t].bonus} bonus` : '')],
    ['Tackle points', 'tackle', (t) => (pts[t].superTackle ? `incl. ${pts[t].superTackle} super` : '')],
    ['All-out points', 'allOut', (t) => (pts[t].allOut ? `${pts[t].allOut / 2} all out${pts[t].allOut > 2 ? 's' : ''}` : '')],
    ['Extras', 'extras', () => ''],
  ];
  const max = Math.max(1, ...rows.flatMap(([, k]) => [pts[0][k], pts[1][k]]));
  return (
    <section className="kl-card kl-break" aria-label="Points breakdown">
      <div className="kl-chart-hd">
        <h2>Where the points came from</h2>
      </div>
      <div className="kl-break-head" aria-hidden="true"><span><i className="kl-dot kl-dot-a" />{names[0]}</span><span>{names[1]}<i className="kl-dot kl-dot-b" /></span></div>
      <table>
        <caption className="sr-only">Points by kind for each team</caption>
        <tbody>
          {rows.map(([label, k, note]) => (
            <tr key={k}>
              <td className="kl-bv kl-bv-a">
                <b>{pts[0][k]}</b><small>{note(0)}</small>
                <i className="kl-bar kl-bar-a" style={{ width: `${(pts[0][k] / max) * 100}%` }} aria-hidden="true" />
              </td>
              <th scope="row">{label}</th>
              <td className="kl-bv kl-bv-b">
                <b>{pts[1][k]}</b><small>{note(1)}</small>
                <i className="kl-bar kl-bar-b" style={{ width: `${(pts[1][k] / max) * 100}%` }} aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
Breakdown.propTypes = { match: PropTypes.object.isRequired, names: PropTypes.array.isRequired };

function MatStrength({ live }) {
  return (
    <section className="kl-card kl-matcard" aria-label="Mat strength now">
      <div className="kl-chart-hd"><h2>On the mat now</h2>{live.superTackleOn && <em className="kl-cue kl-cue-gold">Super tackle on</em>}</div>
      {[0, 1].map((team) => (
        <div key={team} className="kl-matrow" role="img" aria-label={`${live.names[team]}: ${live.mat[team]} of 7 on the mat`}>
          <span className="kl-matname">{live.names[team]}</span>
          <span className="kl-pips" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <i key={i} className={`kl-pipd kl-pipd-${key(team)}`} data-on={i < live.mat[team] ? '' : undefined} />)}
          </span>
          <b className="kl-matn">{live.mat[team]}</b>
        </div>
      ))}
    </section>
  );
}
MatStrength.propTypes = { live: PropTypes.object.isRequired };

function HalfStoryCard({ match, names, live }) {
  const halves = halfStory(match);
  const ht = halfTimeScore(match);
  return (
    <section className="kl-card kl-halves" aria-label="Half by half">
      <div className="kl-chart-hd"><h2>Half by half</h2>{ht && <span className="kl-muted">Half time {ht[0]}–{ht[1]}</span>}</div>
      <div className="kl-halves-grid">
        {halves.map((h) => {
          const lead = h.points[0] === h.points[1] ? null : (h.points[0] > h.points[1] ? 0 : 1);
          const inProgress = h.half === live.half && live.inPlay;
          const facts = [];
          for (const t of [0, 1]) if (h.allOuts[t]) facts.push(`${names[t]} ${h.allOuts[t]} all out${h.allOuts[t] > 1 ? 's' : ''}`);
          for (const t of [0, 1]) if (h.superTackles[t]) facts.push(`${names[t]} ${h.superTackles[t]} super tackle${h.superTackles[t] > 1 ? 's' : ''}`);
          if (h.biggest.team !== null) facts.push(`Biggest lead ${names[h.biggest.team]} +${h.biggest.margin}`);
          return (
            <div key={h.half} className="kl-halfcol">
              <small>{halfLabel(h.half)}{inProgress ? ' · so far' : ''}</small>
              <b>{h.points[0]}–{h.points[1]}</b>
              <span>{lead === null ? 'Level half' : `${names[lead]} ${inProgress ? 'ahead in it' : 'won it'} by ${Math.abs(h.points[0] - h.points[1])}`} · {h.raids} raids</span>
              <ul>{facts.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
HalfStoryCard.propTypes = { match: PropTypes.object.isRequired, names: PropTypes.array.isRequired, live: PropTypes.object.isRequired };

/** The raid on now: its clock, and what is at stake in words (all from engine flags). */
function RaidStakes({ live }) {
  const { raid, names } = live;
  const secs = Math.ceil(raid.leftMs / 1000);
  const stakes = [];
  if (live.doOrDie) stakes.push(`${names[raid.team]} must score on this raid, or the raider is out.`);
  if (live.superTackleOn) stakes.push(`${names[live.defender]} have ${raid.defendersAtStart} on the mat: stop the raider for a super tackle (+2).`);
  if (live.bonusLive) stakes.push('Bonus line is live (6 or more defenders).');
  return (
    <section className="kl-card kl-stakes" aria-label="Raid in progress">
      <div className={`kl-raidbar kl-raidbar-${key(raid.team)}`} aria-hidden="true">
        <span className="kl-raidbar-t"><i className="kl-raider-mark" />Raid #{raid.number} · {names[raid.team]}</span>
        <span className="kl-raidbar-track"><i style={{ width: `${(raid.leftMs / 30000) * 100}%` }} /></span>
        <b className="kl-raidbar-s">{secs}<small>s</small></b>
      </div>
      {stakes.length > 0 && <ul>{stakes.map((x) => <li key={x}>{x}</li>)}</ul>}
    </section>
  );
}
RaidStakes.propTypes = { live: PropTypes.object.isRequired };

function Story({ match, live, story, showMoment }) {
  const names = live.names;
  const last = story.at(-1);
  const moment = momentOf(last, names, showMoment);
  return (
    <>
      <ScoreLine live={live} />
      {moment && (
        <div className={`kl-banner kl-banner-${key(moment.team)}`} role="status">
          <h2 className="kl-banner-t"><HandUnderline>{moment.kind === 'allOut' ? 'All out!' : 'Super tackle!'}</HandUnderline></h2>
          <span className="kl-banner-pts"><i className={`kl-dot kl-dot-${key(moment.team)}`} aria-hidden="true" />{names[moment.team]} <b>+{moment.points}</b></span>
          <p className="kl-banner-lead">{moment.line} {moment.lead}.</p>
        </div>
      )}
      {live.raid && <RaidStakes live={live} />}
      <LeadChart story={story} names={names} live={live} />
      <MomentsFeed match={match} fresh={Boolean(moment)} limit={resultOf(live) ? 8 : 4} final={Boolean(resultOf(live))} />
      <Breakdown match={match} names={names} />
      {live.inPlay && <MatStrength live={live} />}
      <HalfStoryCard match={match} names={names} live={live} />
    </>
  );
}
Story.propTypes = { match: PropTypes.object.isRequired, live: PropTypes.object.isRequired, story: PropTypes.array.isRequired, showMoment: PropTypes.bool };

/**
 * @param {object} props
 * @param {{state: object, carried: number[]}} props.match the kabaddi quick match (engine state)
 * @param {number} props.now the viewer's clock, on the scorer's monotonic base
 * @param {'broadcast'|'story'} props.variant
 * @param {boolean} [props.showMoment] the last raid just landed: announce an all out / super tackle
 */
export default function KabaddiLiveView({ match, now, variant, showMoment = false }) {
  const vars = useVars(match);
  const live = liveNow(match, now);
  const story = raidStory(match);
  return (
    <div className={`kit-screen kl kl-${variant}`} style={vars} data-screen="kabaddi-live">
      <KitWash from="var(--team-a-tint)" to="var(--team-b-tint)" />
      <ViewerTop now={{ halfMs: match.state.rules.halfMs }} live={live} />
      {variant === 'broadcast'
        ? <Broadcast match={match} live={live} story={story} showMoment={showMoment} />
        : <Story match={match} live={live} story={story} showMoment={showMoment} />}
    </div>
  );
}
KabaddiLiveView.propTypes = {
  match: PropTypes.object.isRequired,
  now: PropTypes.number.isRequired,
  variant: PropTypes.oneOf(['broadcast', 'story']).isRequired,
  showMoment: PropTypes.bool,
};
