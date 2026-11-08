import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { teamColourVars, deriveTeamColours } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import {
  clockText, halfStory, liveNow, playerLabel, raidStory,
} from '../../../utils/kabaddiLiveModel';
import { HandUnderline, KitWash, SportBadge } from '../kit/KitParts';
import KabaddiCourtR4, { useCourtStage } from './KabaddiCourtR4';
import KabaddiProgressR4 from './KabaddiProgressR4';
import KabaddiRaidsR4 from './KabaddiRaidsR4';
import {
  atMinute, halfName, isEnded, isMoment, joinNames, outcomeWords, playersOut, scorerOf, sideKey, turningPoints,
} from './kabaddiView';
import '../kit/kit.css';
import '../kit/live.css';
import './kabaddiWatchR4.css';

// Kabaddi live viewer, exploration k2 round 4 (notes: E:/tmp/kabaddi-k2/viewer-r4/NOTES.md).
// Game progression first. Live: the score strip (team gradients, player icons, a raid-clock ring
// with the kabaddi mark between the cards) over one isometric court that plays a single raid
// animation. Raids: a two-sided timeline. Stats: how the game is going. Read-only. Round 3 is still
// in the tree (KabaddiWatchR3.jsx) for comparison. Every number comes from kabaddiLiveModel.js,
// which folds the raid engine's state and journal.

function resultOf(live) {
  if (!isEnded(live.phase)) return null;
  const [a, b] = live.totals;
  if (a === b) return { winner: null, line: 'Draw', margin: 0 };
  const winner = a > b ? 0 : 1;
  return { winner, line: `${live.names[winner]} win by ${Math.abs(a - b)}`, margin: Math.abs(a - b) };
}

/* ------------------------------------------------------------------ top: header, score strip */

function Header({ live, halfMins }) {
  const status = isEnded(live.phase) ? 'Full time' : live.phase === 'halfTime' ? 'Half time' : 'Live';
  return (
    <header className="k4w-top">
      <SportBadge sportId="kabaddi" />
      <div className="k4w-top-t">
        <h1>{live.names[0]} v {live.names[1]}</h1>
        <p>Kabaddi · 2 × {halfMins} min halves</p>
      </div>
      <span className={status === 'Live' ? 'kit-live-status k4w-status' : 'kit-live-paused k4w-status'}>
        {status === 'Live' && <i aria-hidden="true" />}{status}
      </span>
    </header>
  );
}
Header.propTypes = { live: PropTypes.object.isRequired, halfMins: PropTypes.number.isRequired };

/** Seven players: a shaded figure each, solid on the mat, a dashed ghost when out. */
function Squad({ on }) {
  return (
    <span className="k4w-squad" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <svg key={i} viewBox="0 0 12 17" className={i < on ? 'on' : 'off'}>
          <circle cx="6" cy="3.6" r="3" />
          <path d="M0.8 16.4v-3.5a5.2 5.2 0 0 1 10.4 0v3.5z" />
        </svg>
      ))}
    </span>
  );
}
Squad.propTypes = { on: PropTypes.number.isRequired };

/**
 * The centre mark: the kabaddi mark in a ring. The ring is the raid clock (it drains over 30 s in the
 * raiding team's colour); between raids it rests in the next raiding team's colour.
 */
function RaidRing({ live }) {
  const team = live.raider;
  const fill = live.raid ? live.raid.leftMs / 30000 : 1;
  return (
    <span className={`k4w-ring k4w-ring-${sideKey(team)}${live.raid ? ' is-raid' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <circle className="k4w-ring-track" cx="24" cy="24" r="21" />
        <circle className="k4w-ring-arc" cx="24" cy="24" r="21" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(1, fill)) * 100} 100`} />
      </svg>
      <i className="k4w-mark" />
    </span>
  );
}
RaidRing.propTypes = { live: PropTypes.object.isRequired };

