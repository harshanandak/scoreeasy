import PropTypes from 'prop-types';
import { pointsBreakdown, progression } from '../../../utils/kabaddiLiveModel';
import { halfName, sideKey } from './kabaddiView';

// Stats tab, round 4: how the game is going. Score and lead by raid (drawn in), momentum per
// 5-minute block, where the points came from, raid success, all outs and super tackles. All of it
// is folded from the engine log by kabaddiLiveModel (progression, pointsBreakdown, raidStory).

const CW = 320;
const CH = 118;
const X0 = 8;
const X1 = CW - 28;
const YT = 10;
const YB = 96;
const LEAD_MID = CH + 24;

function Dot({ team }) {
  return <i className={`kit-live-team-dot k4w-dot-${sideKey(team)}`} aria-hidden="true" />;
}
Dot.propTypes = { team: PropTypes.number.isRequired };

function Card({ title, note, children, label }) {
  return (
    <section className="k4w-card k4w-stat" aria-label={label ?? title}>
      <div className="k4w-stat-head"><h2>{title}</h2>{note && <span>{note}</span>}</div>
      {children}
    </section>
  );
}
Card.propTypes = { title: PropTypes.string.isRequired, note: PropTypes.node, children: PropTypes.node.isRequired, label: PropTypes.string };

/* ---- score and lead by raid ---- */
function Race({ prog, names }) {
  const { series, biggest } = prog;
  const n = series.length - 1;
  if (n < 1) return <Card title="Score by raid"><p className="k4w-empty">The chart starts with the first raid.</p></Card>;
  const end = series.at(-1);
  const maxScore = Math.max(1, ...series.flatMap((s) => s.score));
  const maxLead = Math.max(1, biggest.margin);
  const x = (i) => X0 + (i / n) * (X1 - X0);
  const y = (v) => YB - (v / maxScore) * (YB - YT);
  const line = (t) => series.map((s, i) => `${x(i).toFixed(1)},${y(s.score[t]).toFixed(1)}`).join(' ');
  const firstSecond = series.findIndex((s, i) => i > 0 && s.half === 2);
  const bw = Math.max(1.2, ((X1 - X0) / n) * 0.66);
  const lead = end.lead === 0 ? 'All square' : `${names[end.lead > 0 ? 0 : 1]} lead by ${Math.abs(end.lead)}`;
  const spoken = `${lead}. ${names[0]} ${end.score[0]}, ${names[1]} ${end.score[1]} after ${n} raids. Biggest lead ${biggest.margin}${biggest.team !== null ? ` to ${names[biggest.team]}` : ''}.`;
  return (
    <Card title="Score by raid" note={<>{end.lead !== 0 && <Dot team={end.lead > 0 ? 0 : 1} />}{lead}</>} label="Score and lead by raid">
      <svg className="k4w-race" viewBox={`0 0 ${CW} ${LEAD_MID + 30}`} role="img" aria-label={spoken}>
        <line className="k4w-grid" x1={X0} x2={X1} y1={YB} y2={YB} />
        <line className="k4w-grid k4w-grid-dash" x1={X0} x2={X1} y1={y(maxScore)} y2={y(maxScore)} />
        <text className="k4w-ax" x={X0} y={y(maxScore) - 3}>{maxScore}</text>
        {firstSecond > 0 && (
          <g>
            <line className="k4w-ht" x1={x(firstSecond - 1)} x2={x(firstSecond - 1)} y1={YT - 2} y2={LEAD_MID + 22} />
            <text className="k4w-ax k4w-ax-mid" x={x(firstSecond - 1)} y={YT - 6}>Half time</text>
          </g>
        )}
        <polyline className="k4w-ln k4w-ln-b" pathLength="1" points={line(1)} />
        <polyline className="k4w-ln k4w-ln-a" pathLength="1" points={line(0)} />
        {[0, 1].map((t) => {
          // keep the two end numbers apart when the scores are close
          const hi = y(end.score[t]) <= y(end.score[1 - t]) && !(y(end.score[t]) === y(end.score[1 - t]) && t === 1);
          const gap = Math.abs(y(end.score[0]) - y(end.score[1]));
          const nudge = gap < 12 ? (hi ? -(12 - gap) / 2 : (12 - gap) / 2) : 0;
          return (
            <g key={t} className="k4w-end" style={{ '--i': t }}>
              <circle className={`k4w-ln-dot k4w-ln-dot-${sideKey(t)}`} cx={x(n)} cy={y(end.score[t])} r="3.6" />
              <text className="k4w-end-n" x={x(n) + 8} y={y(end.score[t]) + 4 + nudge}>{end.score[t]}</text>
            </g>
          );
        })}
        <line className="k4w-grid" x1={X0} x2={X1} y1={LEAD_MID} y2={LEAD_MID} />
        {series.slice(1).map((s, i) => {
          const h = (Math.abs(s.lead) / maxLead) * 18;
          if (!h) return null;
          const up = s.lead > 0;
          return (
            <rect
              key={s.number}
              className={`k4w-lb ${up ? 'k4w-lb-a' : 'k4w-lb-b'}`}
              style={{ '--i': i }}
              x={x(i + 1) - bw / 2}
              y={up ? LEAD_MID - h : LEAD_MID}
              width={bw}
              height={h}
            />
          );
        })}
        <text className="k4w-ax" x={X0} y={LEAD_MID + 29}>Lead by raid</text>
        <text className="k4w-ax k4w-ax-end" x={X1} y={LEAD_MID + 29}>Raid {n}</text>
      </svg>
      <p className="k4w-stat-foot">
        {biggest.margin > 0
          ? <>Biggest lead: <b>{names[biggest.team]} +{biggest.margin}</b> after raid {biggest.raid}</>
          : 'No lead yet'}
      </p>
    </Card>
  );
}
Race.propTypes = { prog: PropTypes.object.isRequired, names: PropTypes.array.isRequired };

