import { useEffect, useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import { HandUnderline } from '../kit/KitParts';
import SportIcon from '../landing/sportIcons';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import {
  boardView, canUndo, confirmRuling, hasRoster, lastRaidLine, liveRaids, momentOf, raiderLost, readback, rulingFor,
  startHalf, togglePause, tryRuling, undoHint, undoMatch,
} from '../../../utils/kabaddiBoardModel';
import './kabaddiScorer.css';

// Kabaddi scorer, a sibling of the goals and sets boards (exploration k2, round 2, 2026-11-01). The
// shared shell (header, Undo + More bar, options sheet) is BoardShell. On top: two compact team cards
// with the half clock between them, then one quiet row each for who raids, the mat, the rule cues and
// the last raid. Anchored at the bottom like the cricket scorer: the check line, one detail row that
// fills only when the engine needs an answer, four outcome keys that never move, and Confirm. Every
// number and every enabled key comes from the raid engine through kabaddiBoardModel; this view
// decides nothing about the rules.

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

  // Two separate lines: the check line by the keys (question, read-back, result) and the last raid
  // line under the header (what just happened, an undo, or the super tackle / all out moment).
  let check = '';
  if (!scoring && view.phase === 'finishReview') {
    const [a, b] = view.totals;
    check = a === b ? `Full time · draw ${a}–${b}` : `Full time · ${state.teams[a > b ? 0 : 1].name} win by ${Math.abs(a - b)}`;
  } else if (!scoring && view.phase === 'halfTime') check = `Half time · ${view.totals.join('–')}`;
  else if (askTouches) check = hasRoster(match, defending) ? 'Who did the raider touch? Tap in order' : 'How many defenders touched?';
  else if (askRaider) check = 'Who was the raider?';
  else if (draft && (pick.kind !== null || pick.bonus)) check = readback(match, draft);
  const last = note?.kind === 'undo'
    ? `Undid raid ${note.raid} · ${note.totals.join('–')}`
    : lastRaidLine(match) || `${state.teams[raiding].name} raid first`;

  return (
    <KabaddiScorerBoard
      title={title} subtitle={subtitle} colourStyle={colourStyle}
      view={view} names={state.teams.map((t) => t.name)} clock={mmss(view.remainingMs)}
      pick={pick} bonusOk={bonusOk} countOk={countOk}
      detail={pick.kind === 'touch'
        ? (hasRoster(match, defending) ? { kind: 'outs', team: defending } : { kind: 'count' })
        : draft && raiderLost(draft) && hasRoster(match, raiding) ? { kind: 'raider', team: raiding } : null}
      check={check} checkIsReadback={Boolean(draft && (pick.kind || pick.bonus) && !askRaider && !askTouches)}
      last={last} moment={note?.kind === 'moment' ? note : null}
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
  title, subtitle, colourStyle, view, names, clock, pick, bonusOk, countOk, detail, check, checkIsReadback, last, moment, ready,
  scoring, canUndo: undoable, undoHint: hint, onChoose, onBonus, onCount, onMore, onOut, onRaider, onConfirm, onUndo, onClock,
  onStartHalf, onFinish, onDiscard,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const sheetId = useId();
  const style = useMemo(() => ({ ...colourStyle, ...sportIdentityVars('kabaddi') }), [colourStyle]);
  const sides = [0, 1].map((team) => ({ team, key: team === 0 ? 'a' : 'b' }));
  const raider = view.raidingTeam;
  const halfWord = view.phase === 'finishReview' ? 'Full time' : view.phase === 'halfTime' ? 'Half time' : view.paused ? 'Paused' : view.half === 1 ? '1st half' : '2nd half';

  return (
    <div className="sb kb" style={style} data-team-board="">
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" onFinish={onFinish} />

      {/* 1. the scores: two compact team cards, the half clock between them */}
      <div className="kb-score">
        {sides.map(({ team, key }, i) => (
          <div key={key} className={`kb-team kb-team-${key}${moment?.team === team ? ' kb-moment' : ''}`} style={{ order: i * 2 }}
            aria-label={`${names[team]} ${view.totals[team]}`}>
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

      {/* 2. who raids now and who raids next, each under its own card */}
      {scoring && (
        <div className="kb-row kb-raid">
          {sides.map(({ team, key }) => (team === raider
            ? <span key={key} className={`kb-raiding kb-raiding-${key} kb-col-${key}`}><SportIcon name="Kabaddi" size={16} strokeWidth={2} />Raiding now</span>
            : <span key={key} className={`kb-nextraid kb-col-${key}`}>Raids next</span>))}
          <span className="kb-raidno kb-col-mid">Raid {view.raidNumber}</span>
        </div>
      )}

      {/* 3. players on the mat and who comes back first */}
      <div className="kb-row kb-mat" aria-label="On the mat">
        {sides.map(({ team, key }) => (
          <div key={key} className={`kb-side kb-side-${key} kb-col-${key}`}>
            <span className="kb-dots" aria-label={`${names[team]} ${view.mat[team].on} on the mat`}>
              {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < view.mat[team].on ? 'on' : ''} />)}
              <b>{view.mat[team].on}</b>
            </span>
            <span className="kb-next">{view.mat[team].out.length ? <>Next in: <b>{view.mat[team].out[0].name}</b></> : 'All on the mat'}</span>
          </div>
        ))}
      </div>

      {/* 4. the rule cues, in their own row */}
      {scoring && (view.doOrDie || view.superTackleOn) && (
        <div className="kb-cues">
          {view.doOrDie && <em className="kb-cue kb-cue-dod" role="note">Do or die · {names[raider]}</em>}
          {view.superTackleOn && (
            <em className="kb-cue kb-cue-super" role="note" aria-label={`Super tackle on: ${names[1 - raider]} ${view.mat[1 - raider].on} on the mat`}>Super tackle on</em>
          )}
        </div>
      )}

      {/* 5. the last raid, or the big moment it made */}
      <p className={`kb-last${moment ? ' kb-last-moment' : ''}`} aria-live="polite"
        style={moment ? { '--kit-underline': `var(--team-${moment.team === 0 ? 'a' : 'b'}-line)` } : undefined}>
        {moment
          ? <><HandUnderline>{moment.word}</HandUnderline>{` · ${names[moment.team]} +${moment.points} · ${moment.totals.join('–')}`}</>
          : last}
      </p>

      {/* the scorer's half, anchored at the bottom like the cricket scorer: nothing in it ever moves */}
      <div className="kb-pad">
        <p className={`kb-line${checkIsReadback ? ' kb-line-read' : ''}`} aria-live="polite">{check}</p>

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

        <div className="kb-go">
          {view.phase === 'finishReview' && <button type="button" className="se-go" onClick={onFinish}>Finish match</button>}
          {view.phase === 'halfTime' && <button type="button" className="se-go" onClick={onStartHalf}>Start 2nd half</button>}
          {scoring && <button type="button" className="se-go" disabled={!ready} onClick={onConfirm}>Confirm</button>}
        </div>
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
  check: PropTypes.string,
  checkIsReadback: PropTypes.bool,
  last: PropTypes.string,
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
