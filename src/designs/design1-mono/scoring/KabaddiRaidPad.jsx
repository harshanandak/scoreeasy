import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { cancelRaid, finish, isDoOrDie, isSuperTackleOn, remainingTime, result, teamTotal } from '../../../utils/kabaddiEngine';
import {
  applyQuickRaid, boardPhase, callTimeUp, canUndoAction, clockNow, matchTotals, previewQuickRaid, raidLog, raidMoment,
  raidRow, raidSummary, startNextRaid, startSecondHalf, togglePause, undoAction, undoHint,
} from '../../../utils/kabaddiQuickMatch';
import { HandUnderline } from '../kit/KitParts';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import './kabaddiPad.css';

// Kabaddi "raid pad" (exploration s1): the scorer's screen is a fixed keypad, like an official
// scoring tablet. The keys never move between raids, so after a few raids the scorer taps without
// looking: touch counts on the top row, raider outcomes in the middle, defence outcomes at the
// bottom, then one bar that starts the raid and later confirms it with the result read back in
// words. Every gate (bonus at six, touches up to the defenders on the mat, do-or-die, super
// tackle) and every number comes from the raid engine through kabaddiQuickMatch.js.

const SELF_OUT_REASONS = ['Stepped out', 'Lost cant', 'Time ran out'];
const MOMENT_MS = 4500;
const key = (team) => (team === 0 ? 'a' : 'b');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : (word.endsWith('ch') ? 'es' : 's')}`;
let idSeq = 0;
const newId = (prefix) => {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}-${Math.random().toString(36).slice(2, 7)}`;
};
const clock = (ms) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The staged entry -> one engine ruling (without ids), or null while nothing decides the raid. */
function rulingOf({ touches, bonus, ending, reason }) {
  const b = bonus ? { bonusAwarded: true, bonusBeforeContact: true } : {};
  if (ending === 'empty') return { type: 'empty' };
  if (ending === 'tackled') return { type: 'tackled', ...b };
  if (ending === 'selfOut') return { type: 'selfOut', reason, ...b };
  if (touches > 0) return { type: 'touch', count: touches, ...b };
  if (bonus) return { type: 'bonus', bonusBeforeContact: true };
  return null;
}

/** The read-back of an engine preview, in words: headline and the consequences. */
function readback(p, raider, names, superOn) {
  const defender = 1 - raider;
  // The engine awards the super tackle extra whenever the raider is out against a raid-start defence of 3 or fewer.
  const superTackle = superOn && ['tackled', 'selfOut', 'doOrDieFailure'].includes(p.outcome);
  const scorers = [raider, defender].filter((team) => p.points[team] > 0).map((team) => `${names[team]} +${p.points[team]}`);
  let head = scorers.length ? scorers.join(' · ') : 'No points';
  if (superTackle) head = `Super tackle · ${head}`;
  else if (p.outcome === 'doOrDieFailure') head = `Do or die lost · ${head}`;
  const parts = [];
  for (const team of [defender, raider]) {
    if (p.allOut.includes(team)) parts.push(`${names[team]} all out`);
    else if (p.lost[team]) parts.push(`${names[team]} ${p.lost[team]} out`);
    if (p.revived[team]) parts.push(`${names[team]} ${p.revived[team]} back`);
  }
  parts.push(`next: ${names[p.nextRaidTeam]} raid`);
  return { head, tail: parts.join(' · ') };
}

function Pips({ on, team, label }) {
  return (
    <span className="rp-mat" aria-label={label}>
      <b>{on}</b>
      <span className="rp-pips" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <i key={i} className={`rp-pip rp-pip-${key(team)}${i < on ? '' : ' rp-pip-out'}`} />)}
      </span>
    </span>
  );
}

Pips.propTypes = { on: PropTypes.number.isRequired, team: PropTypes.number.isRequired, label: PropTypes.string.isRequired };

function Key({ label, sub, pressed, disabled, tone, wide, onClick, aria, children }) {
  return (
    <button
      type="button"
      className={`rp-key rp-key-${tone}${wide ? ' rp-key-wide' : ''}`}
      aria-pressed={pressed}
      aria-label={aria}
      disabled={disabled}
      onClick={onClick}
    >
      <b className="rp-key-label">{children ?? label}</b>
      {sub && <small className="rp-key-sub">{sub}</small>}
    </button>
  );
}