/* ---- momentum per 5-minute block ---- */
function Momentum({ prog, names, live, halfMs }) {
  const { blocks } = prog;
  const max = Math.max(2, ...blocks.flatMap((b) => b.points));
  const half = live.half;
  return (
    <Card title="Momentum" note="Points per 5 minutes" label="Momentum per five-minute block">
      <div className="k4w-mo-groups">
        {[1, 2].map((h) => (
          <div key={h} className="k4w-mo-group">
            <h3>{halfName(h)}</h3>
            <div className="k4w-mo" role="list">
              {blocks.filter((b) => b.half === h).map((b) => {
                const future = b.raids === 0 && (b.half > half || b.from * 60000 > halfMs - live.halfLeftMs);
                const up = (b.points[0] / max) * 44;
                const down = (b.points[1] / max) * 44;
                return (
                  <div key={`${b.half}-${b.index}`} role="listitem" className={`k4w-mo-col${future ? ' is-future' : ''}`} aria-label={`${halfName(b.half)} ${b.from} to ${b.to} minutes: ${names[0]} ${b.points[0]}, ${names[1]} ${b.points[1]}`}>
                    <span className="k4w-mo-up">{b.points[0] > 0 && <i className="k4w-mo-bar k4w-mo-bar-a" style={{ height: `${up}px`, '--i': b.index + b.half * 4 }} />}</span>
                    <span className="k4w-mo-axis" />
                    <span className="k4w-mo-down">{b.points[1] > 0 && <i className="k4w-mo-bar k4w-mo-bar-b" style={{ height: `${down}px`, '--i': b.index + b.half * 4 }} />}</span>
                    <b className={b.net === 0 ? undefined : `k4w-mo-n-${b.net > 0 ? 'a' : 'b'}`}>{future ? '' : b.net === 0 ? '0' : `+${Math.abs(b.net)}`}</b>
                    <small>{b.from}–{b.to}</small>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="k4w-mo-key"><span><Dot team={0} />{names[0]}</span><span>Under each block: net points</span><span>{names[1]}<Dot team={1} /></span></p>
    </Card>
  );
}
Momentum.propTypes = { prog: PropTypes.object.isRequired, names: PropTypes.array.isRequired, live: PropTypes.object.isRequired, halfMs: PropTypes.number.isRequired };

/* ---- points by type ---- */
function PointsByType({ match, names }) {
  const p = pointsBreakdown(match);
  const rows = [
    ['Raid', 'touch'], ['Bonus', 'bonus'], ['Tackle', 'tackle'], ['All out', 'allOut'], ['Extras', 'extras'],
  ].filter(([, k]) => k !== 'extras' || p[0].extras + p[1].extras > 0);
  const max = Math.max(1, ...rows.flatMap(([, k]) => [p[0][k], p[1][k]]));
  return (
    <Card title="Where the points came from" label="Points by type">
      <div className="k4w-pt-head" aria-hidden="true"><span><Dot team={0} />{names[0]}</span><span>{names[1]}<Dot team={1} /></span></div>
      <ul className="k4w-pt">
        {rows.map(([label, k], i) => (
          <li key={k} aria-label={`${label}: ${names[0]} ${p[0][k]}, ${names[1]} ${p[1][k]}`}>
            <b className="k4w-pt-n">{p[0][k]}</b>
            <span className="k4w-pt-mid">
              <small>{label}</small>
              <span className="k4w-pt-bars" aria-hidden="true">
                <span className="k4w-pt-l"><i className="k4w-pt-bar k4w-pt-bar-a" style={{ width: `${(p[0][k] / max) * 100}%`, '--i': i }} /></span>
                <span className="k4w-pt-r"><i className="k4w-pt-bar k4w-pt-bar-b" style={{ width: `${(p[1][k] / max) * 100}%`, '--i': i }} /></span>
              </span>
            </span>
            <b className="k4w-pt-n k4w-pt-n-r">{p[1][k]}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}
PointsByType.propTypes = { match: PropTypes.object.isRequired, names: PropTypes.array.isRequired };

/* ---- raid success, all outs, super tackles ---- */
function Rates({ prog, story, names }) {
  const allOuts = [0, 1].map((t) => story.filter((e) => e.allOut === 1 - t).length);
  const supers = [0, 1].map((t) => story.filter((e) => e.superTackle && e.team === 1 - t).length);
  const empties = prog.raids.map((r) => r.empty);
  const tiles = [['All outs', allOuts], ['Super tackles', supers], ['Empty raids', empties]];
  return (
    <Card title="Raiding" note="Raids that scored" label="Raid success rate">
      <ul className="k4w-rate">
        {[0, 1].map((t) => (
          <li key={t} aria-label={`${names[t]}: ${prog.raids[t].scored} of ${prog.raids[t].raids} raids scored, ${prog.raids[t].pct} percent`}>
            <span className="k4w-rate-top"><span><Dot team={t} />{names[t]}</span><b>{prog.raids[t].pct}%</b></span>
            <span className="k4w-rate-track" aria-hidden="true"><i className={`k4w-rate-fill k4w-rate-fill-${sideKey(t)}`} style={{ width: `${prog.raids[t].pct}%`, '--i': t }} /></span>
            <small>{prog.raids[t].scored} of {prog.raids[t].raids} raids</small>
          </li>
        ))}
      </ul>
      <dl className="k4w-tiles">
        {tiles.map(([label, v], i) => (
          <div key={label} style={{ '--i': i }}>
            <dt>{label}</dt>
            <dd><b className="k4w-tile-a">{v[0]}</b><i>–</i><b className="k4w-tile-b">{v[1]}</b></dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
Rates.propTypes = { prog: PropTypes.object.isRequired, story: PropTypes.array.isRequired, names: PropTypes.array.isRequired };

export default function KabaddiProgressR4({ match, story, live, halfMs }) {
  const prog = progression(match, halfMs);
  const names = live.names;
  return (
    <>
      <Race prog={prog} names={names} />
      <Momentum prog={prog} names={names} live={live} halfMs={halfMs} />
      <PointsByType match={match} names={names} />
      <Rates prog={prog} story={story} names={names} />
    </>
  );
}
KabaddiProgressR4.propTypes = {
  match: PropTypes.object.isRequired, story: PropTypes.array.isRequired, live: PropTypes.object.isRequired, halfMs: PropTypes.number.isRequired,
};
