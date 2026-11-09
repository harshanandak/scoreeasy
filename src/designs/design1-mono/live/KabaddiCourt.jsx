import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { clockText, playerLabel } from '../../../utils/kabaddiLiveModel';
import { scorerOf } from './kabaddiView';
import SportMark from '../kit/SportMark';
import './kabaddiCourt.css';

// The Live tab's court, round 5 (notes: E:/tmp/kabaddi-k2/viewer-r5/NOTES.md). A broadcast-style
// mat in plain SVG (no 3D library, no assets): true perspective, a 13 x 10 m court with its real
// lines (midline, baulk, bonus, lobby strips), panel seams, and team-tinted halves. The raider is
// the one hero token (spotlight, name tag, speed chevrons); defenders are plain tokens and only
// exist during a raid. It never draws seven people a side; the strip above says who is on the mat.
// One raid animation (raid starts, touches or tackle, resolve) and game-sense callouts on the court
// (do or die, super tackle, bonus line, all out). Every outcome, count and name comes from
// kabaddiLiveModel (the engine's own log), never from here.

const key = (team) => (team === 0 ? 'a' : 'b');
const HOLD_MS = 3200; // how long the outcome stays up before the court goes calm
const OUT_RAID = ['tackled', 'selfOut', 'doOrDieFailure'];

/* ---- perspective: court metres (x along the length, y across, y = 0 is the near sideline) ---- */
const L = 13;
const W = 10;
const MID = L / 2;
const LOBBY = 0.75;
const U = 22; // screen units per metre along the near sideline
const K = 0.5; // perspective strength: the far sideline is 1 / (1 + K) as wide as the near one
const CX = 170;
const BOTTOM = 211; // screen y of the near sideline
const H = 170; // screen height of the court from the near to the far sideline
const APRON = 0.6; // run-off around the lines
const TH = 6; // slab thickness
const VIEW = `0 0 340 ${BOTTOM + 30}`;

const scaleAt = (y) => 1 / (1 + (K * y) / W);
const depthAt = (y) => ((1 + K) * (y / W)) / (1 + (K * y) / W);
const P = (x, y, z = 0) => {
  const s = scaleAt(y);
  return [CX + (x - MID) * U * s, BOTTOM - H * depthAt(y) - z * s];
};
const pts = (list) => list.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(',')).join(' ');
const rect = (x0, y0, x1, y1) => pts([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const move = ([x, y]) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;

/** A point `d` metres past the midline, from the raiding team's side (negative = own side). */
const spot = (team, d, y = W / 2) => P(team === 0 ? MID + d : MID - d, y);
const sideX = (team, d) => (team === 0 ? MID + d : MID - d);

/** Defenders stand in a shallow arc inside their half, in front of the end zone. */
function chain(defender, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const y = n === 1 ? W / 2 : 1.5 + t * (W - 3);
    const bow = n === 1 ? 0 : 0.6 * (1 - (2 * t - 1) ** 2);
    const x = sideX(1 - defender, 3.0 + bow); // the half past the midline from the raider
    return { x, y };
  });
}

/** Which tokens go out: the ones nearest the middle of the arc, as many as the engine took off the mat. */
function outIndexes(spots, k) {
  return new Set([...spots.keys()].sort((a, b) => Math.abs(spots[a].y - W / 2) - Math.abs(spots[b].y - W / 2) || a - b).slice(0, k));
}

/* ---- tokens ---- */

/** The raider: a stylised kit-shaded pawn with a sash. Drawn 26 units tall, scaled by its caller. */
function Pawn({ side }) {
  return (
    <g className={`kc-pawn kc-pawn-${side}`}>
      <ellipse className="kc-shadow" cx="0" cy="0" rx="10" ry="3.6" />
      <path className="kc-body" d="M-7.6 0C-8.2 -8.8 -5.6 -16 0 -16S8.2 -8.8 7.6 0Z" />
      <path className="kc-sash" d="M-7.9 -9.2L7.7 -13.2L8 -10L-7.5 -6Z" />
      <circle className="kc-head" cx="0" cy="-21.4" r="5.8" />
      <ellipse className="kc-gloss" cx="-1.9" cy="-23.3" rx="2.1" ry="1.4" />
    </g>
  );
}
Pawn.propTypes = { side: PropTypes.oneOf(['a', 'b']).isRequired };

