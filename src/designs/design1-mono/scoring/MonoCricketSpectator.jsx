import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  deriveInnings,
  deriveChase,
  oversString,
} from '../../../utils/cricketEngine.js';

// C7 — READ-ONLY cricket SPECTATOR live view (design source:
// docs/plans/2026-07-20-icp-games/cricket/cricket-spectator-clean.html).
//
// This is the WATCH side: it renders whatever engine state it is handed and
// NEVER mutates or hand-counts. EVERYTHING is folded from the engine —
// deriveInnings() for the scorecard fold and deriveChase() for the chase math
// (the sole producer of RRR/CRR/win-prob). The append-only innings.deliveries[]
// is the source of truth for the this-over pips, momentum bars and key-moments
// feed. No Convex / no ShareLiveMatch / no qrcode — a separate live-sync
// follow-up feeds fresh state in; here the "LIVE" pip is a static presentation
// cue.
//
// Brutalist-blend: the record (hero, tables, pips) is hard-edged and mono;
// green (--primary) is the live/lead accent ONLY; wickets ride the danger ink.
// Reuse decision: the legacy BattingCard/BowlingCard bind to buildBattingCard()
// (a different delivery schema — d.seq / d.strikerId / structured d.dismissal),
// which is incompatible with the engine's snapshot deliveries, so the tables are
// rebuilt directly from deriveInnings().batters / .bowlers.

/** Team name from a `{name}` object or a bare string. */
function teamName(t) {
  if (t == null) return '';
  return typeof t === 'string' ? t : t.name || '';
}

/** `overNo`/`ballInOver` are 1-based; the human label is `${completed}.${ball}`. */
function overLabel(d) {
  return `${(d.overNo || 1) - 1}.${d.ballInOver || 0}`;
}

/** Sum of every run component on a delivery (bat + all extras + overthrow). */
function deliveryTotal(d) {
  let r = d.batsmanRuns || 0;
  for (const e of d.extras || []) r += e.runs || 0;
  if (d.overthrow) r += d.overthrow.overthrowRuns || 0;
  return r;
}

/** One THIS-OVER pip: label + kind (dot | run | four | six | wkt | extra). */
function pipOf(d) {
  if (d.wicket) return { label: 'W', kind: 'wkt' };
  const extras = d.extras || [];
  const isWide = extras.some((e) => e.type === 'wide');
  const isNb = extras.some((e) => e.type === 'no-ball');
  if (isWide) return { label: 'wd', kind: 'extra' };
  if (isNb) return { label: 'nb', kind: 'extra' };
  if (d.batsmanRuns === 6) return { label: '6', kind: 'six' };
  if (d.batsmanRuns === 4) return { label: '4', kind: 'four' };
  const total = deliveryTotal(d);
  return { label: total === 0 ? '•' : String(total), kind: total === 0 ? 'dot' : 'run' };
}

/** Live deliveries of the most-recent over (skips dead-ball / retire markers). */
function thisOverPips(innings) {
  const dels = innings.deliveries || [];
  const real = dels.filter((d) => !d.deadBall && !d.retire);
  if (!real.length) return [];
  const lastOver = real[real.length - 1].overNo;
  return real.filter((d) => d.overNo === lastOver).map(pipOf);
}

