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
import KabaddiCourt from './KabaddiCourt';
import './kabaddiBoard.css';

// Kabaddi quick-match board: the court is the board. Presentation and taps only: every score,
// revival, all out, super tackle, do-or-die and bonus gate is read from the raid engine
// (kabaddiEngine.js, via kabaddiQuickMatch.js). A raid is recorded once: Raid by X -> mark the
// defenders touched and the bonus line on the court -> how it ended -> preview -> Confirm, and one
// Undo puts the whole raid back.

const SELF_OUT_REASONS = ['Stepped out', 'Lost cant', 'Time ran out'];
const bonusFields = (on) => (on ? { bonusAwarded: true, bonusBeforeContact: true } : {});
const key = (team) => (team === 0 ? 'a' : 'b');
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

function ScoreCard({ team, name, score, raiding, gain }) {
  return (
    <section className={`kb-team kb-team-${key(team)}`} aria-label={name} data-team={key(team)}>
      <span className="kb-team-name">{name}</span>
      <span className="kb-team-line">
        <span className="kb-team-score" aria-label={`${name} score`}>{score}</span>
        {gain > 0 && <span className="kb-gain" aria-hidden="true">+{gain}</span>}
      </span>
      {raiding && <span className="kb-raiding">{raiding}</span>}
    </section>
  );
}

ScoreCard.propTypes = {
  team: PropTypes.number.isRequired, name: PropTypes.string.isRequired, score: PropTypes.number.isRequired,
  raiding: PropTypes.string, gain: PropTypes.number,
};

function Outcome({ label, detail, pressed, onClick, pip }) {
  return (
    <button type="button" className="kb-outcome" aria-pressed={pressed} onClick={onClick}>
      <b>{label}</b>{' '}
      <small>{pip !== undefined && <i className={`kb-pip kb-pip-${key(pip)}`} aria-hidden="true" />}{detail}</small>
    </button>
  );
}

Outcome.propTypes = {
  label: PropTypes.string.isRequired, detail: PropTypes.string.isRequired, onClick: PropTypes.func.isRequired,
  pressed: PropTypes.bool, pip: PropTypes.number,
};