/** A defender: a short dome on a floor ring. Just a head count on the mat, never a figure. */
function Token({ x, y, side, out, tackle, ready, i }) {
  const [sx, sy] = P(x, y);
  const s = scaleAt(y);
  const base = 7.4;
  return (
    <g transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${(s * 1.7).toFixed(3)})`}>
      <g className={`kc-def kc-def-${side}${out ? ' is-out' : ''}${tackle ? ' is-tackle' : ''}${ready ? ' is-ready' : ''}`} style={{ '--i': i }}>
        <ellipse className="kc-def-shadow" cx="1.4" cy="1.2" rx={base + 1} ry="3.4" />
        <ellipse className="kc-def-ring" cx="0" cy="0" rx={base} ry={base * 0.4} />
        <path className="kc-def-dome" d={`M${-base + 1.4} -1.2C${-base + 1.4} -11 ${base - 1.4} -11 ${base - 1.4} -1.2Z`} fill={`url(#kc-h-${side})`} />
        <ellipse className="kc-gloss" cx="-2.2" cy="-7" rx="2" ry="1.2" />
      </g>
    </g>
  );
}
Token.propTypes = {
  x: PropTypes.number.isRequired, y: PropTypes.number.isRequired, side: PropTypes.string.isRequired,
  out: PropTypes.bool, tackle: PropTypes.bool, ready: PropTypes.bool, i: PropTypes.number.isRequired,
};

/** The raider's name flag. Wide enough for the name (a rough glyph width; it is a label, not a measure). */
function Tag({ text, tone }) {
  const label = text.length > 11 ? `${text.slice(0, 10)}…` : text;
  const w = label.length * 4.3 + 9;
  return (
    <g className={`kc-tag kc-tag-${tone}`} transform="translate(0 -52)">
      <rect x={-w / 2} y="-5.6" width={w} height="11.2" rx="5.6" />
      <path d="M-2.4 5.4L0 8.6L2.4 5.4Z" />
      <text x="0" y="2.6" textAnchor="middle">{label}</text>
    </g>
  );
}
Tag.propTypes = { text: PropTypes.string.isRequired, tone: PropTypes.string.isRequired };

