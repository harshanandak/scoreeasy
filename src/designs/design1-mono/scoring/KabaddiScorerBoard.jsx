import { useEffect, useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import { HandUnderline } from '../kit/KitParts';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import {
  boardView, canUndo, confirmRuling, hasRoster, lastRaidLine, liveRaids, momentOf, raiderLost, readback, rulingFor,
  startHalf, togglePause, tryRuling, undoHint, undoMatch,
} from '../../../utils/kabaddiBoardModel';
import './kabaddiScorer.css';

// Kabaddi scorer, a sibling of the goals and sets boards (exploration k2, 2026-11-01). The shared
// shell (header, Undo + More bar, options sheet) is BoardShell; this file adds only what kabaddi
// needs: two team score panels with the half clock between them, a slim mat row under them, four
// outcome keys that never move, one detail row that appears only when the engine needs an answer,
// one plain read-back line and Confirm. Every number and every enabled key comes from the raid
// engine through kabaddiBoardModel; this view decides nothing about the rules.

const EMPTY_PICK = { kind: null, bonus: false, count: null, outs: [], raider: null, more: false };
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The scorer: owns the saved match and the scorer's current picks; the board only draws them. */
export default function KabaddiScorer({ initialMatch, initialPick, colourStyle, title, subtitle, now = Date.now, onSave, onFinish, onDiscard }) {
  const [match, setMatch] = useState(initialMatch);
  const [pick, setPick] = useState(initialPick ?? EMPTY_PICK);
  const [note, setNote] = useState(null); // { kind: 'moment'|'undo', ... } shown in the line until the next pick
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const at = now();
  const view = boardView(match, at);
  const { state } = match;
  const raiding = view.raidingTeam;
  const defending = 1 - raiding;
  const scoring = ['ready', 'playing'].includes(view.phase);

  // Engine answers for the keys: a key is live only when the engine accepts its ruling now.
  const probe = (ruling) => scoring && tryRuling(state, ruling, { atMs: at }) !== null;
  const bonusOk = probe({ type: 'bonus', bonusBeforeContact: true });
  const countOk = (n) => probe({ type: 'touch', count: n });

  const ruling = rulingFor(pick);
  const draft = tryRuling(state, ruling, { atMs: at, raider: pick.raider });
  const askRaider = Boolean(draft && raiderLost(draft) && hasRoster(match, raiding) && !pick.raider);
  const askTouches = pick.kind === 'touch' && !ruling;
  const ready = Boolean(draft) && !askRaider;

  const save = (next) => {
    setMatch(next);
    onSave?.(next);
  };
  const choose = (kind) => {
    setNote(null);
    setPick((p) => (p.kind === kind ? { ...EMPTY_PICK, bonus: p.bonus } : { ...EMPTY_PICK, kind, bonus: p.bonus }));
  };
  const confirm = () => {
    if (!ready) return;
    const next = confirmRuling(match, ruling, { atMs: at, raider: pick.raider });
    save(next);
    setPick(EMPTY_PICK);
    const moment = momentOf(liveRaids(next.state)[0]);
    setNote(moment ? { ...moment, kind: 'moment', what: moment.kind, totals: boardView(next, at).totals } : null);
  };
  const undoLast = () => {
    const undone = liveRaids(state)[0];
    const next = undoMatch(match);
    save(next);
    setPick(EMPTY_PICK);
    setNote(undone ? { kind: 'undo', raid: undone.raidNumber, totals: boardView(next, at).totals } : null);
  };

  let line;
  if (!scoring && view.phase === 'finishReview') {
    const [a, b] = view.totals;
    line = a === b ? `Full time · draw ${a}–${b}` : `Full time · ${state.teams[a > b ? 0 : 1].name} win by ${Math.abs(a - b)}`;
  } else if (!scoring && view.phase === 'halfTime') line = `Half time · ${view.totals.join('–')}`;
  else if (askTouches) line = hasRoster(match, defending) ? `Who did the raider touch? Tap in order` : 'How many defenders touched?';
  else if (askRaider) line = `Who was the raider?`;
  else if (draft && pick.kind !== null) line = readback(match, draft);
  else if (draft && pick.bonus) line = readback(match, draft);
  else if (note?.kind === 'undo') line = `Undid raid ${note.raid} · ${note.totals.join('–')}`;
  else line = lastRaidLine(match) || `${state.teams[raiding].name} raid first`;

  return (
    <KabaddiScorerBoard
      title={title} subtitle={subtitle} colourStyle={colourStyle}
      view={view} names={state.teams.map((t) => t.name)} clock={mmss(view.remainingMs)}
      pick={pick} bonusOk={bonusOk} countOk={countOk}
      detail={pick.kind === 'touch'
        ? (hasRoster(match, defending) ? { kind: 'outs', team: defending } : { kind: 'count' })
        : draft && raiderLost(draft) && hasRoster(match, raiding) ? { kind: 'raider', team: raiding } : null}
      line={line} lineIsReadback={Boolean(draft && (pick.kind || pick.bonus) && !askRaider && !askTouches)} moment={note?.kind === 'moment' && !pick.kind && !pick.bonus ? note : null}
      ready={ready} scoring={scoring}
      canUndo={canUndo(state)} undoHint={undoHint(state)}
      onChoose={choose}
      onBonus={() => { setNote(null); setPick((p) => ({ ...p, bonus: !p.bonus })); }}
      onCount={(n) => setPick((p) => ({ ...p, count: p.count === n ? null : n }))}
      onMore={() => setPick((p) => ({ ...p, more: !p.more, count: null }))}
      onOut={(slot) => setPick((p) => ({ ...p, outs: p.outs.includes(slot) ? p.outs.filter((s) => s !== slot) : [...p.outs, slot] }))}
      onRaider={(slot) => setPick((p) => ({ ...p, raider: p.raider === slot ? null : slot }))}
      onConfirm={confirm} onUndo={undoLast}
      onClock={() => save(togglePause(match, at))}
      onStartHalf={() => save({ ...match, state: startHalf(state, { atMs: at }) })}
      onFinish={onFinish} onDiscard={onDiscard}
    />
  );
}

KabaddiScorer.propTypes = {
  initialMatch: PropTypes.object.isRequired,
  initialPick: PropTypes.object,
  colourStyle: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  now: PropTypes.func,
  onSave: PropTypes.func,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};

const KEYS = [
  { kind: 'touch', label: 'Touched' },
  { kind: 'bonus', label: 'Bonus' },
  { kind: 'tackled', label: 'Tackled' },
  { kind: 'empty', label: 'Empty' },
];

/** Presentation only: every label, number and enabled state arrives as a prop. */
export function KabaddiScorerBoard({
  title, subtitle, colourStyle, view, names, clock, pick, bonusOk, countOk, detail, line, moment, ready, scoring,
  lineIsReadback, canUndo: undoable, undoHint: hint, onChoose, onBonus, onCount, onMore, onOut, onRaider, onConfirm, onUndo, onClock,
  onStartHalf, onFinish, onDiscard,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const sheetId = useId();
  const style = useMemo(() => ({ ...colourStyle, ...sportIdentityVars('kabaddi') }), [colourStyle]);
  const sides = [0, 1].map((team) => ({ team, key: team === 0 ? 'a' : 'b' }));
  const tagFor = (team) => {
    if (!scoring) return null;
    if (team === view.raidingTeam) return view.doOrDie ? 'Do or die' : 'Raiding';
    return view.superTackleOn ? 'Super tackle on' : null;
  };
  const halfWord = view.phase === 'finishReview' ? 'Full time' : view.phase === 'halfTime' ? 'Half time' : view.paused ? 'Paused' : view.half === 1 ? '1st half' : '2nd half';

  return (
    <div className="sb kb" style={style} data-team-board="">
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" onFinish={onFinish} />

      <div className="kb-score">
        {sides.map(({ team, key }, i) => (
          <div key={key} className={`kb-team kb-team-${key}${moment?.team === team ? ' kb-moment' : ''}`} style={{ order: i * 2 }} aria-label={`${names[team]} ${view.totals[team]}`}>
            <span className={`kb-tag${tagFor(team) ? '' : ' kb-tag-none'}`}>{tagFor(team) ?? ' '}</span>
            <span className="kb-who">{names[team]}</span>
            <span className="kb-big">{view.totals[team]}</span>
          </div>
        ))}
        <button type="button" className="kb-clock" style={{ order: 1 }} onClick={onClock} disabled={!scoring}
          aria-label={view.paused ? `Clock paused at ${clock}. Resume` : `${clock} left in the ${halfWord}. Pause`}>
          <b>{clock}</b>
          <small>{halfWord}</small>
        </button>
      </div>

      <div className="kb-mat" aria-label="On the mat">
        {sides.map(({ team, key }) => (
          <div key={key} className={`kb-side kb-side-${key}`}>
            <span className="kb-dots" aria-label={`${names[team]} ${view.mat[team].on} on the mat`}>
              {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < view.mat[team].on ? 'on' : ''} />)}
              <b>{view.mat[team].on}</b>
            </span>
            <span className="kb-next">{view.mat[team].out.length ? <>Next in: <b>{view.mat[team].out[0].name}</b></> : 'All on the mat'}</span>
          </div>
        ))}
      </div>

      <div className="kb-keys" role="group" aria-label="What happened in the raid">
        {KEYS.map(({ kind, label }) => {
          const on = kind === 'bonus' ? pick.bonus : pick.kind === kind;
          const disabled = !scoring || (kind === 'bonus' && !bonusOk);
          return (
            <button key={kind} type="button" className="se-ctl kb-key" aria-pressed={on} disabled={disabled}
              onClick={() => (kind === 'bonus' ? onBonus() : onChoose(kind))}>{label}</button>
          );
        })}
      </div>

      <p className={`kb-line${moment ? ' kb-line-moment' : lineIsReadback ? ' kb-line-read' : ''}`} aria-live="polite" style={moment ? { '--kit-underline': `var(--team-${moment.team === 0 ? 'a' : 'b'}-line)` } : undefined}>
        {moment
          ? <><HandUnderline>{moment.word}</HandUnderline>{` · ${names[moment.team]} +${moment.points} · ${moment.totals.join('–')}`}</>
          : line}
      </p>

      <div className="kb-detail">
        {detail?.kind === 'count' && (
          <div className="kit-seg kb-seg" role="group" aria-label="Defenders touched">
            {(pick.more ? [4, 5, 6, 7] : [1, 2, 3]).map((n) => (
              <button key={n} type="button" aria-pressed={pick.count === n} disabled={!countOk(n)} onClick={() => onCount(n)}>{n}</button>
            ))}
            <button type="button" aria-pressed={false} disabled={!pick.more && !countOk(4)} onClick={onMore}>{pick.more ? '1–3' : '4+'}</button>
          </div>
        )}
        {detail?.kind === 'outs' && (
          <div className="kit-seg kb-seg kb-names" role="group" aria-label={`${names[detail.team]} players touched, in order`}>
            {view.mat[detail.team].onMat.map((p) => (
              <button key={p.slot} type="button" aria-pressed={pick.outs.includes(p.slot)} onClick={() => onOut(p.slot)}>
                {pick.outs.includes(p.slot) && <span className="kb-order">{pick.outs.indexOf(p.slot) + 1}</span>}{p.name}
              </button>
            ))}
          </div>
        )}
        {detail?.kind === 'raider' && (
          <div className="kit-seg kb-seg kb-names" role="group" aria-label={`${names[detail.team]} raider`}>
            {view.mat[detail.team].onMat.map((p) => (
              <button key={p.slot} type="button" aria-pressed={pick.raider === p.slot} onClick={() => onRaider(p.slot)}>{p.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="kb-go">
        {view.phase === 'finishReview' && <button type="button" className="se-go" onClick={onFinish}>Finish match</button>}
        {view.phase === 'halfTime' && <button type="button" className="se-go" onClick={onStartHalf}>Start 2nd half</button>}
        {scoring && <button type="button" className="se-go" disabled={!ready} onClick={onConfirm}>Confirm</button>}
      </div>

      <BoardBar canUndo={undoable} undoHint={hint} onUndo={onUndo} sheetId={sheetId} sheetOpen={optionsOpen} onMore={() => setOptionsOpen(true)} />
      <BoardOptionsSheet id={sheetId} open={optionsOpen} onClose={() => setOptionsOpen(false)} onDiscard={onDiscard}>
        <BoardSheetGroup>
          <button type="button" className="sb-row" disabled={!scoring} onClick={() => { onClock(); setOptionsOpen(false); }}>{view.paused ? 'Resume clock' : 'Pause clock'}</button>
        </BoardSheetGroup>
      </BoardOptionsSheet>
    </div>
  );
}

KabaddiScorerBoard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  colourStyle: PropTypes.object.isRequired,
  view: PropTypes.object.isRequired,
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  clock: PropTypes.string.isRequired,
  pick: PropTypes.object.isRequired,
  bonusOk: PropTypes.bool,
  countOk: PropTypes.func.isRequired,
  detail: PropTypes.object,
  line: PropTypes.string,
  lineIsReadback: PropTypes.bool,
  moment: PropTypes.object,
  ready: PropTypes.bool,
  scoring: PropTypes.bool,
  canUndo: PropTypes.bool.isRequired,
  undoHint: PropTypes.string,
  onChoose: PropTypes.func.isRequired,
  onBonus: PropTypes.func.isRequired,
  onCount: PropTypes.func.isRequired,
  onMore: PropTypes.func.isRequired,
  onOut: PropTypes.func.isRequired,
  onRaider: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onClock: PropTypes.func.isRequired,
  onStartHalf: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};