Key.propTypes = {
  label: PropTypes.string, sub: PropTypes.string, pressed: PropTypes.bool, disabled: PropTypes.bool,
  tone: PropTypes.oneOf(['raid', 'def', 'flat']).isRequired, wide: PropTypes.bool, onClick: PropTypes.func.isRequired,
  aria: PropTypes.string, children: PropTypes.node,
};

export default function KabaddiRaidPad({
  sportConfig, title, subtitle, colourStyle, match, names, swapped = false, isLive, live, notice,
  onCommit, onOpeningTeam, onFinish, onDiscard, onSwap,
}) {
  const { state, carried } = match;
  const sheetId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The staged entry, like a calculator's display: touch count, bonus, how the raid ended.
  const [touches, setTouches] = useState(0);
  const [bonus, setBonus] = useState(false);
  const [ending, setEnding] = useState(null);
  const [reason, setReason] = useState(SELF_OUT_REASONS[0]);
  const [highOpen, setHighOpen] = useState(false);
  const [moment, setMoment] = useState(null);
  const [undoNote, setUndoNote] = useState('');
  const [now, setNow] = useState(() => Date.now());
  // One confirmation id per staged raid, so a double tap on Confirm is a no-op in the engine.
  const restId = useRef(newId('raid'));

  const raid = state.activeRaid;
  const raidId = raid?.id ?? null;
  const ticking = state.clock.running || Boolean(raid?.raidClock.running);
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);
  const clear = () => {
    setTouches(0);
    setBonus(false);
    setEnding(null);
    setReason(SELF_OUT_REASONS[0]);
    setHighOpen(false);
  };
  // A raid opened or closed elsewhere (refresh, undo, cancel) never inherits another raid's entry.
  useEffect(() => {
    clear();
    restId.current = newId('raid');
  }, [raidId, state.revision]);
  useEffect(() => {
    if (!moment) return undefined;
    const timer = setTimeout(() => setMoment(null), MOMENT_MS);
    return () => clearTimeout(timer);
  }, [moment]);

  const at = clockNow(state, Math.max(now, Date.now()));
  const phase = boardPhase(state);
  const paused = state.phase === 'paused';
  const halfLeft = remainingTime(state, at, 'half');
  const raidLeft = raid ? remainingTime(state, at, 'raid') : null;
  const totals = matchTotals(match);
  const mat = state.mat.map((slots) => slots.length);
  const raider = raid ? raid.raidingTeam : state.nextRaidTeam;
  const defender = 1 - raider;
  const left = (state.courtSide[0] === 0) !== swapped ? 0 : 1;
  const order = [left, 1 - left];
  const log = raidLog(state);
  const inPlay = phase === 'ready' || phase === 'playing' || phase === 'halfPending' || phase === 'fullPending';
  const timeIsUp = !raid && halfLeft === 0 && phase === 'playing';
  const canScore = inPlay && !timeIsUp;
  const doOrDie = inPlay && isDoOrDie(state);
  const superOn = inPlay && isSuperTackleOn(state);
  const defenders = raid ? raid.startMat[defender] : mat[defender];

  const commit = (next, meta) => {
    setUndoNote('');
    onCommit(next, meta);
  };

  // ---- the staged ruling, previewed by the engine before Confirm ----
  const staged = rulingOf({ touches, bonus, ending, reason });
  const confirmId = raid ? `confirm-${raid.id}` : `confirm-${restId.current}`;
  const peek = (ruling) => (canScore ? previewQuickRaid(state, { id: confirmId, ...ruling }, at) : null);
  const outcome = staged && peek(staged);
  const words = outcome && readback(outcome, raider, names, superOn);
  // Key gates and labels: each key's own ruling, previewed (a rejected ruling is a disabled key).
  const solo = {
    touch: [1, 2, 3, 4, 5, 6, 7].map((n) => peek({ type: 'touch', count: n })),
    bonus: peek({ type: 'bonus', bonusBeforeContact: true }),
    empty: peek({ type: 'empty' }),
    tackled: peek({ type: 'tackled' }),
    selfOut: peek({ type: 'selfOut', reason }),
  };
  const award = (p, team) => (p && p.points[team] > 0 ? `${names[team]} +${p.points[team]}` : '');

  const pickTouches = (n) => {
    setTouches((t) => (t === n ? 0 : n));
    setEnding((end) => (end === 'empty' || end === 'tackled' || end === 'selfOut' ? null : end));
    setHighOpen(false);
  };
  const toggleBonus = () => {
    setBonus((on) => !on);
    setEnding((end) => (end === 'empty' ? null : end));
  };
  const pickEnding = (end) => {
    setEnding((cur) => (cur === end ? null : end));
    setTouches(0);
    if (end === 'empty') setBonus(false);
    setHighOpen(false);
  };

  const startRaidNow = () => {
    setMoment(null);
    commit(startNextRaid(state, { id: newId('raid'), atMs: clockNow(state) }), { kind: 'raid-start' });
  };
  const confirmRaid = () => {
    const next = applyQuickRaid(state, { id: confirmId, ...staged }, clockNow(state));
    const entry = next.events.at(-1);
    const found = raidMoment(entry);
    setMoment(found && { ...found, entryId: entry.id, raidingTeam: entry.raidingTeam, effects: entry.effects, before: entry.before, after: entry.after });
    commit(next, { kind: 'raid', entry });
  };
  const doUndo = () => {
    const next = undoAction(state);
    setMoment(null);
    onCommit(next, { kind: 'undo' });
    const back = matchTotals({ ...match, state: next });
    setUndoNote(boardPhase(next) === 'playing'
      ? `Undone · ${back.join('–')} · mat ${next.mat.map((m) => m.length).join('–')} · ${names[next.nextRaidTeam]} raid next`
      : '');
  };
  const closeSheetAnd = (action) => { setSheetOpen(false); action(); };

  // ---- status strip ----
  const centre = raid ? (
    <div className="rp-centre rp-centre-raid">
      <span className={`rp-raidclock${raidLeft === 0 ? ' rp-raidclock-zero' : ''}`} role="timer" aria-label={`Raid clock ${Math.ceil(raidLeft / 1000)} seconds`}>
        {Math.ceil(raidLeft / 1000)}<small>s</small>
      </span>
      <span className="rp-halfclock rp-halfclock-small" aria-label="Half clock">H{state.half} · {clock(halfLeft)}</span>
    </div>
  ) : (
    <div className="rp-centre">
      <span className="rp-halfclock" aria-label="Half clock">{clock(halfLeft)}</span>
      <small className="rp-centre-label">
        {phase === 'ready' && 'Ready'}
        {phase === 'halfTime' && 'Half time'}
        {(phase === 'finishReview' || phase === 'finished') && 'Full time'}
        {phase === 'playing' && (paused ? 'Paused' : `${state.half === 1 ? '1st' : '2nd'} half`)}
      </small>
    </div>
  );

  const flags = [];
  if (inPlay && doOrDie) flags.push(<em key="dod" className="rp-flag rp-flag-dod" role="note">Do or die · {names[raider]}</em>);
  if (inPlay && superOn) flags.push(<em key="super" className="rp-flag rp-flag-super" role="note" aria-label={`Super tackle on: ${names[defender]} ${mat[defender]} on mat`}>Super tackle on</em>);
  if (inPlay && !doOrDie && state.emptyStreak[raider] > 0) flags.push(<em key="empty" className="rp-flag rp-flag-quiet">{names[raider]} {plural(state.emptyStreak[raider], 'empty raid')}</em>);
  if (phase === 'finishReview') flags.push(<em key="review" className="rp-flag rp-flag-quiet">Final review · Finish match saves the result</em>);
  if (timeIsUp) flags.push(<em key="time" className="rp-flag rp-flag-quiet">Time’s up</em>);

  let banner = null;
  if (moment) {
    const scorer = moment.kind === 'allOut' ? 1 - moment.team : moment.team;
    const extra = moment.effects.awards.filter((a) => a.team === scorer && a.category === (moment.kind === 'allOut' ? 'allOut' : 'superTackleExtra')).reduce((n, a) => n + a.points, 0);
    const pts = moment.effects.awards.filter((a) => a.team === scorer).reduce((n, a) => n + a.points, 0);
    const heading = moment.kind === 'allOut' ? `All out · ${names[moment.team]}` : 'Super tackle!';
    const matMove = [scorer, 1 - scorer].map((team) => `${names[team]} ${moment.before.mat[team].length}→${moment.after.mat[team].length}`).join(' · ');
    banner = (
      <button type="button" className={`rp-banner rp-banner-${key(scorer)}`} onClick={() => setMoment(null)} aria-label={`${heading} · dismiss`}>
        <strong className="rp-banner-h"><HandUnderline>{heading}</HandUnderline></strong>
        <span className="rp-banner-l"><b>{names[scorer]} +{pts}</b> · {moment.kind === 'allOut' ? `all out +${extra}` : `super tackle +${extra}`}</span>
        <span className="rp-banner-s">{names[order[0]]} {totals[order[0]]}–{totals[order[1]]} {names[order[1]]}</span>
        <span className="rp-banner-m">Mat {matMove}{moment.kind === 'allOut' ? ` · ${names[moment.team]} back to 7` : ''}</span>
      </button>
    );
  }

  // ---- the tape: the calculator display between the strip and the keys ----
  let tape;
  if (highOpen) {
    tape = (
      <div className="rp-tape rp-tape-keys" role="group" aria-label="Touches 4 to 7">
        {[4, 5, 6, 7].map((n) => (
          <button key={n} type="button" className="rp-mini" disabled={!solo.touch[n - 1]} aria-pressed={touches === n} onClick={() => pickTouches(n)}>
            {n}{!solo.touch[n - 1] && <small> · {defenders} on mat</small>}
          </button>
        ))}
      </div>
    );
  } else if (ending === 'selfOut') {
    tape = (
      <div className="rp-tape rp-tape-keys" role="group" aria-label="Why the raider is out">
        {SELF_OUT_REASONS.map((r) => <button key={r} type="button" className="rp-mini rp-mini-text" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
      </div>
    );
  } else if (staged) {
    const bits = [];
    if (ending === 'empty') bits.push(doOrDie ? 'Empty · do or die' : 'Empty raid');
    if (ending === 'tackled') bits.push('Raider tackled');
    if (touches) bits.push(plural(touches, 'touch'));
    if (bonus) bits.push('bonus');
    tape = (
      <div className="rp-tape" role="status" aria-label="Raid entry">
        <span className="rp-tape-entry"><i className={`rp-dot rp-dot-${key(raider)}`} aria-hidden="true" />{names[raider]} · {bits.join(' + ')}</span>
        <button type="button" className="rp-clear" onClick={clear} aria-label="Clear the entry">C</button>
      </div>
    );
  } else if (phase === 'ready') {
    tape = (
      <div className="rp-tape rp-tape-keys" role="group" aria-label="Who raids first">
        {[0, 1].map((team) => <button key={team} type="button" className="rp-mini rp-mini-text" aria-pressed={state.nextRaidTeam === team} onClick={() => onOpeningTeam(team)}>{names[team]} raid first</button>)}
      </div>
    );
  } else if (undoNote) {
    tape = <p className="rp-tape rp-tape-note" role="status">{undoNote}</p>;
  } else if (raid) {
    // Cancel sits at the left of the tape, never where C (clear) sits, so a double tap can't cancel.
    tape = (
      <div className="rp-tape rp-tape-raid">
        <button type="button" className="rp-cancel" onClick={() => commit(cancelRaid(state), { kind: 'raid-cancel' })}>
          <span aria-hidden="true">✕</span> Cancel raid
        </button>
        <span className="rp-tape-hint">Raid {state.raidNumber + 1} · tap the result</span>
      </div>
    );
  } else if (log.length) {
    const row = raidRow(log[0], names, carried);
    tape = (
      <button type="button" className="rp-tape rp-tape-last" onClick={() => setSheetOpen(true)} aria-label="Last raid · open the raid log">
        <span className="rp-tape-entry"><i className={`rp-dot rp-dot-${key(log[0].raidingTeam)}`} aria-hidden="true" />{row.number} · {raidSummary(log[0], names)}</span>
        <b className="rp-tape-score">{row.score.join('–')}</b>
      </button>
    );
  } else {
    tape = <p className="rp-tape rp-tape-hint">No raids yet</p>;
  }

  // ---- the pad (fixed keys) or, between halves and at full time, the summary in its place ----
  let pad;
  if (phase === 'halfTime' || phase === 'finishReview' || phase === 'finished') {
    const r = result(state);
    const firstHalf = phase === 'halfTime';
    const rows = [
      ['Raid points', r.breakdown.map((b) => b.raid)],
      ['Tackle points', r.breakdown.map((b) => b.tackle)],
      ['All out points', r.breakdown.map((b) => b.allOut)],
      ['Other awards', r.breakdown.map((b) => b.technical + b.defenderOut)],
      ['Earlier points', carried],
    ].filter(([label, values]) => label === 'Raid points' || label === 'Tackle points' || values.some(Boolean));
    const raids = [0, 1].map((team) => log.filter((e) => e.raidingTeam === team).length);
    const allOuts = [0, 1].map((team) => log.filter((e) => e.effects.allOut.includes(1 - team)).length);
    const supers = [0, 1].map((team) => log.filter((e) => e.raidingTeam !== team && e.effects.awards.some((a) => a.category === 'superTackleExtra')).length);
    // The half story: the score when the first half's last raid ended (engine snapshot), then the rest.
    const lastFirst = log.find((e) => e.half === 1);
    const atHalf = lastFirst ? lastFirst.after.teams.map((t, i) => teamTotal(t) + carried[i]) : carried;
    const halves = phase === 'halfTime' ? [] : [['1st half', atHalf], ['2nd half', totals.map((n, i) => n - atHalf[i])]];
    const verdict = firstHalf ? `Half time · ${totals.join('–')}` : r.draw ? `Draw · ${totals.join('–')}` : `${names[totals[0] > totals[1] ? 0 : 1]} win by ${Math.abs(totals[0] - totals[1])}`;
    pad = (
      <section className="rp-summary" aria-labelledby="rp-sum-h">
        <h2 id="rp-sum-h" className="rp-summary-h">{verdict}</h2>
        <table className="rp-table" aria-label="Points by type">
          <thead><tr><th scope="col"><span className="sr-only">Type</span></th>{order.map((team) => <th key={team} scope="col"><i className={`rp-dot rp-dot-${key(team)}`} aria-hidden="true" />{names[team]}</th>)}</tr></thead>
          <tbody>
            {rows.map(([label, values]) => <tr key={label}><th scope="row">{label}</th>{order.map((team) => <td key={team}>{values[team]}</td>)}</tr>)}
            {halves.map(([label, values]) => <tr key={label} className="rp-half-row"><th scope="row">{label}</th>{order.map((team) => <td key={team}>{values[team]}</td>)}</tr>)}
            <tr className="rp-total"><th scope="row">Total</th>{order.map((team) => <td key={team}>{totals[team]}</td>)}</tr>
            <tr className="rp-quiet-row"><th scope="row">Raids · all outs · super tackles</th>{order.map((team) => <td key={team}>{raids[team]} · {allOuts[team]} · {supers[team]}</td>)}</tr>
          </tbody>
        </table>
        {firstHalf && <p className="rp-summary-note">{names[1 - state.openingRaidTeam]} raid first · mat carries over {mat[0]}–{mat[1]}</p>}
      </section>
    );
  } else {
    const raidTone = 'raid';
    const off = !canScore;
    const tackledSub = solo.tackled ? `${award(solo.tackled, defender)}${superOn ? ' · super' : ''}` : '';
    let emptySub = 'no points';
    if (solo.empty?.outcome === 'doOrDieFailure') emptySub = `do or die · ${award(solo.empty, defender)}`;
    pad = (
      <div className="rp-pad" role="group" aria-label={`Raid by ${names[raider]}: result keys`}>
        <div className="rp-row rp-row-touch">
          {[1, 2, 3].map((n) => (
            <Key key={n} tone={raidTone} label={String(n)} aria={`${n} touch${n > 1 ? 'es' : ''}`} pressed={touches === n} disabled={off || !solo.touch[n - 1]}
              sub={solo.touch[n - 1] ? `+${n}` : `${defenders} on mat`} onClick={() => pickTouches(n)} />
          ))}
          <Key tone={raidTone} label={touches >= 4 ? String(touches) : '4+'} aria="4 to 7 touches" pressed={touches >= 4 || highOpen} disabled={off || !solo.touch[3]}
            sub={solo.touch[3] ? (touches >= 4 ? `+${touches}` : '4–7') : `${defenders} on mat`} onClick={() => (touches >= 4 ? pickTouches(touches) : setHighOpen((o) => !o))} />
        </div>
        <div className="rp-row">
          <Key tone={raidTone} wide label="Bonus" pressed={bonus} disabled={off || !solo.bonus} sub={solo.bonus ? '+1 · before contact' : `needs 6 · ${defenders} on mat`} onClick={toggleBonus} />
          <Key tone="flat" wide label="Empty" pressed={ending === 'empty'} disabled={off || !solo.empty} sub={emptySub} onClick={() => pickEnding('empty')} />
        </div>
        <div className="rp-row">
          <Key tone="def" wide label="Tackled" pressed={ending === 'tackled'} disabled={off || !solo.tackled} sub={tackledSub} onClick={() => pickEnding('tackled')} />
          <Key tone="def" wide label="Raider out" pressed={ending === 'selfOut'} disabled={off || !solo.selfOut} sub={solo.selfOut ? `${award(solo.selfOut, defender)} · line, cant` : ''} onClick={() => pickEnding('selfOut')} />
        </div>
      </div>
    );
  }

  // ---- the one bar: start the raid, then confirm it (with the read-back), or the phase action ----
  let bar;
  if (phase === 'halfTime') bar = <button type="button" className="se-go rp-go" onClick={() => commit(startSecondHalf(state, clockNow(state)), { kind: 'half' })}>Start second half</button>;
  else if (phase === 'finishReview' || phase === 'finished') bar = <button type="button" className="se-go rp-go" onClick={() => commit(finish(state), { kind: 'finish' })} disabled={phase === 'finished'}>Finish match</button>;
  else if (timeIsUp && !staged) bar = <button type="button" className="se-go rp-go" onClick={() => commit(callTimeUp(state, clockNow(state)), { kind: 'time-up' })}>{state.half === 1 ? 'Call half time' : 'Call full time'}</button>;
  else if (outcome) {
    bar = (
      <button type="button" className="se-go rp-go rp-confirm" onClick={confirmRaid}>
        <span className="rp-go-head">Confirm · {words.head}</span>
        <span className="rp-go-tail">{words.tail}</span>
      </button>
    );
  } else if (raid) {
    bar = <button type="button" className="se-go rp-go rp-confirm" disabled>Confirm · tap the result</button>;
  } else {
    bar = (
      <button type="button" className={`rp-start rp-start-${key(raider)}`} onClick={startRaidNow}>
        <i className="rp-mark" aria-hidden="true" />
        <span className="rp-go-head">Start raid {state.raidNumber + 1} · {names[raider]}</span>
        <span className="rp-go-tail">30 s clock{doOrDie ? ' · do or die' : ''}</span>
      </button>
    );
  }

  const canUndo = canUndoAction(state);

  return (
    <div className="sb rp" data-team-board="" data-kabaddi-board="" data-raiding={raid ? '' : undefined} data-raider={key(raider)} data-phase={phase} style={{ ...colourStyle, ...sportIdentityVars(sportConfig.id) }}>
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" isLive={isLive} onFinish={onFinish} finishDisabled={Boolean(raid) || phase === 'finishReview'} />
      {notice}
      <div className="rp-strip">
        <div className="rp-scores">
          {order.map((team, i) => (
            <section key={team} className={`rp-team rp-team-${key(team)}${i ? ' rp-team-right' : ''}`} aria-label={`${names[team]} ${totals[team]}`} data-raiding={inPlay && team === raider ? '' : undefined}>
              <span className="rp-team-name">
                {inPlay && team === raider && <i className="rp-mark rp-mark-small" aria-label="raiding" />}
                {names[team]}
              </span>
              <span className="rp-score">{totals[team]}</span>
              <Pips on={mat[team]} team={team} label={`${names[team]} ${mat[team]} on mat`} />
            </section>
          ))}
          {centre}
        </div>
        <div className="rp-flags">{flags}</div>
        {banner}
      </div>
      {tape}
      {pad}
      <div className="rp-bar">{bar}</div>
      <BoardBar
        canUndo={canUndo} undoHint={undoHint(match)} onUndo={doUndo}
        disabledHint={raid ? 'Cancel the raid first' : undefined}
        sheetId={sheetId} sheetOpen={sheetOpen} onMore={() => setSheetOpen(true)}
      />
      <BoardOptionsSheet id={sheetId} open={sheetOpen} onClose={() => setSheetOpen(false)} live={live} onDiscard={onDiscard}>
        <BoardSheetGroup>
          <p className="sb-sheet-note rp-log-title">Raid log · newest first</p>
          {log.length === 0 ? <p className="sb-sheet-note">No raids yet.</p> : (
            <ol className="rp-log" aria-label="Raid log">
              {log.map((entry) => {
                const row = raidRow(entry, names, carried);
                return (
                  <li key={row.id}>
                    <span className="rp-log-main"><b>Raid {row.number}{row.half === 2 ? ' · 2nd half' : ''}</b><span>{row.text}</span><small>{row.mat}</small></span>
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
              {paused ? 'Resume clock' : 'Pause clock'}<span className="sb-row-aside">{clock(halfLeft)}</span>
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

KabaddiRaidPad.propTypes = {
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
  migrated: PropTypes.bool,
  onCommit: PropTypes.func.isRequired,
  onOpeningTeam: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSwap: PropTypes.func.isRequired,
};
