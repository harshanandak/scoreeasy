import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { applyRaid, cancelRaid, finish, isDoOrDie, isSuperTackleOn, preview, remainingTime, result } from '../../../utils/kabaddiEngine';
import {
  boardPhase, callTimeUp, canUndoAction, clockNow, matchTotals, previewWords, raidLog, raidMoment, raidRow,
  startNextRaid, startSecondHalf, togglePause, undoAction, undoHint,
} from '../../../utils/kabaddiQuickMatch';
import { HandUnderline } from '../kit/KitParts';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import './kabaddiBoard.css';

// Kabaddi quick-match board. Presentation and taps only: every score, revival, all out, super
// tackle, do-or-die and bonus gate is read from the raid engine (kabaddiEngine.js, via
// kabaddiQuickMatch.js). A raid is recorded once: Raid by X -> outcome -> count/bonus -> preview
// -> Confirm, and one Undo puts the whole raid back.

const SELF_OUT_REASONS = ['Stepped out', 'Lost cant', 'Time ran out'];
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

function TeamPanel({ team, name, score, mat, raiding }) {
  const out = 7 - mat;
  return (
    <section className={`kb-team kb-team-${team === 0 ? 'a' : 'b'}`} aria-label={name} data-team={team === 0 ? 'a' : 'b'}>
      <div className="kb-team-top">
        <span className="kb-team-name">{name}</span>
        {raiding && <span className="kb-raiding">Raiding</span>}
      </div>
      <span className="kb-team-score" aria-label={`${name} score`}>{score}</span>
      <span className="kb-mat" role="img" aria-label={`${name}: ${mat} of 7 on mat${out ? `, ${out} out` : ''}`}>
        {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < mat ? 'kb-dot' : 'kb-dot kb-dot-out'} />)}
      </span>
      <span className="kb-mat-label" aria-hidden="true">{mat} on mat{out ? ` · ${out} out` : ''}</span>
    </section>
  );
}

TeamPanel.propTypes = {
  team: PropTypes.number.isRequired, name: PropTypes.string.isRequired, score: PropTypes.number.isRequired,
  mat: PropTypes.number.isRequired, raiding: PropTypes.bool,
};

function Outcome({ label, detail, onClick, disabled = false, pip }) {
  return (
    <button type="button" className="kb-outcome" onClick={onClick} disabled={disabled}>
      <b>{label}</b>{' '}
      <small>{pip !== undefined && <i className={`kb-pip kb-pip-${pip === 0 ? 'a' : 'b'}`} aria-hidden="true" />}{detail}</small>
    </button>
  );
}

Outcome.propTypes = {
  label: PropTypes.string.isRequired, detail: PropTypes.string.isRequired, onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool, pip: PropTypes.number,
};