function Defs() {
  return (
    <defs>
      {['a', 'b'].map((s) => (
        <g key={s}>
          <linearGradient id={`kc-g-${s}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: `var(--team-${s}-hi)` }} />
            <stop offset="0.55" style={{ stopColor: `var(--team-${s}-core)` }} />
            <stop offset="1" style={{ stopColor: `var(--team-${s}-lo)` }} />
          </linearGradient>
          <radialGradient id={`kc-h-${s}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" style={{ stopColor: `var(--team-${s}-hi)` }} />
            <stop offset="0.7" style={{ stopColor: `var(--team-${s}-core)` }} />
            <stop offset="1" style={{ stopColor: `var(--team-${s}-lo)` }} />
          </radialGradient>
          <radialGradient id={`kc-halo-${s}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" style={{ stopColor: `var(--team-${s}-core)`, stopOpacity: 0.55 }} />
            <stop offset="1" style={{ stopColor: `var(--team-${s}-core)`, stopOpacity: 0 }} />
          </radialGradient>
        </g>
      ))}
      <linearGradient id="kc-light" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stopColor="white" stopOpacity="0" />
        <stop offset="1" stopColor="white" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="kc-sheen" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="white" stopOpacity="0" />
        <stop offset="0.5" stopColor="white" stopOpacity="0.45" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/* ---- the mat ---- */

function Mat({ live, showResult, last }) {
  const seamsX = Array.from({ length: L - 1 }, (_, i) => i + 1);
  const seamsY = Array.from({ length: W - 1 }, (_, i) => i + 1);
  const allOutHalf = showResult && last?.allOut !== null && last?.allOut !== undefined ? last.allOut : null;
  const superHalf = live.superTackleOn && !showResult ? live.defender : null;
  const half = (team) => (team === 0 ? rect(0, 0, MID, W) : rect(MID, 0, L, W));
  const bonusX = (team) => sideX(1 - team, 4.75); // bonus line of `team`'s half
  const baulkX = (team) => sideX(1 - team, 3.75);
  return (
    <>
      <polygon className="kc-ground" points={rect(-APRON - 0.5, -APRON - 0.3, L + APRON + 0.5, W + APRON + 0.2)} />
      <polygon className="kc-front" points={`${P(-APRON, -APRON).join(',')} ${P(L + APRON, -APRON).join(',')} ${P(L + APRON, -APRON).map((n, i) => (i ? n + TH : n)).join(',')} ${P(-APRON, -APRON).map((n, i) => (i ? n + TH : n)).join(',')}`} />
      <polygon className="kc-apron" points={rect(-APRON, -APRON, L + APRON, W + APRON)} />
      <polygon className="kc-floor kc-floor-a" points={half(0)} />
      <polygon className="kc-floor kc-floor-b" points={half(1)} />
      {seamsX.map((x) => <polyline key={`x${x}`} className="kc-seam" points={pts([[x, 0], [x, W]])} />)}
      {seamsY.map((y) => <polyline key={`y${y}`} className="kc-seam" points={pts([[0, y], [L, y]])} />)}
      <polygon className="kc-lobby" points={rect(0, 0, L, LOBBY)} />
      <polygon className="kc-lobby" points={rect(0, W - LOBBY, L, W)} />
      <polygon className="kc-light" points={rect(0, 0, L, W)} fill="url(#kc-light)" />
      {superHalf !== null && <polygon className="kc-super" points={half(superHalf)} />}
      {allOutHalf !== null && <polygon className={`kc-sweep kc-sweep-${key(allOutHalf)}`} points={half(allOutHalf)} />}
      <polygon className="kc-edge" points={rect(0, 0, L, W)} />
      {[0, 1].map((t) => <polyline key={`k${t}`} className="kc-line" points={pts([[baulkX(t), 0], [baulkX(t), W]])} />)}
      {[0, 1].map((t) => (
        <polyline key={`b${t}`} className={`kc-line kc-line-bonus${live.bonusLive && live.defender === t && !showResult ? ' is-live' : ''}`} points={pts([[bonusX(t), 0], [bonusX(t), W]])} />
      ))}
      <polyline className="kc-line kc-line-lobby" points={pts([[0, LOBBY], [L, LOBBY]])} />
      <polyline className="kc-line kc-line-lobby" points={pts([[0, W - LOBBY], [L, W - LOBBY]])} />
      <polyline className="kc-line kc-line-mid" points={pts([[MID, 0], [MID, W]])} />
    </>
  );
}
Mat.propTypes = { live: PropTypes.object.isRequired, showResult: PropTypes.bool, last: PropTypes.object };

/** Floor lettering: tiny legend on the run-off so the lines read, and the team names in the end zones. */
function Lettering({ names }) {
  const tick = (x, y, text, down) => {
    const [tx, ty] = P(x, y);
    return <text key={text + x} className="kc-legend" x={tx} y={ty + (down ? 2.3 : 0)} textAnchor="middle">{text}</text>;
  };
  const zone = (team) => {
    const [zx, zy] = P(sideX(1 - team, 5.65), W / 2);
    const name = names[team].length > 9 ? `${names[team].slice(0, 8)}…` : names[team];
    return (
      <text key={team} className={`kc-zone kc-zone-${key(team)}`} transform={`translate(${zx.toFixed(1)} ${zy.toFixed(1)}) rotate(${team === 0 ? -90 : 90})`} textAnchor="middle">{name.toUpperCase()}</text>
    );
  };
  return (
    <>
      {[0, 1].map((t) => tick(sideX(1 - t, 3.75), -APRON * 0.45, 'BAULK', true))}
      {[0, 1].map((t) => tick(sideX(1 - t, 4.75), W + APRON * 0.7, 'BONUS', true))}
      {zone(0)}
      {zone(1)}
    </>
  );
}
Lettering.propTypes = { names: PropTypes.array.isRequired };

/* ---- what the raid came to, in the words a viewer wants on the court ---- */

function resolution(e, names) {
  const team = e.team;
  const def = 1 - team;
  const scorer = scorerOf(e);
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
    allOut: e.allOut !== null ? names[e.allOut] : null,
    defenderName: names[def],
  };
}

function kindOf(e) {
  if (OUT_RAID.includes(e.outcome)) return e.outcome === 'tackled' ? 'tackle' : 'out';
  if (e.outcome === 'bonus') return 'bonus';
  if (e.outcome === 'empty') return 'empty';
  return 'touch';
}

/** How far past the midline the raider gets, per outcome (metres). */
const REACH = { touch: 3.0, tackle: 2.7, out: 1.2, bonus: 5.0, empty: 0.9 };
const SIDE_CHEV = (team) => (team === 0 ? 1 : -1);

/** Three chevrons lying on the floor across the midline, pointing the way the raid goes. */
function Chevrons({ team, y = W / 2 }) {
  const d = SIDE_CHEV(team);
  return (
    <g className="kc-chevs">
      {[-1.9, 0, 1.9].map((off, i) => (
        <polyline key={off} className="kc-chev" style={{ '--c': i }} points={pts([[MID + off * 0.5 * d - 0.35 * d, y - 0.85], [MID + off * 0.5 * d + 0.35 * d, y], [MID + off * 0.5 * d - 0.35 * d, y + 0.85]])} />
      ))}
    </g>
  );
}
Chevrons.propTypes = { team: PropTypes.number.isRequired, y: PropTypes.number };

function Scene({ stage, live, entry, raiderName }) {
  const raiding = stage === 'raid';
  const team = raiding ? live.raid.team : entry.team;
  const def = 1 - team;
  const n = raiding ? live.raid.defendersAtStart : entry.defendersAtStart;
  const kind = !raiding ? kindOf(entry) : null;
  const spots = chain(def, n);
  const gone = !raiding ? outIndexes(spots, entry.allOut === def ? n : entry.lost[def]) : new Set();
  const tackled = kind === 'tackle';
  const side = key(team);
  const dod = raiding ? live.doOrDie : entry.doOrDie;
  const yMid = W / 2;
  const poses = {
    '--tH': move(spot(team, -2.4, yMid + 0.6)),
    '--tE': move(spot(team, 1.5, yMid - 0.1)),
    '--tT': move(spot(team, REACH[kind ?? 'touch'], yMid - 0.5)),
  };
  const bonusAt = [sideX(team, 4.75)];
  const k = scaleAt(yMid) * 2.5;
  const d = SIDE_CHEV(team);
  return (
    <>
      {raiding && <Chevrons team={team} />}
      {spots.map((s, i) => (
        <Token key={`${stage}-${i}`} x={s.x} y={s.y} side={key(def)} out={gone.has(i)} tackle={tackled} ready={raiding} i={i} />
      ))}
      {kind === 'bonus' && <polyline className="kc-bonus-flash" points={pts([[bonusAt[0], 0], [bonusAt[0], W]])} />}
      <g key={`${stage}-${entry?.id ?? live.raid?.number}`} className={`kc-raider kc-raider-${side} ${raiding ? 'kc-enter' : `kc-r-${kind}`}${!raiding && (kind === 'tackle' || kind === 'out') ? ' kc-raider-out' : ''}`} style={poses}>
        <g transform={`scale(${k.toFixed(3)})`}>
          <ellipse className={`kc-halo kc-halo-${side}`} cx="0" cy="0" rx="22" ry="8" fill={`url(#kc-halo-${side})`} />
          <ellipse className={`kc-ring kc-ring-${side}`} cx="0" cy="0" rx="12" ry="4.2" />
          {raiding && (
            <g transform={`scale(${d} 1)`}>
              {[0, 1, 2].map((i) => <path key={i} className="kc-speed" style={{ '--c': i }} d={`M${-16 - i * 5.6} -14l4.6 -4.6M${-16 - i * 5.6} -14l4.6 4.6`} />)}
            </g>
          )}
          <g className="kc-hop"><Pawn side={side} /></g>
          <Tag text={raiderName} tone={dod ? 'dod' : side} />
        </g>
      </g>
    </>
  );
}
Scene.propTypes = {
  stage: PropTypes.string.isRequired, live: PropTypes.object.isRequired, entry: PropTypes.object, raiderName: PropTypes.string.isRequired,
};

/** Between raids: the raiding team's ghost token at its start spot and chevrons pointing across the midline. */
function Calm({ team }) {
  const side = key(team);
  const k = scaleAt(W / 2) * 2.5;
  const [x, y] = spot(team, -2.4, W / 2 + 0.6);
  return (
    <>
      <Chevrons team={team} />
      <g className="kc-ghost" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)})`}>
        <ellipse className={`kc-halo kc-halo-${side}`} cx="0" cy="0" rx="22" ry="8" fill={`url(#kc-halo-${side})`} />
        <ellipse className={`kc-ring kc-ring-${side} kc-ring-dash`} cx="0" cy="0" rx="12" ry="4.2" />
        <g className="kc-hop"><Pawn side={side} /></g>
      </g>
    </>
  );
}
Calm.propTypes = { team: PropTypes.number.isRequired };

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

/** The raid clock: a ring that drains over the 30 s in the raiding team's colour. */
function RaidClock({ ms, team, durationMs }) {
  const frac = Math.max(0, Math.min(1, ms / durationMs));
  return (
    <span className={`kc-clock kc-clock-${key(team)}`} role="timer" aria-label={`Raid clock ${Math.ceil(ms / 1000)} seconds`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="kc-clock-track" cx="24" cy="24" r="20" />
        <circle className="kc-clock-arc" cx="24" cy="24" r="20" pathLength="100" strokeDasharray={`${frac * 100} 100`} />
      </svg>
      <b>{Math.ceil(ms / 1000)}</b><small>sec</small>
    </span>
  );
}
RaidClock.propTypes = { ms: PropTypes.number.isRequired, team: PropTypes.number.isRequired };

/** The last raids as dots: who scored (colour), empty raids hollow, super tackles and all outs ringed in gold. */
function Form({ story, names }) {
  const recent = story.slice(-12);
  if (recent.length === 0) return null;
  const spoken = recent.map((e) => {
    const s = scorerOf(e);
    return `Raid ${e.number}: ${s === null ? 'no points' : `${names[s]} +${e.points[s]}`}`;
  }).join('. ');
  return (
    <div className="kc-form" role="img" aria-label={`Last ${recent.length} raids. ${spoken}`}>
      <span className="kc-form-t">Last {recent.length} raids</span>
      <span className="kc-form-dots" aria-hidden="true">
        {recent.map((e, i) => {
          const s = scorerOf(e);
          const big = e.superTackle || e.allOut !== null;
          return (
            <i
              key={e.id}
              className={`kc-fd${s === null ? ' is-none' : ` kc-fd-${key(s)}`}${big ? ' is-big' : ''}${i === recent.length - 1 ? ' is-last' : ''}`}
              style={{ '--i': i }}
            >
              {s !== null ? e.points[s] : ''}
            </i>
          );
        })}
      </span>
    </div>
  );
}
Form.propTypes = { story: PropTypes.array.isRequired, names: PropTypes.array.isRequired };

export default function KabaddiCourt({ live, last, roster, stage, story = [] }) {
  const names = live.names;
  const raiding = stage === 'raid' && live.raid;
  const showResult = stage === 'result' && last;
  const next = live.raider;
  const res = showResult ? resolution(last, names) : null;
  const raiderSlot = raiding ? live.raid.raiderSlot : last?.raiderSlot;
  const raiderName = playerLabel(roster, raiderSlot) ?? `Raid ${raiding ? live.raid.number : last?.number}`;
  const teamNow = raiding ? live.raid.team : showResult ? last.team : next;
  const label = raiding
    ? <><b>{names[live.raid.team]}</b> raiding</>
    : showResult
      ? <>Raid {last.number} · <b>{names[last.team]}</b></>
      : live.phase === 'halfTime' ? <b>Half time</b> : live.phase === 'paused' ? <b>Clock paused</b> : <><b>{names[next]}</b> raid next · Raid {live.nextRaidNumber}</>;
  const dod = showResult ? last.doOrDie : live.inPlay && live.doOrDie;
  const superOn = live.inPlay && !showResult && live.superTackleOn;
  return (
    <section className="kc-card" aria-label="Court" data-stage={stage}>
      <div className="kc-head">
        <span className={`kc-who kc-who-${key(teamNow)}`}>
          <SportMark sportId="kabaddi" className="kc-mark" />
          <span>{label}</span>
        </span>
        {live.inPlay && !showResult && <span className="kc-mat" aria-hidden="true"><i className="kc-dot-a" />{live.mat[0]}<em>on mat</em><i className="kc-dot-b" />{live.mat[1]}</span>}
      </div>
      <div className={`kc-stage${raiding ? ' is-raid' : ''}${showResult ? ' is-result' : ''}`}>
        <svg viewBox={VIEW} role="img" className="kc-svg" aria-label={`Court: ${names[0]} ${live.mat[0]} on the mat, ${names[1]} ${live.mat[1]} on the mat${raiding ? `, ${names[live.raid.team]} raiding` : ''}`}>
          <Defs />
          <Mat live={live} showResult={!!showResult} last={last} />
          <Lettering names={names} />
          {(raiding || showResult) && <Scene stage={raiding ? 'raid' : 'result'} live={live} entry={last} raiderName={raiderName} />}
          {!raiding && !showResult && live.inPlay && <Calm team={next} />}
        </svg>
        <div className="kc-over kc-over-tl">
          {(dod && (live.inPlay || showResult)) && <em className="kc-cue kc-cue-dod">Do or die</em>}
          {superOn && <em className="kc-cue kc-cue-super">Super tackle on</em>}
          {live.inPlay && !showResult && live.bonusLive && !raiding && <em className="kc-cue kc-cue-bonus">Bonus line live</em>}
        </div>
        {raiding && live.raid.leftMs !== null && <div className="kc-over kc-over-tr"><RaidClock ms={live.raid.leftMs} team={live.raid.team} durationMs={live.raid.durationMs} /></div>}
        {showResult && last.allOut !== null && (
          <div className="kc-allout" role="status"><span>All out</span><small>{names[last.allOut]} are all out</small></div>
        )}
        {res && (
          <div className="kc-chips" role="status">
            <em className={`kc-chip kc-chip-${res.tone}`}>{res.main}</em>
            {res.points && <em className={`kc-chip kc-chip-pts kc-chip-pts-${key(res.points.team)}`}>{res.points.text}</em>}
          </div>
        )}
      </div>
      <Form story={story} names={names} />
    </section>
  );
}

KabaddiCourt.propTypes = {
  live: PropTypes.object.isRequired,
  last: PropTypes.object,
  roster: PropTypes.array,
  stage: PropTypes.oneOf(['idle', 'raid', 'result']).isRequired,
  story: PropTypes.array,
};
