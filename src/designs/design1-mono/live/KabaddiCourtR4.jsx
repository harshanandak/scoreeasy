import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { clockText, playerLabel } from '../../../utils/kabaddiLiveModel';
import './kabaddiCourtR4.css';

// The Live tab's court, round 4: a stylised isometric slab drawn in plain SVG (no 3D library, no
// assets). It never draws seven people a side; the strip above already shows who is on the mat.
// It plays one short raid animation: the raider crosses the midline while the raid clock runs, then
// the outcome settles (touches, tackle, bonus, back safe) and the court goes calm again. Every
// outcome, count and name comes from kabaddiLiveModel (the engine's own log), never from here.

const key = (team) => (team === 0 ? 'a' : 'b');
const HOLD_MS = 3200; // how long the outcome stays up before the court goes calm
const OUT_RAID = ['tackled', 'selfOut', 'doOrDieFailure'];

/* ---- isometric projection: court metres (x along the length, y across) to screen units ---- */
const L = 13;
const W = 10;
const MID = L / 2;
const U = 21; // screen units per metre along the length
// 2.5D: the length runs almost level across the card, the width recedes up and to the right.
const EX = [U, 0.1 * U];
const EY = [-0.3 * U, 0.5 * U];
const P = (x, y, z = 0) => [x * EX[0] + y * EY[0], x * EX[1] + y * EY[1] - z];
const pts = (list) => list.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');
const TH = 7; // slab thickness
const VIEW = '-70 -12 348 160';
const FLOOR = `matrix(${EX[0]} ${EX[1]} ${EY[0]} ${EY[1]} 0 0)`; // court metres -> screen, for shapes drawn in the floor plane

/** A point `d` metres past the midline, from the raiding team's side (negative = own side). */
const spot = (team, d, y = W / 2) => P(team === 0 ? MID + d : MID - d, y);
const move = ([x, y]) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;

/** Defenders stand in a shallow arc behind the baulk line of the defending half. */
function chain(defender, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const y = n === 1 ? W / 2 : 1.1 + t * (W - 2.2);
    const bow = 0.55 * (1 - (2 * t - 1) ** 2) * (n === 1 ? 0 : 1);
    const d = 3.2 + bow;
    const [sx, sy] = P(defender === 1 ? MID + d : MID - d, y);
    return { sx, sy, y };
  });
}

/** Which discs go out: the ones nearest the middle of the arc, as many as the engine took off the mat. */
function outIndexes(spots, k) {
  return new Set([...spots.keys()].sort((a, b) => Math.abs(spots[a].y - W / 2) - Math.abs(spots[b].y - W / 2) || a - b).slice(0, k));
}

function Pawn({ side }) {
  return (
    <g className={`k4c-pawn k4c-pawn-${side}`}>
      <ellipse className="k4c-shadow" cx="0" cy="0" rx="9.5" ry="3.8" />
      <path className="k4c-body" d="M-7.4 0C-8 -8.6 -5.4 -15.6 0 -15.6S8 -8.6 7.4 0Z" />
      <path className="k4c-belt" d="M-7.1 -4.4Q0 -2.2 7.1 -4.4L7.3 -2.6Q0 -0.4 -7.3 -2.6Z" />
      <circle className="k4c-head" cx="0" cy="-20.6" r="5.6" />
      <ellipse className="k4c-gloss" cx="-1.8" cy="-22.4" rx="2" ry="1.4" />
    </g>
  );
}
Pawn.propTypes = { side: PropTypes.oneOf(['a', 'b']).isRequired };