export default function KabaddiRaidBoard({
  sportConfig, title, subtitle, colourStyle, match, names, swapped = false, isLive, live, notice, migrated = false,
  onCommit, onOpeningTeam, onFinish, onDiscard, onSwap,
}) {
  const { state, carried } = match;
  const sheetId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(null);
  const [count, setCount] = useState(1);
  const [bonus, setBonus] = useState(false);
  const [reason, setReason] = useState(SELF_OUT_REASONS[0]);
  const [moment, setMoment] = useState(null);
  const [undoNote, setUndoNote] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const raid = state.activeRaid;
  const ticking = state.clock.running || Boolean(raid?.raidClock.running);
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);
  // A raid opened or closed elsewhere (refresh, undo) never leaves a half-finished picker behind.
  useEffect(() => { if (!raid) setStep(null); }, [raid]);

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
  const halfMinutes = Math.round(state.rules.halfMs / 60000);

  const commit = (next, meta) => {
    setUndoNote('');
    onCommit(next, meta);
  };
  const openStep = (next) => {
    setStep(next);
    setCount(1);
    setBonus(false);
    setReason(SELF_OUT_REASONS[0]);
  };
  const startRaidNow = () => {
    setMoment(null);
    commit(startNextRaid(state, { id: newId('raid'), atMs: clockNow(state) }), { kind: 'raid-start' });
    openStep(null);
  };
  const eventFor = (kind) => {
    const base = { id: `confirm-${raid.id}`, raidId: raid.id, expectedRevision: state.revision };
    if (kind === 'touch') return { ...base, type: 'touch', count, ...bonusFields(bonus) };
    if (kind === 'bonus') return { ...base, type: 'bonus', bonusBeforeContact: true };
    if (kind === 'tackled') return { ...base, type: 'tackled', ...bonusFields(bonus) };
    if (kind === 'selfOut') return { ...base, type: 'selfOut', reason, ...bonusFields(bonus) };
    return { ...base, type: 'empty' };
  };
  const confirmRaid = () => {
    // One id per raid: a repeated Confirm of the same raid is a no-op in the engine.
    const next = applyRaid(state, eventFor(step));
    const entry = next.events.at(-1);
    const found = raidMoment(entry);
    setMoment(found && { ...found, entryId: entry.id, raidingTeam: entry.raidingTeam, effects: entry.effects });
    setStep(null);
    commit(next, { kind: 'raid', entry });
  };
  const doUndo = () => {
    const next = undoAction(state);
    setMoment(null);
    setStep(null);
    onCommit(next, { kind: 'undo' });
    const back = matchTotals({ ...match, state: next });
    setUndoNote(boardPhase(next) === 'playing'
      ? `Raid undone · ${back.join('–')} · mat ${next.mat.map((m) => m.length).join('–')} · ${names[next.nextRaidTeam]} raid next`
      : '');
  };
  const closeSheetAnd = (action) => { setSheetOpen(false); action(); };

  // ---- the surface between the score and the thumb zone ----
  let body = null;
  let primary = null;

  const preNotes = (
    <>
      {migrated && carried.some(Boolean) && log.length === 0 && (
        <p className="kb-note" role="note" aria-label="Earlier points">
          <b>{carried.join('–')} kept from before raid scoring</b>
          <span>Mat starts 7–7. Those points count in the total; Undo starts from here.</span>
        </p>
      )}
      {undoNote && <p className="kb-note kb-note-ok" role="status" aria-label="Undo result">{undoNote}</p>}
    </>
  );

  if (moment) {
    const scorer = 1 - moment.team;
    const isAllOut = moment.kind === 'allOut';
    const heading = isAllOut ? 'All out!' : 'Super tackle!';
    const sum = (keep) => moment.effects.awards.filter((award) => award.team === scorer && keep(award.category)).reduce((n, award) => n + award.points, 0);
    body = (
      <section className="kb-moment" role="region" aria-label={heading}>
        <i className="kb-moment-mark" aria-hidden="true" />
        <h2><HandUnderline>{heading}</HandUnderline></h2>
        <dl className="kb-rows">
          {isAllOut ? (
            <>
              <div><dt>{names[scorer]} points in the raid</dt><dd>+{sum((c) => c !== 'allOut')}</dd></div>
              <div><dt>All out bonus</dt><dd>+{sum((c) => c === 'allOut')}</dd></div>
              <div><dt>{names[moment.team]} back to 7</dt><dd>Mat {mat.join('–')}</dd></div>
            </>
          ) : (
            <>
              <div><dt>Raider out against 3 or fewer defenders</dt><dd>{names[scorer]} +{sum(() => true)}</dd></div>
              <div><dt>Only one player comes back</dt><dd>Mat {mat.join('–')}</dd></div>
            </>
          )}
          <div><dt>Score</dt><dd>{totals.join('–')}</dd></div>
        </dl>
      </section>
    );
    primary = <button type="button" className="se-go" onClick={() => setMoment(null)}>Continue</button>;
  } else if (phase === 'ready') {
    body = (
      <section className="kb-panel" aria-labelledby="kb-first">
        <h2 id="kb-first" className="kb-h">Who raids first?</h2>
        <div className="kb-pair" role="group" aria-label="Opening raid">
          {[0, 1].map((team) => (
            <button key={team} type="button" className="kb-choice" aria-pressed={state.nextRaidTeam === team} disabled={paused} onClick={() => onOpeningTeam(team)}>
              {names[team]} raid first
            </button>
          ))}
        </div>
        <p className="kb-quiet">Start on the referee’s whistle · 2 × {halfMinutes} min · 30 s raids</p>
      </section>
    );
    primary = (
      <button type="button" className={`kb-raid kb-raid-${state.nextRaidTeam === 0 ? 'a' : 'b'}`} onClick={startRaidNow}>
        <i className="kb-raid-mark" aria-hidden="true" />Start · first raid by {names[state.nextRaidTeam]}
      </button>
    );
  } else if (phase === 'halfTime') {
    const opener = 1 - state.openingRaidTeam;
    body = (
      <section className="kb-panel" aria-labelledby="kb-half">
        <h2 id="kb-half" className="kb-h kb-h-big">Half time</h2>
        <dl className="kb-rows">
          <div><dt>First half</dt><dd>{totals.join('–')}</dd></div>
          <div><dt>Mat carried over</dt><dd>{names[0]} {mat[0]} · {names[1]} {mat[1]}</dd></div>
          <div><dt>Second half</dt><dd>{names[opener]} raid first</dd></div>
          {state.emptyStreak.map((n, team) => (n ? <div key={team}><dt>{names[team]} empty raids</dt><dd>{n} · carries over</dd></div> : null))}
        </dl>
        <p className="kb-quiet">Start on the referee’s whistle · {clock(state.rules.halfMs)}</p>
      </section>
    );
    primary = <button type="button" className="se-go" onClick={() => commit(startSecondHalf(state, clockNow(state)), { kind: 'half' })}>Start second half</button>;
  } else if (phase === 'finishReview' || phase === 'finished') {
    const r = result(state);
    const verdict = r.draw ? `Draw · ${totals.join('–')}` : `${names[totals[0] > totals[1] ? 0 : 1]} win by ${Math.abs(totals[0] - totals[1])}`;
    const rows = [
      ['Raid points', r.breakdown.map((b) => b.raid)],
      ['Tackle points', r.breakdown.map((b) => b.tackle)],
      ['All out points', r.breakdown.map((b) => b.allOut)],
      ['Other awards', r.breakdown.map((b) => b.technical + b.defenderOut)],
      ['Earlier points', carried],
    ].filter(([label, values]) => label === 'Raid points' || label === 'Tackle points' || values.some(Boolean));
    body = (
      <section className="kb-panel" aria-labelledby="kb-full">
        <h2 id="kb-full" className="kb-h kb-h-big">Full time</h2>
        <p className="kb-verdict">{verdict}</p>
        <table className="kb-table" aria-label="Points by type">
          <thead><tr><th scope="col"><span className="sr-only">Type</span></th>{order.map((team) => <th key={team} scope="col">{names[team]}</th>)}</tr></thead>
          <tbody>
            {rows.map(([label, values]) => <tr key={label}><th scope="row">{label}</th>{order.map((team) => <td key={team}>{values[team]}</td>)}</tr>)}
            <tr className="kb-total"><th scope="row">Total</th>{order.map((team) => <td key={team}>{totals[team]}</td>)}</tr>
          </tbody>
        </table>
      </section>
    );
    primary = <button type="button" className="se-go" onClick={() => commit(finish(state), { kind: 'finish' })}>Finish match</button>;
  } else if (raid && !step) {
    const tackled = tryPreview(state, eventFor('tackled'));
    const empty = tryPreview(state, eventFor('empty'));
    const selfOut = tryPreview(state, { ...eventFor('selfOut'), reason: SELF_OUT_REASONS[0] });
    const award = (p, team) => (p ? `${names[team]} +${p.points[team]}` : '');
    body = (
      <section className="kb-panel" aria-labelledby="kb-raid">
        <div className="kb-raidline">
          <div>
            <span className="kb-eyebrow">Raid {state.raidNumber + 1}{raid.doOrDieAtStart ? ' · do or die' : ''}</span>
            <h2 id="kb-raid" className="kb-h">Raid by {names[raider]}</h2>
          </div>
          <span className={`kb-raidclock${raidLeft === 0 ? ' kb-raidclock-zero' : ''}`} aria-label="Raid clock">{Math.ceil(raidLeft / 1000)}<small> s</small></span>
        </div>
        {halfLeft === 0 && <p className="kb-note kb-note-warn" role="note">Time’s up · record this raid, then call time</p>}
        <div className="kb-outcomes">
          <Outcome label="Touch" detail="Defenders put out" pip={raider} onClick={() => openStep('touch')} />
          <Outcome label="Bonus only" detail={raid.bonusEligibleAtStart ? `${names[raider]} +1 · no revival` : 'Needs 6 defenders'} pip={raid.bonusEligibleAtStart ? raider : undefined} disabled={!raid.bonusEligibleAtStart} onClick={() => openStep('bonus')} />
          <Outcome label="Tackled" detail={`${award(tackled, defender)}${raid.superEligibleAtStart ? ' · super tackle' : ''}`} pip={defender} onClick={() => openStep('tackled')} />
          <Outcome label="Empty" detail={empty?.outcome === 'doOrDieFailure' ? `Raider out · ${award(empty, defender)}` : 'No points · safe return'} pip={empty?.outcome === 'doOrDieFailure' ? defender : undefined} onClick={() => openStep('empty')} />
          <Outcome label="Raider out" detail={`Line, cant or time · ${award(selfOut, defender)}`} pip={defender} onClick={() => openStep('selfOut')} />
          <button type="button" className="kb-outcome kb-outcome-quiet" onClick={() => commit(cancelRaid(state), { kind: 'raid-cancel' })}>
            <b>Cancel raid</b>{' '}<small>No whistle · nothing recorded</small>
          </button>
        </div>
      </section>
    );
  } else if (raid && step) {
    const event = eventFor(step);
    const outcome = tryPreview(state, event);
    const words = outcome && previewWords(outcome, state, names, carried);
    const heading = {
      touch: 'How many touched?',
      bonus: 'Bonus only',
      tackled: raid.superEligibleAtStart ? 'Super tackle' : 'Raider tackled',
      selfOut: 'Raider out',
      empty: outcome?.outcome === 'doOrDieFailure' ? 'Do or die · raider out' : 'Empty raid',
    }[step];
    const bonusAllowed = raid.bonusEligibleAtStart;
    body = (
      <section className="kb-panel" aria-labelledby="kb-step">
        <div className="kb-stephead">
          <button type="button" className="kb-back" aria-label="Back to outcomes" onClick={() => setStep(null)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div>
            <span className="kb-eyebrow">{names[raider]} raid · {Math.ceil(raidLeft / 1000)} s</span>
            <h2 id="kb-step" className="kb-h">{heading}</h2>
          </div>
        </div>
        {step === 'touch' && (
          <div className="kb-count" role="group" aria-label="Defenders touched">
            {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`kb-num kb-num-${raider === 0 ? 'a' : 'b'}`} aria-pressed={count === n} disabled={n > raid.startMat[defender]} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
        )}
        {step === 'selfOut' && (
          <div className="kb-reasons" role="group" aria-label="Why the raider is out">
            {SELF_OUT_REASONS.map((r) => <button key={r} type="button" className="kb-choice" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
          </div>
        )}
        {['touch', 'tackled', 'selfOut'].includes(step) && (
          <button type="button" className="kb-toggle" aria-pressed={bonus} disabled={!bonusAllowed} onClick={() => setBonus((on) => !on)}>
            <span>Bonus before contact</span>
            <span className="kb-toggle-hint" aria-hidden="true">{bonusAllowed ? (bonus ? '✓ +1' : '+1?') : 'Needs 6 defenders'}</span>
          </button>
        )}
        {words && (
          <div className="kb-preview" role="status" aria-label="Raid preview">
            <b>{words.title}</b>
            <span className="kb-preview-lines">{words.lines.map((line) => <span key={line}>{line}</span>)}</span>
          </div>
        )}
      </section>
    );
    primary = <button type="button" className="se-go" onClick={confirmRaid} disabled={!outcome}>Confirm raid</button>;
  } else {
    // At rest, between raids.
    const doOrDie = isDoOrDie(state);
    const superOn = isSuperTackleOn(state);
    const timeIsUp = halfLeft === 0 && phase === 'playing';
    body = (
      <section className="kb-panel" aria-label="Next raid">
        {doOrDie && (
          <p className="kb-note kb-note-danger" role="note" aria-label="Do or die">
            <b>Do or die for {names[raider]}</b>
            <span>Two empty raids. A third without a point puts the raider out.</span>
          </p>
        )}
        {timeIsUp && <p className="kb-note kb-note-warn" role="note"><b>Time’s up</b><span>{state.half === 1 ? 'Call half time on the referee’s whistle.' : 'Call full time to review the result.'}</span></p>}
        <p className="kb-cue">
          <span className="kb-eyebrow">Raid {state.raidNumber + 1} · next</span>
          <span>{names[raider]} attack · {names[defender]} defend with {mat[defender]}</span>
          {superOn && <span className="kb-cue-tags"><em className="kb-tag kb-tag-gold">Super tackle on</em></span>}
        </p>
        <div className="kb-recent">
          <div className="kb-recent-head">
            <span className="kb-eyebrow">Recent raids</span>
            {log.length > 0 && <button type="button" className="kb-link" onClick={() => setSheetOpen(true)}>Raid log</button>}
          </div>
          {log.length === 0 ? <p className="kb-quiet">No raids yet.</p> : (
            <ol className="kb-recent-list">
              {log.slice(0, 3).map((entry) => {
                const row = raidRow(entry, names, carried);
                return <li key={row.id}><span>{row.number} · {row.text}</span><strong>{row.score.join('–')}</strong></li>;
              })}
            </ol>
          )}
        </div>
      </section>
    );
    primary = timeIsUp ? (
      <button type="button" className="se-go" onClick={() => commit(callTimeUp(state, clockNow(state)), { kind: 'time-up' })}>
        {state.half === 1 ? 'Call half time' : 'Call full time'}
      </button>
    ) : (
      <button type="button" className={`kb-raid kb-raid-${raider === 0 ? 'a' : 'b'}`} onClick={startRaidNow}>
        <i className="kb-raid-mark" aria-hidden="true" />Raid by {names[raider]}
      </button>
    );
  }

  const canUndo = canUndoAction(state);
  const clockLabel = phase === 'ready' ? 'Ready' : phase === 'halfTime' ? 'Half time' : phase === 'finishReview' ? 'Full time' : `Half ${state.half}`;

  return (
    <div className="sb kb" data-team-board="" data-kabaddi-board="" data-raiding={raid ? '' : undefined} style={{ ...colourStyle, ...sportIdentityVars(sportConfig.id) }}>
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" isLive={isLive} onFinish={onFinish} finishDisabled={Boolean(raid) || phase === 'finishReview'} />
      {notice}
      <div className="kb-meta">
        <span className="kb-sport"><i className="kb-sport-mark" aria-hidden="true" />{sportConfig.name}</span>
        <span className="kb-clock" aria-label="Half clock">{clockLabel} · {clock(halfLeft)}</span>
        {paused && phase === 'playing' && <span className="kb-tag">Clock paused</span>}
      </div>
      <div className="kb-score" data-compact={raid || moment ? '' : undefined}>
        {order.map((team) => (
          <TeamPanel key={team} team={team} name={names[team]} score={totals[team]} mat={mat[team]} raiding={['ready', 'playing'].includes(phase) && raider === team} />
        ))}
      </div>
      <div className="kb-body">
        {preNotes}
        {body}
      </div>
      {primary && <div className="kb-go">{primary}</div>}
      <BoardBar
        canUndo={canUndo} undoHint={undoHint(match)} onUndo={doUndo}
        disabledHint={raid ? 'Cancel the raid first' : undefined}
        sheetId={sheetId} sheetOpen={sheetOpen} onMore={() => setSheetOpen(true)}
      />
      <BoardOptionsSheet id={sheetId} open={sheetOpen} onClose={() => setSheetOpen(false)} live={live} onDiscard={onDiscard}>
        <BoardSheetGroup>
          <p className="sb-sheet-note kb-log-title">Raid log · newest first</p>
          {log.length === 0 ? <p className="sb-sheet-note">No raids yet.</p> : (
            <ol className="kb-log" aria-label="Raid log">
              {log.map((entry) => {
                const row = raidRow(entry, names, carried);
                return (
                  <li key={row.id}>
                    <span className="kb-log-main"><b>Raid {row.number}{row.half === 2 ? ' · 2nd half' : ''}</b><span>{row.text}</span><small>{row.mat}</small></span>
                    <strong>{row.score.join('–')}</strong>
                  </li>
                );
              })}
            </ol>
          )}
        </BoardSheetGroup>
        <BoardSheetGroup>
          {(phase === 'playing') && !raid && (
            <button type="button" className="sb-row" onClick={() => closeSheetAnd(() => commit(togglePause(state, clockNow(state)), { kind: 'clock' }))}>
              {paused ? 'Resume clock' : 'Pause clock'}<span className="sb-row-aside kb-row-aside">{clock(halfLeft)}</span>
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

KabaddiRaidBoard.propTypes = {
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