/** Runs (and a wicket flag) per over — momentum bars. */
function runsPerOver(innings) {
  const buckets = new Map();
  for (const d of innings.deliveries || []) {
    if (d.deadBall || d.retire) continue;
    const on = d.overNo || 1;
    const b = buckets.get(on) || { runs: 0, wkt: false };
    b.runs += deliveryTotal(d);
    if (d.wicket) b.wkt = true;
    buckets.set(on, b);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/**
 * Key moments folded from deliveries — boundaries, wickets, 50/100 milestones.
 * Milestones fire when a batter's running total first crosses 50 or 100.
 */
function keyMoments(innings) {
  const out = [];
  const totals = {};
  for (const d of innings.deliveries || []) {
    if (d.deadBall || d.retire) continue;
    const at = overLabel(d);
    const striker = d.striker;
    const before = totals[striker] || 0;
    const after = before + (d.batsmanRuns || 0);
    totals[striker] = after;

    if (d.wicket) {
      out.push({ over: at, kind: 'wkt', text: `WICKET — ${d.wicket.out}` });
    } else if (d.batsmanRuns === 6) {
      out.push({ over: at, kind: 'six', text: `SIX! ${striker}` });
    } else if (d.batsmanRuns === 4) {
      out.push({ over: at, kind: 'four', text: `FOUR — ${striker}` });
    }
    if (before < 50 && after >= 50) {
      out.push({ over: at, kind: 'milestone', text: `FIFTY · ${striker}` });
    } else if (before < 100 && after >= 100) {
      out.push({ over: at, kind: 'milestone', text: `HUNDRED · ${striker}` });
    }
  }
  return out.reverse().slice(0, 6);
}

/** Legal balls faced in the current (unbroken) partnership — folded from the tail. */
function partnershipBalls(innings) {
  const dels = innings.deliveries || [];
  let balls = 0;
  for (let i = dels.length - 1; i >= 0; i--) {
    const d = dels[i];
    if (d.wicket) break;
    if (d.legal) balls++;
  }
  return balls;
}

const STYLE = `
.mcs{max-width:390px;margin:0 auto;padding:14px 14px calc(16px + env(safe-area-inset-bottom,0px));font-family:var(--se-font-sans,var(--font-sans))}
.mcs .mono{font-family:var(--se-font-mono,var(--font-mono));font-variant-numeric:tabular-nums}
.mcs .eyebrow{font-family:var(--se-font-mono,var(--font-mono));font-size:.625rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--se-color-ink-faint,var(--muted-foreground))}
.mcs .hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.mcs .hdr .ttl{font-size:.9375rem;font-weight:700;text-align:center;flex:1;min-width:0}
.mcs .hdr .live{font-family:var(--se-font-mono,var(--font-mono));font-size:.625rem;font-weight:800;letter-spacing:.08em;color:var(--se-color-danger,var(--destructive));display:inline-flex;align-items:center;gap:4px;justify-content:center;margin-top:2px}
.mcs .hdr .live .d{width:6px;height:6px;border-radius:50%;background:var(--se-color-danger,var(--destructive))}
@media (prefers-reduced-motion:no-preference){.mcs .hdr .live .d{animation:mcs-pulse 1.6s ease-in-out infinite}}
@keyframes mcs-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.mcs .tabs{display:flex;gap:4px;padding:3px;border:1px solid var(--se-color-line,var(--border));border-radius:999px;background:var(--se-color-surface,var(--card));margin-bottom:14px}
.mcs .tab{flex:1;text-align:center;padding:7px 0;border-radius:999px;font-size:.75rem;font-weight:700;color:var(--se-color-ink-muted,var(--muted-foreground));cursor:pointer;background:none;border:0;font-family:inherit}
.mcs .tab.on{background:var(--se-color-ink,var(--foreground));color:var(--se-color-inverse,var(--primary-foreground))}
.mcs .hero{background:var(--se-color-ink,var(--foreground));color:var(--se-color-inverse,var(--primary-foreground));border:1px solid var(--se-color-line,var(--border));border-radius:var(--se-radius-card,calc(var(--radius) + 4px));box-shadow:var(--shadow);padding:13px 15px;margin-bottom:12px}
.mcs .hero-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.mcs .team{min-width:0}
.mcs .team .nm{font-family:var(--se-font-mono,var(--font-mono));font-size:.625rem;font-weight:800;letter-spacing:.1em;color:color-mix(in oklch,var(--se-color-inverse,var(--primary-foreground)) 60%,transparent)}
.mcs .team .sc{font-family:var(--se-font-mono,var(--font-mono));font-size:1.9rem;font-weight:800;line-height:1;margin-top:3px}
.mcs .team .sc .wk{font-size:.55em;font-weight:500;color:color-mix(in oklch,var(--se-color-inverse,var(--primary-foreground)) 55%,transparent)}
.mcs .team.r{text-align:right}
.mcs .team.r .sc{color:var(--primary)}
.mcs .hero-mid{text-align:center;padding:0 6px}
.mcs .hero-mid .k{font-family:var(--se-font-mono,var(--font-mono));font-size:.5625rem;letter-spacing:.1em;color:color-mix(in oklch,var(--se-color-inverse,var(--primary-foreground)) 55%,transparent)}
.mcs .hero-mid .v{font-family:var(--se-font-mono,var(--font-mono));font-size:.8125rem;font-weight:700;margin-top:2px}
.mcs .hero-note{margin-top:11px;padding-top:9px;border-top:1px solid color-mix(in oklch,var(--se-color-inverse,var(--primary-foreground)) 18%,transparent);text-align:center;font-family:var(--se-font-mono,var(--font-mono));font-size:.75rem}
.mcs .hero-note b{color:var(--primary);font-weight:800}
.mcs .wp{margin-top:10px}
.mcs .wp-bar{height:8px;border-radius:999px;background:color-mix(in oklch,var(--se-color-inverse,var(--primary-foreground)) 20%,transparent);overflow:hidden}
.mcs .wp-fill{height:100%;background:var(--primary);border-radius:999px}
.mcs .wp-meta{display:flex;justify-content:space-between;margin-top:5px;font-family:var(--se-font-mono,var(--font-mono));font-size:.5625rem;letter-spacing:.06em;color:color-mix(in oklch,var(--se-color-inverse,var(--primary-foreground)) 60%,transparent)}
.mcs .blk{margin-bottom:14px}
.mcs .blk-hd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}
.mcs .over-strip{display:flex;flex-wrap:wrap;gap:5px}
.mcs .pip{min-width:24px;height:24px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--radius);border:1px solid color-mix(in oklch,var(--se-color-line,var(--border)) 30%,transparent);font-family:var(--se-font-mono,var(--font-mono));font-size:.75rem;font-weight:800;background:var(--se-color-surface,var(--card));color:var(--se-color-ink,var(--foreground))}
.mcs .pip.four,.mcs .pip.six{color:var(--primary);border-color:var(--primary)}
.mcs .pip.wkt{background:var(--se-color-danger,var(--destructive));color:#fff;border-color:var(--se-color-danger,var(--destructive))}
.mcs .pip.extra{color:var(--se-color-ink-muted,var(--muted-foreground))}
.mcs .mom-d{margin-bottom:14px;border:1px solid color-mix(in oklch,var(--se-color-line,var(--border)) 22%,transparent);border-radius:var(--se-radius-card,calc(var(--radius) + 4px));background:var(--se-color-surface,var(--card));box-shadow:var(--shadow-2xs)}
.mcs .mom-d>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:9px 12px}
.mcs .mom-d>summary::-webkit-details-marker{display:none}
.mcs .mom-d>summary .r{margin-left:auto;font-family:var(--se-font-mono,var(--font-mono));font-size:.6875rem;color:var(--se-color-ink-muted,var(--muted-foreground))}
.mcs .mom-d>summary .r b{color:var(--se-color-ink,var(--foreground))}
.mcs .mom{display:flex;align-items:flex-end;gap:4px;height:56px;padding:2px 12px 12px}
.mcs .bar{flex:1;min-width:3px;background:color-mix(in oklch,var(--se-color-line,var(--border)) 16%,transparent);border-radius:2px 2px 0 0}
.mcs .bar.hi{background:var(--primary)}
.mcs .bar.wk{background:color-mix(in oklch,var(--se-color-danger,var(--destructive)) 80%,transparent)}
.mcs .now-card{border:1px solid var(--se-color-line,var(--border));border-radius:var(--se-radius-card,calc(var(--radius) + 4px));background:var(--se-color-surface,var(--card));box-shadow:var(--shadow-2xs);overflow:hidden;margin-bottom:14px}
.mcs .row{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;padding:7px 12px;font-family:var(--se-font-mono,var(--font-mono));font-size:.75rem;align-items:center}
.mcs .row+.row{border-top:1px solid color-mix(in oklch,var(--se-color-line,var(--border)) 16%,transparent)}
.mcs .row .who{font-family:var(--se-font-sans,var(--font-sans));font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mcs .row .who .dot{color:var(--primary);margin-right:4px}
.mcs .row .mut{color:var(--se-color-ink-muted,var(--muted-foreground))}
.mcs .row.head{background:color-mix(in oklch,var(--se-color-line,var(--border)) 5%,transparent);font-size:.5625rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--se-color-ink-faint,var(--muted-foreground))}
.mcs .row.head .who{font-family:var(--se-font-mono,var(--font-mono))}
.mcs .psh{padding:7px 12px;border-top:1px solid color-mix(in oklch,var(--se-color-line,var(--border)) 16%,transparent);font-family:var(--se-font-mono,var(--font-mono));font-size:.6875rem;color:var(--se-color-ink-muted,var(--muted-foreground));display:flex;justify-content:space-between;gap:8px}
.mcs .psh b{color:var(--se-color-ink,var(--foreground))}
.mcs .moment{display:flex;gap:10px;padding:9px 0;border-top:1px solid color-mix(in oklch,var(--se-color-line,var(--border)) 16%,transparent)}
.mcs .moment .ov{font-family:var(--se-font-mono,var(--font-mono));font-size:.6875rem;color:var(--se-color-ink-faint,var(--muted-foreground));flex:none;width:34px;padding-top:1px}
.mcs .moment .tx{font-size:.8125rem;line-height:1.35}
.mcs .moment .tx.six{color:var(--primary);font-weight:700}
.mcs .moment .tx.wkt{color:var(--se-color-danger,var(--destructive));font-weight:700}
.mcs .sc-tbl{width:100%;border-collapse:collapse;margin-bottom:6px}
.mcs .sc-tbl th,.mcs .sc-tbl td{padding:7px 6px;font-size:.75rem}
.mcs .sc-tbl thead th{font-family:var(--se-font-mono,var(--font-mono));font-size:.5625rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--se-color-ink-faint,var(--muted-foreground));text-align:right}
.mcs .sc-tbl thead th.l{text-align:left}
.mcs .sc-tbl tbody td{font-family:var(--se-font-mono,var(--font-mono));text-align:right;font-variant-numeric:tabular-nums;border-top:1px solid color-mix(in oklch,var(--se-color-line,var(--border)) 14%,transparent)}
.mcs .sc-tbl tbody td.who{font-family:var(--se-font-sans,var(--font-sans));text-align:left;font-weight:600}
.mcs .sc-tbl tbody td.who .no{color:var(--primary);font-weight:700;font-size:.625rem;margin-left:6px}
.mcs .sc-tbl tbody td.who .dot{color:var(--primary);margin-right:4px}
.mcs .sec-hd{margin:16px 0 8px}
.mcs .extras,.mcs .fow{font-family:var(--se-font-mono,var(--font-mono));font-size:.75rem;color:var(--se-color-ink-muted,var(--muted-foreground));line-height:1.5}
.mcs .extras b,.mcs .fow b{color:var(--se-color-ink,var(--foreground))}
.mcs .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.mcs .stat{border:1px solid color-mix(in oklch,var(--se-color-line,var(--border)) 22%,transparent);border-radius:var(--radius);padding:10px 12px;background:var(--se-color-surface,var(--card))}
.mcs .stat .k{font-family:var(--se-font-mono,var(--font-mono));font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--se-color-ink-faint,var(--muted-foreground))}
.mcs .stat .v{font-family:var(--se-font-mono,var(--font-mono));font-size:1.25rem;font-weight:800;margin-top:3px}
`;

const TABS = ['Live', 'Scorecard', 'Stats'];

/** score/wkts display, `170/8` (wickets muted). */
function ScoreDisplay({ runs, wkts, className }) {
  return (
    <div className={`sc mono ${className || ''}`}>
      {runs}
      <span className="wk">/{wkts}</span>
    </div>
  );
}
ScoreDisplay.propTypes = {
  runs: PropTypes.number.isRequired,
  wkts: PropTypes.number.isRequired,
  className: PropTypes.string,
};
ScoreDisplay.defaultProps = { className: '' };

/** A rebuilt batting table from deriveInnings().batters (id-keyed). */
function BattingTable({ derived, strikerId, nonStrikerId }) {
  const ids = Object.keys(derived.batters);
  return (
    <table className="sc-tbl" aria-label="Batting card">
      <thead>
        <tr>
          <th className="l">Batter</th>
          <th>R</th>
          <th>B</th>
          <th>4s</th>
          <th>6s</th>
          <th>SR</th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => {
          const b = derived.batters[id];
          const onStrike = id === strikerId || id === nonStrikerId;
          return (
            <tr key={id} data-testid={`bat-row-${id}`}>
              <td className="who">
                {id === strikerId ? <span className="dot" aria-label="on strike">●</span> : null}
                {id}
                {!b.out && onStrike ? <span className="no">not out</span> : null}
              </td>
              <td>{b.R}</td>
              <td>{b.B}</td>
              <td>{b['4s']}</td>
              <td>{b['6s']}</td>
              <td>{b.SR}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
BattingTable.propTypes = {
  derived: PropTypes.object.isRequired,
  strikerId: PropTypes.string,
  nonStrikerId: PropTypes.string,
};
BattingTable.defaultProps = { strikerId: null, nonStrikerId: null };

/** A rebuilt bowling table from deriveInnings().bowlers (id-keyed). */
function BowlingTable({ derived }) {
  const ids = Object.keys(derived.bowlers);
  return (
    <table className="sc-tbl" aria-label="Bowling card">
      <thead>
        <tr>
          <th className="l">Bowler</th>
          <th>O</th>
          <th>M</th>
          <th>R</th>
          <th>W</th>
          <th>Econ</th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => {
          const w = derived.bowlers[id];
          return (
            <tr key={id} data-testid={`bowl-row-${id}`}>
              <td className="who">{id}</td>
              <td>{w.O}</td>
              <td>{w.M}</td>
              <td>{w.R}</td>
              <td>{w.W}</td>
              <td>{w.Econ}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
BowlingTable.propTypes = { derived: PropTypes.object.isRequired };

/** Itemized extras + fall of wickets under a scorecard block. */
function ExtrasAndFow({ derived }) {
  const ex = derived.extrasBreakdown;
  const exTotal = ex.b + ex.lb + ex.wd + ex.nb + ex.pen;
  return (
    <>
      <p className="extras" data-testid="extras">
        <b>Extras</b> {exTotal} (b {ex.b}, lb {ex.lb}, wd {ex.wd}, nb {ex.nb}, pen {ex.pen})
      </p>
      {derived.fow.length ? (
        <p className="fow" data-testid="fow">
          <b>Fall of wickets</b>{' '}
          {derived.fow.map((f, i) => (
            <span key={i}>
              {i ? ', ' : ''}
              {f.wkts}-{f.runs} ({f.batter}, {f.over})
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}
ExtrasAndFow.propTypes = { derived: PropTypes.object.isRequired };

export default function MonoCricketSpectator({
  format,
  innings,
  target,
  battingTeam,
  bowlingTeam,
  priorInnings,
}) {
  const [tab, setTab] = useState('Live');

  const bat = teamName(battingTeam);
  const bowl = teamName(bowlingTeam);
  const derived = deriveInnings(innings, format);
  const isChase = target != null;
  const chase = isChase ? deriveChase({ ...innings, target }, format) : null;
  const prior = priorInnings ? deriveInnings(priorInnings, format) : null;

  const strikerId = innings.striker;
  const nonStrikerId = innings.nonStriker;
  const bowlerId = innings.bowler;
  const strikerRec = strikerId ? derived.batters[strikerId] : null;
  const nonStrikerRec = nonStrikerId ? derived.batters[nonStrikerId] : null;
  const bowlerRec = bowlerId ? derived.bowlers[bowlerId] : null;

  const pips = thisOverPips(innings);
  const moments = keyMoments(innings);
  const overs = runsPerOver(innings);
  const maxOver = Math.max(1, ...overs.map((o) => o.runs));
  const psRuns = derived.partnerships.length
    ? derived.partnerships[derived.partnerships.length - 1].runs
    : 0;
  const psBalls = partnershipBalls(innings);

  const priorScore = prior ? prior.runs : isChase ? target - 1 : 0;
  const priorWkts = prior ? prior.wkts : 0;
  const priorName = priorInnings ? teamName(priorInnings.battingTeam) || bowl : bowl;

  const wp = chase ? Math.round(chase.winProb.value * 100) : 0;

  return (
    <div className="mcs">
      <style>{STYLE}</style>

      <div className="hdr">
        <span aria-hidden="true">‹</span>
        <div className="ttl">
          {bat} v {bowl}
          <div className="live">
            <span className="d" />
            LIVE
          </div>
        </div>
        <span aria-hidden="true">↗</span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`tab${tab === t ? ' on' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Live' ? (
        <>
          {/* dual-team hero */}
          <div className="hero">
            <div className="hero-row">
              {isChase ? (
                <div className="team">
                  <div className="nm">{priorName.toUpperCase()}</div>
                  <ScoreDisplay runs={priorScore} wkts={priorWkts} />
                </div>
              ) : (
                <div className="team">
                  <div className="nm">{bat.toUpperCase()}</div>
                  <ScoreDisplay runs={derived.runs} wkts={derived.wkts} />
                </div>
              )}
              <div className="hero-mid">
                <div className="k">{isChase ? 'CHASING' : 'BATTING'}</div>
                <div className="v">{derived.overs} ov</div>
              </div>
              {isChase ? (
                <div className="team r">
                  <div className="nm">{bat.toUpperCase()}</div>
                  <ScoreDisplay runs={derived.runs} wkts={derived.wkts} className="mono" />
                </div>
              ) : (
                <div className="team r">
                  <div className="nm">CRR</div>
                  <div className="sc mono" style={{ color: 'var(--primary)' }}>
                    {chase ? chase.CRR : derived.legalBalls
                      ? +((derived.runs * (format.ballsPerOver || 6)) / derived.legalBalls).toFixed(2)
                      : 0}
                  </div>
                </div>
              )}
            </div>

            {isChase ? (
              <>
                <div className="hero-note" data-testid="chase-need">
                  {bat} need <b>{chase.runsNeeded}</b> off <b>{chase.ballsLeft}</b> · RRR{' '}
                  <b>{chase.RRR}</b> vs CRR <b>{chase.CRR}</b>
                </div>
                <div className="wp" data-testid="winprob">
                  <div
                    className="wp-bar"
                    role="progressbar"
                    aria-valuenow={wp}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Win probability"
                    title={chase.winProb.basis}
                  >
                    <div className="wp-fill" style={{ width: `${wp}%` }} />
                  </div>
                  <div className="wp-meta">
                    <span>WIN PROB {wp}%</span>
                    <span data-testid="winprob-basis">{chase.winProb.basis}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="hero-note">
                Proj <b>{chase ? chase.projection : derived.runs}</b> · {bat} batting
              </div>
            )}
          </div>

          {/* this over */}
          <div className="blk">
            <div className="blk-hd">
              <span className="eyebrow">This over</span>
            </div>
            <div className="over-strip" data-testid="this-over" role="list" aria-label="This over">
              {pips.length === 0 ? (
                <span className="mut" style={{ fontSize: '.8125rem' }}>—</span>
              ) : (
                pips.map((p, i) => (
                  <span className={`pip ${p.kind}`} role="listitem" key={i}>
                    {p.label}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* momentum — collapsed */}
          <details className="mom-d">
            <summary>
              <span aria-hidden="true">📊</span>
              <span className="eyebrow">Momentum · runs / over</span>
              <span className="r">
                {isChase ? (
                  <>
                    RRR <b>{chase.RRR}</b> vs CRR <b>{chase.CRR}</b>
                  </>
                ) : (
                  <>
                    <b>{derived.overs}</b> ov
                  </>
                )}
              </span>
            </summary>
            <div className="mom">
              {overs.map((o, i) => (
                <div
                  key={i}
                  className={`bar${o.wkt ? ' wk' : o.runs >= maxOver * 0.8 ? ' hi' : ''}`}
                  style={{ height: `${Math.max(8, (o.runs / maxOver) * 100)}%` }}
                  title={`Over ${i + 1}: ${o.runs}`}
                />
              ))}
            </div>
          </details>

          {/* now: batters + bowler */}
          <div className="now-card">
            <div className="row head">
              <span className="who">Batting</span>
              <span>R</span>
              <span>B</span>
              <span>SR</span>
            </div>
            {strikerRec ? (
              <div className="row" data-testid="now-striker">
                <span className="who">
                  <span className="dot" aria-label="on strike">●</span>
                  {strikerId}
                </span>
                <span>{strikerRec.R}</span>
                <span className="mut">{strikerRec.B}</span>
                <span>{strikerRec.SR}</span>
              </div>
            ) : null}
            {nonStrikerRec ? (
              <div className="row" data-testid="now-nonstriker">
                <span className="who">{nonStrikerId}</span>
                <span>{nonStrikerRec.R}</span>
                <span className="mut">{nonStrikerRec.B}</span>
                <span>{nonStrikerRec.SR}</span>
              </div>
            ) : null}
            {nonStrikerId != null ? (
              <div className="psh" data-testid="partnership">
                <span>
                  Partnership <b>{psRuns} ({psBalls})</b>
                </span>
                {derived.fow.length ? (
                  <span>
                    Last wkt · {derived.fow[derived.fow.length - 1].batter}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="row head">
              <span className="who">Bowling</span>
              <span>O</span>
              <span>R</span>
              <span>W</span>
            </div>
            {bowlerRec ? (
              <div className="row" data-testid="now-bowler">
                <span className="who">{bowlerId}</span>
                <span>{bowlerRec.O}</span>
                <span className="mut">{bowlerRec.R}</span>
                <span>{bowlerRec.W}</span>
              </div>
            ) : null}
          </div>

          {/* key moments */}
          <div className="blk">
            <div className="blk-hd">
              <span className="eyebrow">Key moments</span>
            </div>
            {moments.length === 0 ? (
              <p className="extras">No key moments yet.</p>
            ) : (
              moments.map((m, i) => (
                <div className="moment" key={i}>
                  <span className="ov">{m.over}</span>
                  <span
                    className={`tx${m.kind === 'six' ? ' six' : ''}${m.kind === 'wkt' ? ' wkt' : ''}`}
                  >
                    {m.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}

      {tab === 'Scorecard' ? (
        <div data-testid="scorecard">
          <p className="eyebrow sec-hd">
            {bat} · {derived.runs}/{derived.wkts} ({derived.overs})
          </p>
          <BattingTable derived={derived} strikerId={strikerId} nonStrikerId={nonStrikerId} />
          <BowlingTable derived={derived} />
          <ExtrasAndFow derived={derived} />

          {prior ? (
            <div data-testid="prior-innings">
              <p className="eyebrow sec-hd">
                {priorName} · {prior.runs}/{prior.wkts} ({prior.overs}) — completed
              </p>
              <BattingTable derived={prior} />
              <BowlingTable derived={prior} />
              <ExtrasAndFow derived={prior} />
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'Stats' ? (
        <div data-testid="stats">
          <div className="stat-grid">
            <div className="stat">
              <div className="k">Run rate</div>
              <div className="v">
                {chase
                  ? chase.CRR
                  : derived.legalBalls
                    ? +((derived.runs * (format.ballsPerOver || 6)) / derived.legalBalls).toFixed(2)
                    : 0}
              </div>
            </div>
            <div className="stat">
              <div className="k">Boundaries</div>
              <div className="v">
                {Object.values(derived.batters).reduce((s, b) => s + b['4s'] + b['6s'], 0)}
              </div>
            </div>
            {chase ? (
              <div className="stat">
                <div className="k">Projected</div>
                <div className="v">{chase.projection}</div>
              </div>
            ) : null}
            <div className="stat">
              <div className="k">Extras</div>
              <div className="v">
                {(() => {
                  const e = derived.extrasBreakdown;
                  return e.b + e.lb + e.wd + e.nb + e.pen;
                })()}
              </div>
            </div>
          </div>

          <div className="blk">
            <div className="blk-hd">
              <span className="eyebrow">Partnerships</span>
            </div>
            {derived.partnerships.map((p, i) => (
              <div className="moment" key={i}>
                <span className="ov">{p.wkt}</span>
                <span className="tx">
                  {p.runs} runs{p.unbeaten ? ' (unbeaten)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

MonoCricketSpectator.propTypes = {
  format: PropTypes.object.isRequired,
  innings: PropTypes.object.isRequired,
  target: PropTypes.number,
  battingTeam: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  bowlingTeam: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  priorInnings: PropTypes.object,
};

MonoCricketSpectator.defaultProps = {
  target: null,
  battingTeam: 'Batting',
  bowlingTeam: 'Bowling',
  priorInnings: null,
};
