import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { applyRaid, cancelRaid, finish, isDoOrDie, isSuperTackleOn, preview, remainingTime, result, teamTotal } from '../../../utils/kabaddiEngine';
import {
  boardPhase, callTimeUp, canUndoAction, clockNow, matchTotals, raidLog, raidMoment, raidRow, resumeIfPaused,
  startNextRaid, startSecondHalf, togglePause, undoAction, undoHint,
} from '../../../utils/kabaddiQuickMatch';
import { HandUnderline } from '../kit/KitParts';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import './kabaddiSplit.css';

// Exploration s3, "Attack vs defence". The board is split the way the scorer thinks about a raid:
// who earned the point. Each team keeps its own side (the side it stands on court), and the side
// takes the role it plays in this raid: the raiding side holds the attack outcomes (touches,
// bonus), the defending side holds the defence outcome (tackled), and the outcomes nobody earns a
// touch from (empty, raider out) sit neutrally underneath. The scorer taps toward the team that
// scored. Presentation and taps only: every number is read from the raid engine.

const SELF_OUT_REASONS = ['Stepped out', 'Lost cant', 'Time ran out'];
const key = (team) => (team === 0 ? 'a' : 'b');
const bonusFields = (on) => (on ? { bonusAwarded: true, bonusBeforeContact: true } : {});
let idSeq = 0;
const newId = (prefix) => {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}-${Math.random().toString(36).slice(2, 7)}`;
};
const clock = (ms) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const tryPreview = (state, event) => {
  try {
    return preview(state, event);
  } catch {
    return null;
  }
};
/** The match story from the raid journal: first-half points and super tackles per team. */
function story(log, carried) {
  const lastFirst = log.find((entry) => entry.half === 1);
  const half1 = lastFirst ? lastFirst.after.teams.map((t, i) => teamTotal(t) + carried[i]) : [...carried];
  const supers = [0, 1].map((team) => log.filter((entry) => entry.effects.awards.some((a) => a.team === team && a.category === 'superTackleExtra')).length);
  return { half1, supers };
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The result read back in words: a headline (who scored and why) and what it does to the mat. */
function readBack(p, { raider, defender, names, startMat, count, bonus, end, reason, superOn, carried }) {
  const R = names[raider];
  const D = names[defender];
  let head;
  if (p.outcome === 'touch') head = `${R} +${p.points[raider]} · ${plural(count, 'touch', 'touches')}${bonus ? ' + bonus' : ''}`;
  else if (p.outcome === 'bonus') head = `${R} +1 · bonus, back safe`;
  else if (p.outcome === 'empty') head = 'Empty raid · no points';
  else if (p.outcome === 'doOrDieFailure') head = `Do or die lost · ${superOn ? 'super tackle · ' : ''}${D} +${p.points[defender]}`;
  else if (end === 'selfOut') head = `Raider out, ${reason.toLowerCase()} · ${superOn ? 'super tackle · ' : ''}${D} +${p.points[defender]}`;
  else head = `${superOn ? 'Super tackle' : 'Tackled'} · ${D} +${p.points[defender]}${bonus ? ` · ${R} +1 bonus` : ''}`;
  const bits = [];
  for (const team of [defender, raider]) {
    if (p.allOut.includes(team)) bits.push(`All out! ${names[1 - team]} +2 · ${names[team]} back to 7`);
    else if (p.mat[team] !== startMat[team]) bits.push(`${names[team]} ${startMat[team]}→${p.mat[team]}`);
  }
  bits.push(p.totals.map((t, i) => t + carried[i]).join('–'));
  bits.push(`${names[p.nextRaidTeam]} next`);
  return { head, detail: bits.join(' · ') };
}

/**
 * Mat strength as pips: the players on the mat (filled), then the sitting block (hollow, in the
 * order they come back; the next one in is marked). The preview before Confirm strikes the
 * players going out and fills the ones coming back.
 */
function MatPips({ team, onMat, sitting, going = 0, coming = 0, size = 'big' }) {
  // players coming back join the mat row (marked +); the rest of the block waits in order
  const on = [...Array.from({ length: onMat }, (_, i) => (i >= onMat - going ? 'going' : 'on')), ...Array(coming).fill('coming')];
  const out = Array.from({ length: sitting - coming }, (_, i) => (i === 0 ? 'next' : 'out'));
  return (
    <div className={`ks-pips ks-pips-${size}`} role="img" aria-label={`${onMat} on mat, ${sitting} sitting`}>
      <span className="ks-pips-on">{on.map((p, i) => <i key={`${team}-on-${i}`} className="ks-pip" data-pip={p} />)}</span>
      {sitting - coming > 0 && (
        <span className="ks-pips-out">
          <small>Sitting</small>
          {out.map((p, i) => <i key={`${team}-out-${i}`} className="ks-pip" data-pip={p} />)}
        </span>
      )}
    </div>
  );
}

MatPips.propTypes = {
  team: PropTypes.number.isRequired, onMat: PropTypes.number.isRequired, sitting: PropTypes.number.isRequired,
  going: PropTypes.number, coming: PropTypes.number, size: PropTypes.string,
};

export default function KabaddiSplitBoard({
  sportConfig, title, subtitle, colourStyle, match, names, swapped = false, isLive, live, notice,
  onCommit, onOpeningTeam, onFinish, onDiscard, onSwap,
}) {
  const { state, carried } = match;
  const sheetId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The raid being recorded: how it ended, touches, bonus, the self-out reason.
  const [end, setEnd] = useState(null);
  const [count, setCount] = useState(0);
  const [bonus, setBonus] = useState(false);
  const [reason, setReason] = useState(SELF_OUT_REASONS[0]);
  const [moment, setMoment] = useState(null);
  const [undoNote, setUndoNote] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const raid = state.activeRaid;
  const raidId = raid?.id ?? null;
  const ticking = state.clock.running || Boolean(raid?.raidClock.running);
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);
  useEffect(() => {
    setEnd(null);
    setCount(0);
    setBonus(false);
    setReason(SELF_OUT_REASONS[0]);
  }, [raidId]);

  const at = clockNow(state, Math.max(now, Date.now()));
  const phase = boardPhase(state);
  const paused = state.phase === 'paused';
  const halfLeft = remainingTime(state, at, 'half');
  const raidLeft = raid ? remainingTime(state, at, 'raid') : null;
  const totals = matchTotals(match);
  const mat = state.mat.map((slots) => slots.length);
  const sitting = state.outQueue.map((q) => q.length);
  const raider = raid ? raid.raidingTeam : state.nextRaidTeam;
  const defender = 1 - raider;
  const left = (state.courtSide[0] === 0) !== swapped ? 0 : 1;
  const order = [left, 1 - left];
  const log = raidLog(state);
  const inPlay = ['ready', 'playing', 'halfPending', 'fullPending'].includes(phase);
  const timeIsUp = !raid && halfLeft === 0 && phase === 'playing';
  const superOn = inPlay && isSuperTackleOn(state);
  const doOrDie = inPlay && isDoOrDie(state);

  const commit = (next, meta) => {
    setUndoNote('');
    onCommit(next, meta);
  };
  const startRaidNow = () => {
    setMoment(null);
    commit(startNextRaid(state, { id: newId('raid'), atMs: clockNow(state) }), { kind: 'raid-start' });
  };

  // ---- the raid being recorded: one engine event, read back on Confirm ----
  const eventFor = () => {
    const base = { id: `confirm-${raid.id}`, raidId: raid.id, expectedRevision: state.revision };
    if (end === 'tackled') return { ...base, type: 'tackled', ...bonusFields(bonus) };
    if (end === 'selfOut') return { ...base, type: 'selfOut', reason, ...bonusFields(bonus) };
    if (end === 'empty') return { ...base, type: 'empty' };
    if (count > 0) return { ...base, type: 'touch', count, ...bonusFields(bonus) };
    if (bonus) return { ...base, type: 'bonus', bonusBeforeContact: true };
    return null;
  };
  const event = raid && end ? eventFor() : null;
  const outcome = event ? tryPreview(state, event) : null;
  const words = outcome && readBack(outcome, {
    raider, defender, names, startMat: raid.startMat, count, bonus, end, reason, superOn: raid.superEligibleAtStart, carried,
  });

  const pickTouch = (n) => {
    if (count === n && end === 'touch') {
      setCount(0);
      setEnd(bonus ? 'touch' : null);
      return;
    }
    setCount(n);
    setEnd('touch');
  };
  const toggleBonus = () => {
    const on = !bonus;
    setBonus(on);
    if (end === 'empty' || end === null) setEnd(on || count ? 'touch' : null);
    else if (end === 'touch' && !on && !count) setEnd(null);
  };
  const pickEnd = (which) => {
    setEnd(end === which ? null : which);
    setCount(0);
    if (which === 'empty') setBonus(false);
  };
  const confirmRaid = () => {
    const next = applyRaid(state, event);
    const entry = next.events.at(-1);
    const found = raidMoment(entry);
    setMoment(found && { ...found, raidingTeam: entry.raidingTeam, effects: entry.effects });
    commit(next, { kind: 'raid', entry });
  };
  const doUndo = () => {
    const next = undoAction(state);
    setMoment(null);
    onCommit(next, { kind: 'undo' });
    const back = matchTotals({ ...match, state: next });
    setUndoNote(boardPhase(next) === 'playing'
      ? `Raid undone · ${back.join('–')} · mat ${next.mat.map((m) => m.length).join('–')} · ${names[next.nextRaidTeam]} raid next`
      : '');
  };
  const closeSheetAnd = (action) => { setSheetOpen(false); action(); };

  // ---- one side of the board ----
  const sideFor = (team) => {
    const attack = inPlay && phase !== 'ready' && team === raider;
    const defence = inPlay && phase !== 'ready' && team === defender;
    const going = outcome ? outcome.lost[team] : 0;
    const coming = outcome && !outcome.allOut.includes(team) ? outcome.revived[team] : 0;
    const role = attack ? (raid ? 'Raiding' : 'Raids next') : defence ? (raid ? 'Defending' : 'Defends') : null;

    let body = null;
    if (phase === 'halfTime' || phase === 'finishReview' || phase === 'finished') {
      const r = result(state).breakdown[team];
      const st = story(log, carried);
      const rows = [['Raid', r.raid], ['Tackle', r.tackle], ['All out', r.allOut], ['Extras', r.technical + r.defenderOut + carried[team]]];
      const tale = [['First half', st.half1[team]], ...(phase === 'halfTime' ? [] : [['Second half', totals[team] - st.half1[team]]]), ['Super tackles', st.supers[team]]];
      body = (
        <>
          <dl className="ks-break">{rows.map(([label, v]) => <div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}</dl>
          <dl className="ks-break ks-break-tale">{tale.map(([label, v]) => <div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}</dl>
        </>
      );
    } else if (raid && attack) {
      const most = raid.startMat[defender];
      body = (
        <>
          <p className="ks-ask">Touched &amp; back</p>
          <div className="ks-touches" role="group" aria-label="Defenders touched, raider back safe">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n} type="button" className="ks-num" disabled={n > most}
                aria-pressed={end === 'touch' && count === n} aria-label={`${n} touched`}
                onClick={() => pickTouch(n)}
              >{n}</button>
            ))}
          </div>
          <button
            type="button" className="ks-bonus" aria-pressed={bonus} disabled={!raid.bonusEligibleAtStart || end === 'empty'}
            onClick={toggleBonus}
          >
            <span>Bonus</span><small>{raid.bonusEligibleAtStart ? '+1 · line crossed' : `needs 6 on mat · ${most} now`}</small>
          </button>
        </>
      );
    } else if (raid && defence) {
      const tackled = tryPreview(state, { id: `t-${raid.id}`, raidId: raid.id, type: 'tackled' });
      body = (
        <button type="button" className="ks-tackle" aria-pressed={end === 'tackled'} onClick={() => pickEnd('tackled')}>
          <b>Tackled</b>
          <small>{raid.superEligibleAtStart ? 'Super tackle · ' : 'Raider out · '}{names[team]} +{tackled?.points[team] ?? 1}</small>
        </button>
      );
    } else if (phase === 'playing' && !timeIsUp && (attack || defence)) {
      // Between raids: what is at stake on this side in the next raid, read from engine previews.
      // (an undo leaves the clock paused; the preview reads the same rules as if play resumed)
      const peek = (type) => tryPreview(resumeIfPaused(state, at), { id: `peek-${type}-${state.revision}`, type });
      const lines = [];
      if (attack) {
        const empty = peek('empty');
        if (empty?.outcome === 'doOrDieFailure') lines.push(`Must score · an empty raid puts the raider out, ${names[defender]} +${empty.points[defender]}`);
        lines.push(`Up to ${plural(mat[defender], 'touch', 'touches')}`);
        lines.push(mat[defender] >= 6 ? 'Bonus line is live' : `No bonus · ${names[defender]} have ${mat[defender]} on mat`);
      } else {
        const tackled = peek('tackled');
        if (tackled) lines.push(`${superOn ? 'Super tackle' : 'Tackle'} · ${names[team]} +${tackled.points[team]}`);
        lines.push(`All out if all ${mat[team]} are touched`);
      }
      body = <ul className="ks-stakes" aria-label="Next raid">{lines.map((line) => <li key={line}>{line}</li>)}</ul>;
    }

    const tags = [];
    if (inPlay && attack && doOrDie) tags.push(<em key="dod" className="ks-tag ks-tag-danger">Do or die</em>);
    else if (inPlay && state.emptyStreak[team] > 0) tags.push(<em key="e" className="ks-tag">{plural(state.emptyStreak[team], 'empty raid')}</em>);
    if (inPlay && defence && superOn) tags.push(<em key="st" className="ks-tag ks-tag-gold">Super tackle on</em>);

    let overlay = null;
    if (moment) {
      const scorer = moment.kind === 'allOut' ? 1 - moment.team : moment.team;
      if (scorer === team) {
        const pts = moment.effects.awards.filter((a) => a.team === scorer).reduce((n, a) => n + a.points, 0);
        const heading = moment.kind === 'allOut' ? 'All out!' : 'Super tackle!';
        overlay = (
          <section className="ks-moment" data-kind={moment.kind} role="status" aria-label={heading}>
            <h2><HandUnderline>{heading}</HandUnderline></h2>
            <p className="ks-moment-pts">+{pts}</p>
            <p>{moment.kind === 'allOut'
              ? `${names[moment.team]} all out · back to 7`
              : `${names[1 - team]} raider out · ${plural(moment.effects.revived[team].length, 'player')} back in`}</p>
          </section>
        );
      }
    }

    const final = phase === 'finishReview' || phase === 'finished';
    const won = final && totals[team] > totals[1 - team];
    return (
      <section
        key={team} className={`ks-side ks-side-${key(team)}`} data-role={attack ? 'attack' : defence ? 'defence' : undefined}
        data-super={defence && superOn ? '' : undefined} data-won={won ? '' : undefined} data-picked={phase === 'ready' && state.nextRaidTeam === team ? '' : undefined}
        aria-label={`${names[team]}${role ? ` · ${role.toLowerCase()}` : ''}`}
      >
        <header className="ks-side-head">
          <span className="ks-role">
            {attack && <i className="ks-mark" aria-hidden="true" />}
            {role ?? (final ? (won ? 'Winner' : totals[0] === totals[1] ? 'Draw' : names[team]) : names[team])}
          </span>
          {raid && attack && (
            <span className={`ks-raidclock${raidLeft === 0 ? ' ks-raidclock-zero' : ''}${raid.doOrDieAtStart ? ' ks-raidclock-dod' : ''}`} aria-label="Raid clock">
              {Math.ceil(raidLeft / 1000)}<small>s</small>
            </span>
          )}
          {(final || phase === 'halfTime') && <span className="ks-total">{totals[team]}</span>}
        </header>
        {!final && phase !== 'halfTime' && (
          <div className="ks-mat">
            <span className="ks-matnum"><b>{outcome ? outcome.mat[team] : mat[team]}</b><small>on mat{outcome && outcome.mat[team] !== mat[team] ? ` (was ${mat[team]})` : ''}</small></span>
            <MatPips team={team} onMat={mat[team]} sitting={sitting[team]} going={outcome?.allOut.includes(team) ? mat[team] : going} coming={coming} size={raid && attack ? 'small' : 'big'} />
          </div>
        )}
        {tags.length > 0 && <div className="ks-tags">{tags}</div>}
        {body && <div className="ks-body">{body}</div>}
        {phase === 'ready' && (
          <button type="button" className="ks-pick" aria-pressed={state.nextRaidTeam === team} onClick={() => onOpeningTeam(team)}>
            {state.nextRaidTeam === team ? 'Raids first' : 'Tap · raids first'}
          </button>
        )}
        {overlay}
      </section>
    );
  };

  // ---- the strip under the two sides: neutral outcomes during a raid, else recent raids ----
  let strip = null;
  if (raid) {
    const empty = tryPreview(state, { id: `e-${raid.id}`, raidId: raid.id, type: 'empty' });
    const selfOut = tryPreview(state, { id: `s-${raid.id}`, raidId: raid.id, type: 'selfOut', reason: 'x' });
    strip = end === 'selfOut' ? (
      <div className="ks-neutral ks-reasons" role="group" aria-label="Why the raider is out">
        <button type="button" className="ks-out" aria-label="Back to outcomes" onClick={() => pickEnd('selfOut')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        {SELF_OUT_REASONS.map((r) => <button key={r} type="button" className="ks-out" aria-pressed={reason === r} onClick={() => setReason(r)}><b>{r}</b></button>)}
      </div>
    ) : (
      <div className="ks-neutral" role="group" aria-label="No touch scored">
        <button type="button" className="ks-out" aria-pressed={end === 'empty'} onClick={() => pickEnd('empty')}>
          <b>Empty</b>
          <small>{empty?.outcome === 'doOrDieFailure' ? `Do or die · ${names[defender]} +${empty.points[defender]}` : 'Back safe · no points'}</small>
        </button>
        <button type="button" className="ks-out" onClick={() => pickEnd('selfOut')}>
          <b>Raider out</b>
          <small>Line · cant · time · {names[defender]} +{selfOut?.points[defender] ?? 1}</small>
        </button>
      </div>
    );
  } else if (inPlay && phase !== 'ready') {
    strip = undoNote ? <p className="ks-note" role="status">{undoNote}</p> : (
      <button type="button" className="ks-recent" onClick={() => setSheetOpen(true)} aria-label="Recent raids · open the raid log">
        {log.length === 0 ? <span className="ks-quiet">No raids yet</span> : (
          <ol>
            {log.slice(0, 3).map((entry) => {
              const row = raidRow(entry, names, carried);
              return (
                <li key={row.id}>
                  <i className={`ks-dot ks-dot-${key(entry.raidingTeam)}`} aria-hidden="true" />
                  <span>{row.number} · {row.text}</span>
                  <strong>{row.score.join('–')}</strong>
                </li>
              );
            })}
          </ol>
        )}
      </button>
    );
  } else if (phase === 'halfTime') {
    strip = <p className="ks-verdict">Half time · {names[1 - state.openingRaidTeam]} raid first in the second half</p>;
  } else if (phase === 'finishReview' || phase === 'finished') {
    const r = result(state);
    strip = <h2 className="ks-verdict"><HandUnderline>{r.draw ? `Draw · ${totals.join('–')}` : `${names[totals[0] > totals[1] ? 0 : 1]} win by ${Math.abs(totals[0] - totals[1])}`}</HandUnderline></h2>;
  }

  // ---- the one forward action ----
  let action = null;
  if (phase === 'ready') {
    action = <button type="button" className={`ks-raid ks-raid-${key(state.nextRaidTeam)}`} onClick={startRaidNow}><i className="ks-mark" aria-hidden="true" />Start · {names[state.nextRaidTeam]} raid first</button>;
  } else if (phase === 'halfTime') {
    action = <button type="button" className="se-go" onClick={() => commit(startSecondHalf(state, clockNow(state)), { kind: 'half' })}>Start second half</button>;
  } else if (phase === 'finishReview' || phase === 'finished') {
    action = <button type="button" className="se-go" onClick={() => commit(finish(state), { kind: 'finish' })}>Finish match</button>;
  } else if (raid) {
    action = (
      <button type="button" className="se-go ks-confirm" onClick={confirmRaid} disabled={!outcome} aria-live="polite">
        {words ? (
          <>
            <span className="ks-confirm-head">Confirm · {words.head}</span>
            <span className="ks-confirm-detail">{words.detail}</span>
          </>
        ) : <span className="ks-confirm-head">Tap what happened</span>}
      </button>
    );
  } else if (timeIsUp) {
    action = <button type="button" className="se-go" onClick={() => commit(callTimeUp(state, clockNow(state)), { kind: 'time-up' })}>{state.half === 1 ? 'Call half time' : 'Call full time'}</button>;
  } else {
    action = (
      <button type="button" className={`ks-raid ks-raid-${key(raider)}`} onClick={startRaidNow}>
        <i className="ks-mark" aria-hidden="true" />Raid by {names[raider]}{doOrDie ? <em className="ks-raid-dod">do or die</em> : null}
      </button>
    );
  }

  const canUndo = canUndoAction(state);
  const clockLabel = phase === 'ready' ? 'Ready' : phase === 'halfTime' ? 'Half time' : phase === 'finishReview' || phase === 'finished' ? 'Full time' : `Half ${state.half}`;
  const gains = outcome ? outcome.points : [0, 0];

  return (
    <div
      className="sb ks" data-team-board="" data-kabaddi-board="" data-phase={phase} data-raiding={raid ? '' : undefined}
      style={{ ...colourStyle, ...sportIdentityVars(sportConfig.id) }}
    >
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" isLive={isLive} onFinish={onFinish} finishDisabled={Boolean(raid) || phase === 'finishReview'} />
      {notice}
      <div className="ks-score">
        {order.map((team, i) => (
          <div key={team} className={`ks-team ks-team-${key(team)}${i ? ' ks-team-right' : ''}`} aria-label={`${names[team]} ${totals[team]}`}>
            <span className="ks-team-name">{names[team]}</span>
            <span className="ks-team-score">{totals[team]}</span>
            {gains[team] > 0 && <span className="ks-gain" aria-hidden="true">+{gains[team]}</span>}
          </div>
        ))}
        <div className="ks-clock" aria-label="Half clock">
          <span className="ks-clock-label"><i className="ks-sportmark" aria-hidden="true" />{clockLabel}</span>
          <b>{clock(halfLeft)}</b>
          {paused && phase === 'playing' && <small>paused</small>}
        </div>
      </div>
      <div className="ks-split">
        {order.map(sideFor)}
      </div>
      <div className="ks-go">
        {strip && <div className="ks-strip">{strip}</div>}
        {action}
      </div>
      <BoardBar
        canUndo={canUndo} undoHint={undoHint(match)} onUndo={doUndo}
        disabledHint={raid ? 'Cancel the raid first' : undefined}
        sheetId={sheetId} sheetOpen={sheetOpen} onMore={() => setSheetOpen(true)}
      />
      <BoardOptionsSheet id={sheetId} open={sheetOpen} onClose={() => setSheetOpen(false)} live={live} onDiscard={onDiscard}>
        {raid && (
          <BoardSheetGroup>
            <button type="button" className="sb-row" onClick={() => closeSheetAnd(() => commit(cancelRaid(state), { kind: 'raid-cancel' }))}>Cancel raid · no whistle, nothing recorded</button>
          </BoardSheetGroup>
        )}
        <BoardSheetGroup>
          <p className="sb-sheet-note ks-log-title">Raid log · newest first</p>
          {log.length === 0 ? <p className="sb-sheet-note">No raids yet.</p> : (
            <ol className="ks-log" aria-label="Raid log">
              {log.map((entry) => {
                const row = raidRow(entry, names, carried);
                return (
                  <li key={row.id}>
                    <span><b>Raid {row.number}{row.half === 2 ? ' · 2nd half' : ''}</b> {row.text}<small>{row.mat}</small></span>
                    <strong>{row.score.join('–')}</strong>
                  </li>
                );
              })}
            </ol>
          )}
        </BoardSheetGroup>
        <BoardSheetGroup>
          {phase === 'playing' && !raid && (
            <button type="button" className="sb-row" onClick={() => closeSheetAnd(() => commit(togglePause(state, clockNow(state)), { kind: 'clock' }))}>
              {paused ? 'Resume clock' : 'Pause clock'} · {clock(halfLeft)}
            </button>
          )}
          {state.phase === 'playing' && !raid && halfLeft > 0 && (
            <button type="button" className="sb-row" onClick={() => closeSheetAnd(() => commit(callTimeUp(state, clockNow(state)), { kind: 'time-up' }))}>
              {state.half === 1 ? 'End first half now' : 'End match time now'}
            </button>
          )}
          <button type="button" className="sb-row" onClick={() => closeSheetAnd(onSwap)}>Swap sides</button>
        </BoardSheetGroup>
      </BoardOptionsSheet>
    </div>
  );
}

KabaddiSplitBoard.propTypes = {
  sportConfig: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  colourStyle: PropTypes.object.isRequired,
  match: PropTypes.shape({ state: PropTypes.object.isRequired, carried: PropTypes.arrayOf(PropTypes.number).isRequired }).isRequired,
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  swapped: PropTypes.bool,
  isLive: PropTypes.bool,
  live: PropTypes.node,
  notice: PropTypes.node,
  onCommit: PropTypes.func.isRequired,
  onOpeningTeam: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSwap: PropTypes.func.isRequired,
};