function Defs() {
  return (
    <defs>
      {['a', 'b'].map((s) => (
        <g key={s}>
          <linearGradient id={`k4c-g-${s}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: `var(--team-${s}-hi)` }} />
            <stop offset="0.55" style={{ stopColor: `var(--team-${s}-core)` }} />
            <stop offset="1" style={{ stopColor: `var(--team-${s}-lo)` }} />
          </linearGradient>
          <radialGradient id={`k4c-h-${s}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" style={{ stopColor: `var(--team-${s}-hi)` }} />
            <stop offset="0.7" style={{ stopColor: `var(--team-${s}-core)` }} />
            <stop offset="1" style={{ stopColor: `var(--team-${s}-lo)` }} />
          </radialGradient>
        </g>
      ))}
      <linearGradient id="k4c-light" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="white" stopOpacity="0.28" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** What the raid came to, in the words a viewer wants on the court. */
function resolution(e, names) {
  const team = e.team;
  const def = 1 - team;
  const scorer = e.points[team] > 0 ? team : e.points[def] > 0 ? def : null;
  let main;
  let tone = 'plain';
  if (e.superTackle) { main = 'Super tackle'; tone = 'gold'; } else if (e.outcome === 'tackled') main = 'Tackled';
  else if (e.outcome === 'touch') main = `${e.touches} touch${e.touches === 1 ? '' : 'es'}${e.bonus ? ' + bonus' : ''} · back safe`;
  else if (e.outcome === 'bonus') main = 'Bonus line · back safe';
  else if (e.outcome === 'empty') main = 'Empty raid · back safe';
  else if (e.outcome === 'selfOut') main = 'Out of play';
  else if (e.outcome === 'doOrDieFailure') { main = 'Do or die lost'; tone = 'danger'; } else main = 'Referee ruling';
  return {
    main, tone,
    points: scorer === null ? null : { team: scorer, text: `+${e.points[scorer]} ${names[scorer]}` },
    allOut: e.allOut !== null ? `All out · ${names[e.allOut]}` : null,
  };
}

function kindOf(e) {
  if (OUT_RAID.includes(e.outcome)) return e.outcome === 'tackled' ? 'tackle' : 'out';
  if (e.outcome === 'bonus') return 'bonus';
  if (e.outcome === 'empty') return 'empty';
  return 'touch';
}

/** Raider pose (metres past the midline) at the three moments the animation needs. */
const REACH = { touch: 3.0, tackle: 2.7, out: 1.2, bonus: 5.0, empty: 0.9 };

function Scene({ stage, live, entry, names }) {
  const raiding = stage === 'raid';
  const team = raiding ? live.raid.team : entry.team;
  const def = 1 - team;
  const n = raiding ? live.raid.defendersAtStart : entry.defendersAtStart;
  const kind = !raiding ? kindOf(entry) : null;
  const spots = chain(def, n);
  const gone = !raiding ? outIndexes(spots, entry.allOut === def ? n : entry.lost[def]) : new Set();
  const tackled = kind === 'tackle';
  const side = key(team);
  const poses = {
    '--tH': move(spot(team, -2.5, W / 2 + 0.4)),
    '--tE': move(spot(team, 1.4, W / 2 - 0.2)),
    '--tT': move(spot(team, REACH[kind ?? 'touch'], W / 2 - 0.4)),
  };
  const bonusLine = P(def === 1 ? MID + 4.75 : MID - 4.75, 0);
  return (
    <>
      {spots.map((s, i) => (
        <g key={`${stage}-${i}`} transform={`translate(${s.sx.toFixed(1)} ${s.sy.toFixed(1)}) ${FLOOR}`}>
          <circle
            className={`k4c-disc k4c-disc-${key(def)}${gone.has(i) ? ' is-out' : ''}${tackled ? ' is-tackle' : ''}${raiding ? ' is-ready' : ''}`}
            r="0.5" vectorEffect="non-scaling-stroke" style={{ '--i': i }} fill={`url(#k4c-h-${key(def)})`}
          />
        </g>
      ))}
      {kind === 'bonus' && <polyline className="k4c-bonus-flash" points={`${bonusLine.join(',')} ${P(def === 1 ? MID + 4.75 : MID - 4.75, W).join(',')}`} />}
      <g key={`${stage}-${entry?.id ?? live.raid?.number}`} className={`k4c-raider k4c-raider-${side} ${raiding ? 'k4c-enter' : `k4c-r-${kind}`}${!raiding && (kind === 'tackle' || kind === 'out') ? ' k4c-raider-out' : ''}`} style={poses}>
        <g className="k4c-hop"><g transform="scale(1.5)"><Pawn side={side} /></g></g>
      </g>
    </>
  );
}
Scene.propTypes = {
  stage: PropTypes.string.isRequired, live: PropTypes.object.isRequired, entry: PropTypes.object, names: PropTypes.array.isRequired,
};

/**
 * Which moment the court is in. A real page sees the raid start (stage "raid"), then the raid event
 * arrive (stage "result", held for a few seconds), then calm. If the viewer only ever sees the
 * finished raid (a poll that missed the start), the result still plays. `force` is for the harness.
 */
export function useCourtStage(live, last, force) {
  const [stage, setStage] = useState(force ?? 'idle');
  const seen = useRef({ raid: live.raid?.number ?? null, last: last?.id ?? null });
  useEffect(() => {
    if (force) { setStage(force); return undefined; }
    const prev = seen.current;
    const raidNo = live.raid?.number ?? null;
    const lastId = last?.id ?? null;
    seen.current = { raid: raidNo, last: lastId };
    if (raidNo !== null) { setStage('raid'); return undefined; }
    if (lastId !== null && lastId !== prev.last) {
      setStage('result');
      const t = setTimeout(() => setStage('idle'), HOLD_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [live.raid?.number, last?.id, force]);
  return live.raid ? 'raid' : stage === 'raid' ? 'idle' : stage;
}

export default function KabaddiCourtR4({ live, last, roster, stage }) {
  const names = live.names;
  const raiding = stage === 'raid' && live.raid;
  const showResult = stage === 'result' && last;
  const next = live.raider;
  const secs = live.raid ? Math.ceil(live.raid.leftMs / 1000) : null;
  const res = showResult ? resolution(last, names) : null;
  const label = raiding
    ? <><b>{playerLabel(roster, live.raid.raiderSlot)}</b> raiding for {names[live.raid.team]}</>
    : showResult
      ? <>Raid {last.number} · <b>{names[last.team]}</b></>
      : live.phase === 'halfTime' ? <b>Half time</b> : live.phase === 'paused' ? <b>Clock paused</b> : <><b>{names[next]}</b> raid next · Raid {live.nextRaidNumber}</>;
  return (
    <section className="k4c-card" aria-label="Court" data-stage={stage}>
      <div className="k4c-head">
        <span className={`k4c-who k4c-who-${key(raiding ? live.raid.team : showResult ? last.team : next)}`}>
          <i className="k4c-mark" aria-hidden="true" />
          <span>{label}</span>
        </span>
        {raiding && <span className={`k4c-clock k4c-clock-${key(live.raid.team)}`}>{clockText(live.raid.leftMs).replace(/^0:/, '')}s</span>}
        {(live.inPlay && !showResult) && (
          <span className="k4c-cues">
            {live.doOrDie && <em className="k4c-cue k4c-cue-dod">Do or die</em>}
            {live.superTackleOn && <em className="k4c-cue k4c-cue-super">Super tackle on</em>}
          </span>
        )}
      </div>
      {raiding && <span className={`k4c-track k4c-track-${key(live.raid.team)}`} aria-hidden="true"><i style={{ width: `${(live.raid.leftMs / 30000) * 100}%` }} /></span>}
      <div className={`k4c-stage${raiding ? ' is-raid' : ''}${showResult ? ' is-result' : ''}`}>
        <svg viewBox={VIEW} role="img" className="k4c-svg" aria-label={`Court: ${names[0]} ${live.mat[0]} on the mat, ${names[1]} ${live.mat[1]} on the mat${raiding ? `, ${names[live.raid.team]} raiding` : ''}`}>
          <Defs />
          <polygon className="k4c-ground" points={pts([[-0.4, 0.4, -TH], [L + 0.4, 0.4, -TH], [L + 0.4, W + 0.4, -TH], [-0.4, W + 0.4, -TH]])} />
          <polygon className="k4c-side k4c-side-y" points={pts([[0, W, 0], [L, W, 0], [L, W, -TH], [0, W, -TH]])} />
          <polygon className="k4c-side k4c-side-x" points={pts([[L, 0, 0], [L, W, 0], [L, W, -TH], [L, 0, -TH]])} />
          <polygon className="k4c-floor k4c-floor-a" points={pts([[0, 0], [MID, 0], [MID, W], [0, W]])} />
          <polygon className="k4c-floor k4c-floor-b" points={pts([[MID, 0], [L, 0], [L, W], [MID, W]])} />
          <polygon className="k4c-light" points={pts([[0, 0], [L, 0], [L, W], [0, W]])} fill="url(#k4c-light)" />
          <polygon className="k4c-edge" points={pts([[0, 0], [L, 0], [L, W], [0, W]])} />
          {[MID - 3.75, MID + 3.75].map((x) => <polyline key={x} className="k4c-line" points={pts([[x, 0], [x, W]])} />)}
          {[MID - 4.75, MID + 4.75].map((x) => <polyline key={x} className="k4c-line k4c-line-bonus" points={pts([[x, 0], [x, W]])} />)}
          <polyline className="k4c-line k4c-line-mid" points={pts([[MID, 0], [MID, W]])} />
          {live.superTackleOn && !showResult && (
            <polygon
              className="k4c-super"
              points={pts(live.defender === 0 ? [[0, 0], [MID, 0], [MID, W], [0, W]] : [[MID, 0], [L, 0], [L, W], [MID, W]])}
            />
          )}
          {(raiding || showResult) && <Scene stage={raiding ? 'raid' : 'result'} live={live} entry={last} names={names} />}
        </svg>
        {!raiding && !showResult && live.inPlay && (
          <i className={`k4c-next k4c-next-${key(next)}`} aria-hidden="true" style={{ left: next === 0 ? '30%' : '70%', top: next === 0 ? '44%' : '53%' }} />
        )}
        {res && (
          <div className="k4c-chips" role="status">
            <em className={`k4c-chip k4c-chip-${res.tone}`}>{res.main}</em>
            {res.points && <em className={`k4c-chip k4c-chip-pts k4c-chip-pts-${key(res.points.team)}`}>{res.points.text}</em>}
            {res.allOut && <em className="k4c-chip k4c-chip-gold">{res.allOut}</em>}
          </div>
        )}
      </div>
    </section>
  );
}

KabaddiCourtR4.propTypes = {
  live: PropTypes.object.isRequired,
  last: PropTypes.object,
  roster: PropTypes.array,
  stage: PropTypes.oneOf(['idle', 'raid', 'result']).isRequired,
};