export default function KabaddiRaidBoard({
  sportConfig, title, subtitle, colourStyle, match, names, swapped = false, isLive, live, notice, migrated = false,
  onCommit, onOpeningTeam, onFinish, onDiscard, onSwap,
}) {
  const { state, carried } = match;
  const sheetId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);
  // The raid being marked: how it ended, the defenders touched (slot ids, in tap order), bonus.
  const [ending, setEnding] = useState(null);
  const [touched, setTouched] = useState([]);
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
  // A raid opened or closed elsewhere (refresh, undo, cancel) never inherits another raid's marks.
  useEffect(() => {
    setEnding(null);
    setTouched([]);
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
  const raider = raid ? raid.raidingTeam : state.nextRaidTeam;
  const defender = 1 - raider;
  const top = (state.courtSide[0] === 0) !== swapped ? 0 : 1;
  const order = [top, 1 - top];
  const log = raidLog(state);
  const halfMinutes = Math.round(state.rules.halfMs / 60000);
  const inPlay = phase === 'ready' || phase === 'playing' || phase === 'halfPending' || phase === 'fullPending';
  const timeIsUp = !raid && halfLeft === 0 && phase === 'playing';

  const commit = (next, meta) => {
    setUndoNote('');
    onCommit(next, meta);
  };
  const startRaidNow = () => {
    setMoment(null);
    commit(startNextRaid(state, { id: newId('raid'), atMs: clockNow(state) }), { kind: 'raid-start' });
  };

  // ---- the raid being recorded: one engine event, previewed before Confirm ----
  const liveTouched = raid ? touched.filter((slot) => state.mat[defender].includes(slot)) : [];
  const eventFor = (end) => {
    const base = { id: `confirm-${raid.id}`, raidId: raid.id, expectedRevision: state.revision };
    if (end === 'tackled') return { ...base, type: 'tackled', ...bonusFields(bonus) };
    if (end === 'selfOut') return { ...base, type: 'selfOut', reason, ...bonusFields(bonus) };
    if (liveTouched.length) return { ...base, type: 'touch', count: liveTouched.length, outsInOrder: liveTouched, ...bonusFields(bonus) };
    if (bonus) return { ...base, type: 'bonus', bonusBeforeContact: true };
    return { ...base, type: 'empty' };
  };
  const outcome = raid && ending ? tryPreview(state, eventFor(ending)) : null;
  const words = outcome && previewWords(outcome, state, names, carried);
  const headline = words && (ending === 'tackled' && raid.superEligibleAtStart ? `Super tackle · ${words.title}` : words.title);

  const markTouch = (slot, mark) => {
    if (!raid || ending === 'selfOut') return;
    setTouched((list) => {
      const on = list.includes(slot);
      const want = mark ?? !on;
      if (want === on) return list;
      if (want && list.length >= raid.startMat[defender]) return list;
      return want ? [...list, slot] : list.filter((s) => s !== slot);
    });
    // A touch means the raider got back to score it; tackled/out raids score no touches.
    setEnding('safe');
  };
  const toggleBonus = () => {
    setBonus((on) => !on);
    setEnding((end) => end ?? 'safe');
  };
  const confirmRaid = () => {
    // One id per raid: a repeated Confirm of the same raid is a no-op in the engine.
    const next = applyRaid(state, eventFor(ending));
    const entry = next.events.at(-1);
    const found = raidMoment(entry);
    setMoment(found && { ...found, entryId: entry.id, raidingTeam: entry.raidingTeam, effects: entry.effects });
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

  // ---- the court ----
  const caught = Boolean(raid) && (ending === 'tackled' || ending === 'selfOut' || outcome?.outcome === 'doOrDieFailure');
  const superOn = inPlay && isSuperTackleOn(state);
  const doOrDie = inPlay && isDoOrDie(state);
  const sideFor = (team) => {
    const isRaider = inPlay && team === raider;
    const raiderSlot = raid ? raid.raiderSlotId : state.mat[team][0];
    const slots = isRaider ? state.mat[team].filter((slot) => slot !== raiderSlot) : state.mat[team];
    const defending = Boolean(raid) && team === defender;
    const tokens = slots.map((slot, index) => {
      let tokenState = 'on';
      if (defending && liveTouched.includes(slot)) tokenState = ending === 'safe' ? 'touched' : 'void';
      return { slot, index, state: tokenState, onToggle: defending && ending !== 'selfOut' ? markTouch : null };
    });
    for (let i = 0; i < (outcome?.revived[team] ?? 0); i += 1) tokens.push({ slot: `back-${team}-${i}`, index: tokens.length, state: 'coming' });
    const tags = [];
    if (inPlay && !raid && team === raider && timeIsUp) tags.push(<em key="time" className="kb-tag kb-tag-warn">Time’s up</em>);
    if (inPlay && raid && team === raider && doOrDie) {
      tags.push(<em key="dod" className="kb-tag kb-tag-danger" role="note" aria-label="Do or die">Do or die · {names[team]}</em>);
    } else if (inPlay && state.emptyStreak[team] > 0 && !(team === raider && doOrDie)) {
      tags.push(<em key="empty" className="kb-tag">{state.emptyStreak[team]} empty raid{state.emptyStreak[team] > 1 ? 's' : ''}</em>);
    }
    if (inPlay && team === defender && superOn) tags.push(<em key="super" className="kb-tag kb-tag-gold">Super tackle on</em>);
    let overlay = null;
    if (moment && moment.team === team) {
      const scorer = moment.kind === 'allOut' ? 1 - team : team;
      const pts = moment.effects.awards.filter((a) => a.team === scorer).reduce((n, a) => n + a.points, 0);
      const bonusPts = moment.effects.awards.filter((a) => a.team === scorer && a.category === (moment.kind === 'allOut' ? 'allOut' : 'superTackleExtra')).reduce((n, a) => n + a.points, 0);
      const heading = moment.kind === 'allOut' ? 'All out!' : 'Super tackle!';
      overlay = (
        <section className={`kb-moment kb-moment-${moment.kind}`} role="region" aria-label={heading}>
          <h2><HandUnderline>{heading}</HandUnderline></h2>
          <p><b>{names[scorer]} +{pts}</b> · {moment.kind === 'allOut' ? `all out +${bonusPts}` : `super tackle +${bonusPts}`}</p>
          <p>{moment.kind === 'allOut' ? `${names[team]} back to 7` : `${moment.effects.revived[team].length} back in · mat ${mat[team]}`}</p>
        </section>
      );
    }
    return {
      team,
      name: names[team],
      onMat: mat[team],
      sitting: state.outQueue[team].length,
      tokens,
      tags,
      overlay,
      moment: moment && moment.team === team ? moment.kind : null,
      superOn: team === defender && superOn,
      // The raider waits on its own side of the midline, and crosses into the other half to raid.
      raider: inPlay && team === (raid ? defender : raider) && mat[raider] > 0
        ? { team: raider, state: raid ? (caught ? 'caught' : 'raiding') : 'rest', doOrDie }
        : null,
      bonus: defending ? { eligible: raid.bonusEligibleAtStart, on: bonus, onToggle: toggleBonus } : null,
      pick: phase === 'ready' ? { pressed: state.nextRaidTeam === team, onPick: () => onOpeningTeam(team) } : null,
    };
  };
  const sides = order.map(sideFor);

  const midline = {};
  if (raid) {
    midline.left = (
      <button type="button" className="kb-cancel" onClick={() => commit(cancelRaid(state), { kind: 'raid-cancel' })}>
        <span aria-hidden="true">✕</span> Cancel raid
      </button>
    );
    midline.right = (
      <span className={`kb-raidclock${raidLeft === 0 ? ' kb-raidclock-zero' : ''}${raid.doOrDieAtStart ? ' kb-raidclock-dod' : ''}`} aria-label="Raid clock">
        {Math.ceil(raidLeft / 1000)}<small>s</small>
      </span>
    );
  } else if (phase === 'playing') {
    midline.left = <span className="kb-midtag">Raid {state.raidNumber + 1}</span>;
    if (doOrDie) {
      midline.right = <em className="kb-tag kb-tag-danger kb-tag-big" role="note" aria-label="Do or die">Do or die · {names[raider]}</em>;
    }
  } else if (phase === 'ready') {
    midline.left = <span className="kb-midtag">Tap a half · who raids first?</span>;
  }

  let courtOverlay = null;
  if (phase === 'halfTime') {
    const opener = 1 - state.openingRaidTeam;
    courtOverlay = (
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
    courtOverlay = (
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
  }

  // ---- the thumb zone: what the scorer does next ----
  let info = null;
  let actions = null;
  if (phase === 'ready') {
    info = migrated && carried.some(Boolean) ? (
      <p className="kb-note" role="note" aria-label="Earlier points">
        <b>{carried.join('–')} kept from before raid scoring</b>
        <span>Mat starts 7–7 · those points count in the total</span>
      </p>
    ) : <p className="kb-quiet kb-info-line">Start on the referee’s whistle · 2 × {halfMinutes} min · 30 s raids</p>;
    actions = (
      <button type="button" className={`kb-raid kb-raid-${key(state.nextRaidTeam)}`} onClick={startRaidNow}>
        <i className="kb-raid-mark" aria-hidden="true" />Start · first raid by {names[state.nextRaidTeam]}
      </button>
    );
  } else if (phase === 'halfTime') {
    actions = <button type="button" className="se-go" onClick={() => commit(startSecondHalf(state, clockNow(state)), { kind: 'half' })}>Start second half</button>;
  } else if (phase === 'finishReview' || phase === 'finished') {
    actions = <button type="button" className="se-go" onClick={() => commit(finish(state), { kind: 'finish' })}>Finish match</button>;
  } else if (raid) {
    const tackled = tryPreview(state, eventFor('tackled'));
    const selfOut = tryPreview(state, eventFor('selfOut'));
    const safe = tryPreview(state, eventFor('safe'));
    const award = (p, team) => (p ? `${names[team]} +${p.points[team]}` : '');
    let safeDetail = 'Empty · no points';
    if (safe?.outcome === 'doOrDieFailure') safeDetail = `Do or die · ${award(safe, defender)}`;
    else if (safe && safe.points[raider] > 0) safeDetail = award(safe, raider);
    info = words ? (
      <div className="kb-preview" role="status" aria-label="Raid preview">
        {/* the headline is on the Confirm key and the score chip; here it is for screen readers */}
        <b className="sr-only">{headline}</b>
        <span className="kb-preview-lines">{words.lines.map((line) => <span key={line}>{line}</span>)}</span>
      </div>
    ) : (
      <p className="kb-quiet kb-info-line">
        {raid.doOrDieAtStart ? 'Do or die · ' : ''}Tap defenders touched{raid.bonusEligibleAtStart ? ' · bonus line' : ''} · then how it ended
      </p>
    );
    actions = (
      <>
        {ending === 'selfOut' ? (
          <div className="kb-outcomes kb-reasons" role="group" aria-label="Why the raider is out">
            <button type="button" className="kb-back" aria-label="Back to outcomes" onClick={() => setEnding(liveTouched.length || bonus ? 'safe' : null)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            {SELF_OUT_REASONS.map((r) => <button key={r} type="button" className="kb-choice" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
          </div>
        ) : (
          <div className="kb-outcomes" role="group" aria-label="How the raid ended">
            <Outcome label="Back safe" detail={safeDetail} pressed={ending === 'safe'} pip={safe?.points[raider] > 0 ? raider : safe?.outcome === 'doOrDieFailure' ? defender : undefined} onClick={() => setEnding('safe')} />
            <Outcome label="Tackled" detail={award(tackled, defender)} pressed={ending === 'tackled'} pip={defender} onClick={() => setEnding('tackled')} />
            <Outcome label="Raider out" detail={award(selfOut, defender)} pressed={false} pip={defender} onClick={() => setEnding('selfOut')} />
          </div>
        )}
        <button type="button" className="se-go kb-confirm" onClick={confirmRaid} disabled={!outcome}>
          Confirm raid{outcome ? ` · ${headline}` : ''}
        </button>
      </>
    );
  } else {
    // At rest, between raids: the last few raids, then the next raid (or the half's time up).
    if (undoNote) info = <p className="kb-note kb-note-ok" role="status" aria-label="Undo result">{undoNote}</p>;
    else if (migrated && carried.some(Boolean) && log.length === 0) {
      info = (
        <p className="kb-note" role="note" aria-label="Earlier points">
          <b>{carried.join('–')} kept from before raid scoring</b>
          <span>Mat starts 7–7 · those points count in the total</span>
        </p>
      );
    } else if (log.length === 0) info = <p className="kb-quiet kb-info-line">No raids yet · the raid log is under ⋯</p>;
    else {
      info = (
        <button type="button" className="kb-recent" onClick={() => setSheetOpen(true)} aria-label="Recent raids · open the raid log">
          <ol className="kb-recent-list">
            {log.slice(0, 3).map((entry) => {
              const row = raidRow(entry, names, carried);
              return (
                <li key={row.id}>
                  <i className={`kb-pip kb-pip-${key(entry.raidingTeam)}`} aria-hidden="true" />
                  <span>{row.number} · {row.text}</span>
                  <strong>{row.score.join('–')}</strong>
                </li>
              );
            })}
          </ol>
        </button>
      );
    }
    actions = timeIsUp ? (
      <button type="button" className="se-go" onClick={() => commit(callTimeUp(state, clockNow(state)), { kind: 'time-up' })}>
        {state.half === 1 ? 'Call half time' : 'Call full time'}
      </button>
    ) : (
      <button type="button" className={`kb-raid kb-raid-${key(raider)}`} onClick={startRaidNow}>
        <i className="kb-raid-mark" aria-hidden="true" />Raid by {names[raider]}
      </button>
    );
  }

  const canUndo = canUndoAction(state);
  const clockLabel = phase === 'ready' ? 'Ready' : phase === 'halfTime' ? 'Half time' : phase === 'finishReview' ? 'Full time' : `Half ${state.half}`;
  const gains = outcome ? outcome.points : [0, 0];

  return (
    <div className="sb kb" data-team-board="" data-kabaddi-board="" data-raiding={raid ? '' : undefined} data-raider={key(raider)} data-phase={phase} style={{ ...colourStyle, ...sportIdentityVars(sportConfig.id) }}>
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" isLive={isLive} onFinish={onFinish} finishDisabled={Boolean(raid) || phase === 'finishReview'} />
      {notice}
      <div className="kb-meta">
        <span className="kb-sport"><i className="kb-sport-mark" aria-hidden="true" />{sportConfig.name}</span>
        <span className="kb-clock" aria-label="Half clock">{clockLabel} · {clock(halfLeft)}</span>
        {paused && phase === 'playing' && <span className="kb-tag">Clock paused</span>}
      </div>
      <div className="kb-score">
        {order.map((team) => (
          <ScoreCard key={team} team={team} name={names[team]} score={totals[team]} gain={gains[team]} raiding={inPlay && raider === team ? (phase === 'ready' ? 'Raids first' : 'Raiding') : null} />
        ))}
      </div>
      <KabaddiCourt
        sides={sides}
        midline={midline}
        onTouch={markTouch}
        overlay={courtOverlay && <div className="kb-court-overlay">{courtOverlay}</div>}
        dim={Boolean(courtOverlay)}
      />
      <div className="kb-go">
        {raid && <h2 className="sr-only">Raid by {names[raider]}</h2>}
        <div className="kb-info">{info}</div>
        {actions}
      </div>
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