function ScoreStrip({ live, result, roster, outs }) {
  const mid = result ? ['Full time', 'FT'] : live.phase === 'halfTime' ? ['Half time', 'HT'] : [halfName(live.half), clockText(live.halfLeftMs)];
  const spoken = `${live.names[0]} ${live.totals[0]}, ${live.names[1]} ${live.totals[1]}. ${result ? result.line : `${mid[0]}, ${mid[1]} left.`}`;
  return (
    <>
      <section className="k4w-strip" aria-label="Score">
        <p className="sr-only" aria-live="polite" aria-atomic="true">{spoken}</p>
        {[0, 1].map((team) => (
          <div key={team} className={`k4w-team k4w-team-${sideKey(team)}${live.raider === team && live.inPlay ? ' is-raiding' : ''}`} aria-hidden="true">
            <span className="k4w-name">{live.names[team]}</span>
            {result
              ? (result.winner === team ? <span className="k4w-won">Won</span> : <span className="k4w-squad-gap" />)
              : <Squad on={live.mat[team]} />}
            <span className="k4w-score">{live.totals[team]}</span>
          </div>
        ))}
        <div className="k4w-mid" aria-hidden="true">
          {!result && <RaidRing live={live} />}
          <b>{mid[1]}</b>
          <small>{result || live.phase === 'halfTime' ? mid[0] : live.raid ? `Raid ${live.raid.number}` : mid[0]}</small>
        </div>
      </section>
      {!result && (
        <div className="k4w-next-row" aria-label="On the mat">
          {[0, 1].map((team) => {
            const order = live.sittingOrder[team].map((slot) => playerLabel(roster, slot));
            return (
              <div key={team} className={`k4w-side k4w-side-${sideKey(team)}`} aria-label={`${live.names[team]}: ${live.mat[team]} of 7 on the mat`}>
                {outs[team].length ? (
                  <span className={`k4w-out k4w-out-${sideKey(team)}`} role="status"><b>{joinNames(outs[team])}</b> off the court</span>
                ) : (
                  <span className="k4w-next">
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
  live: PropTypes.object.isRequired, result: PropTypes.object, roster: PropTypes.array, outs: PropTypes.array.isRequired,
};

/* ------------------------------------------------------------------ live tab: last raid */

function leadLine(e, teamNames) {
  const after = e.score[0] - e.score[1];
  const before = e.scoreBefore[0] - e.scoreBefore[1];
  if (after === 0) return 'All square';
  const leader = after > 0 ? 0 : 1;
  if (Math.sign(before) !== Math.sign(after)) return `${teamNames[leader]} take the lead`;
  return `${teamNames[leader]} lead ${Math.abs(after) < Math.abs(before) ? 'cut' : 'up'} to ${Math.abs(after)}`;
}

/** One compact card: the raid in words, who, what it did to the score. A moment gets the hand-drawn title. */
function RaidSummary({ e, names, roster, halfMs, hand }) {
  const out = playersOut(e, roster);
  const raiderOut = ['tackled', 'selfOut', 'doOrDieFailure'].includes(e.outcome);
  const scorer = scorerOf(e);
  const title = hand && e.allOut !== null && !e.superTackle ? 'All out' : outcomeWords(e, names);
  return (
    <div className="k4w-sum">
      <div className="k4w-sum-main">
        <h3 className={`k4w-sum-title k4w-ul-${sideKey(e.allOut !== null ? 1 - e.allOut : e.superTackle ? 1 - e.team : e.team)}`}>
          <i className={`kit-live-team-dot k4w-dot-${sideKey(e.team)}`} aria-hidden="true" />
          {hand ? <HandUnderline>{title}</HandUnderline> : title}
        </h3>
        <p>Raider: <b>{playerLabel(roster, e.raiderSlot)}</b>{raiderOut ? <> · <b>out</b></> : out.length > 0 && <> · Out: <b>{joinNames(out)}</b></>}</p>
        <p className="k4w-sum-lead">{leadLine(e, names)}</p>
      </div>
      <div className="k4w-sum-r">
        <b>{e.score[0]}–{e.score[1]}</b>
        {scorer !== null && <small className={`k4w-pill k4w-pill-${sideKey(scorer)}`}>+{e.points[scorer]}</small>}
      </div>
      <span className="k4w-chip">{atMinute(e, halfMs)}</span>
    </div>
  );
}
RaidSummary.propTypes = {
  e: PropTypes.object.isRequired, names: PropTypes.array.isRequired, roster: PropTypes.array, halfMs: PropTypes.number.isRequired, hand: PropTypes.bool,
};

function LastRaid({ entry, names, roster, halfMs, total, onAll }) {
  if (!entry) return null;
  return (
    <section className="k4w-card k4w-last" aria-label="Last raid">
      <div className="k4w-card-head">
        <h2>Last raid</h2>
        <button type="button" className="k4w-all" onClick={onAll}>All {total} raids</button>
      </div>
      <RaidSummary e={entry} names={names} roster={roster} halfMs={halfMs} hand={isMoment(entry)} />
    </section>
  );
}
LastRaid.propTypes = {
  entry: PropTypes.object, names: PropTypes.array.isRequired, roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired, onAll: PropTypes.func.isRequired,
};

/* ------------------------------------------------------------------ full time */

function Result({ result, live, match, story, names, roster, halfMs }) {
  const halves = halfStory(match);
  const turns = turningPoints(story);
  return (
    <>
      <section className="k4w-card k4w-result" aria-label="Result">
        <h2>
          {result.winner !== null && <i className={`kit-live-team-dot k4w-dot-${sideKey(result.winner)}`} aria-hidden="true" />}
          {result.line}
        </h2>
        <p>Final {live.totals[0]}–{live.totals[1]} · {story.length} raids</p>
        <div className="k4w-result-halves">
          {halves.map((h) => (
            <span key={h.half}><small>{halfName(h.half)}</small><b>{h.points[0]}–{h.points[1]}</b></span>
          ))}
        </div>
      </section>
      {turns.length > 0 && (
        <section aria-label="Turning points">
          <div className="kit-sec"><h2>Turning points</h2></div>
          <ol className="k4w-turns">
            {turns.map((e) => (
              <li key={e.id} className="k4w-card"><RaidSummary e={e} names={names} roster={roster} halfMs={halfMs} hand /></li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
Result.propTypes = {
  result: PropTypes.object.isRequired, live: PropTypes.object.isRequired, match: PropTypes.object.isRequired,
  story: PropTypes.array.isRequired, names: PropTypes.array.isRequired, roster: PropTypes.array, halfMs: PropTypes.number.isRequired,
};

/* ------------------------------------------------------------------ page */

/**
 * `showOut` puts the "off the court" moment under the card of whoever just lost players. `courtStage`
 * pins the court to a moment ('idle' | 'raid' | 'result'); a real page leaves it unset and the court
 * follows the raids as they arrive.
 */
export default function KabaddiWatchR4({ match, now, roster, initialTab = 'live', showOut = false, courtStage }) {
  const [tab, setTab] = useState(initialTab);
  const vars = useMemo(() => {
    const [A, B] = match.state.teams.map((t) => t.colours);
    return { ...teamColourVars(A?.core ? { A, B } : deriveTeamColours()), ...sportIdentityVars('kabaddi') };
  }, [match]);
  const live = liveNow(match, now);
  const story = raidStory(match);
  const result = resultOf(live);
  const names = live.names;
  const last = story.at(-1);
  const halfMs = match.state.rules.halfMs;
  const stage = useCourtStage(live, last, courtStage);
  const tabs = [['live', result ? 'Result' : 'Live'], ['raids', 'Raids'], ['stats', 'Stats']];
  const current = tabs.some(([id]) => id === tab) ? tab : 'live';
  const outs = [0, 1].map((t) => (showOut && last && !result && !live.raid && last.allOut !== t
    ? last.lostSlots[t].map((slot) => playerLabel(roster, slot)) : []));

  let body;
  if (current === 'raids') {
    body = <KabaddiRaidsR4 match={match} story={story} names={names} roster={roster} halfMs={halfMs} />;
  } else if (current === 'stats') {
    body = <KabaddiProgressR4 match={match} story={story} live={live} halfMs={halfMs} />;
  } else if (result) {
    body = <Result result={result} live={live} match={match} story={story} names={names} roster={roster} halfMs={halfMs} />;
  } else {
    body = (
      <>
        <KabaddiCourtR4 live={live} last={last} roster={roster} stage={stage} />
        <LastRaid entry={last} names={names} roster={roster} halfMs={halfMs} total={story.length} onAll={() => setTab('raids')} />
      </>
    );
  }

  return (
    <div className="kit-screen k4w" style={vars}>
      <KitWash from={sportIdentity('kabaddi')?.tint} to={sportIdentity('kabaddi')?.tint} />
      <Header live={live} halfMins={Math.round(halfMs / 60000)} />
      <ScoreStrip live={live} result={result} roster={roster} outs={outs} />
      <div className="kit-seg k4w-tabs" role="tablist" aria-label="Match views" style={{ '--kit-seg-cols': tabs.length }}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={current === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <main className="k4w-body">{body}</main>
    </div>
  );
}

KabaddiWatchR4.propTypes = {
  match: PropTypes.object.isRequired,
  now: PropTypes.number.isRequired,
  roster: PropTypes.array,
  initialTab: PropTypes.oneOf(['live', 'raids', 'stats']),
  showOut: PropTypes.bool,
  courtStage: PropTypes.oneOf(['idle', 'raid', 'result']),
};
