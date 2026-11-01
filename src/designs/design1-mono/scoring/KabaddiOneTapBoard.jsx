import { useEffect, useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import KabaddiHeader from './KabaddiHeader';
import { HandUnderline } from '../kit/KitParts';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import {
  boardView, canUndo, confirmRuling, confirmTechnical, hasRoster, lastAction, liveRaids, momentOf, raiderLost, readback,
  renameLast, startHalf, togglePause, touchedThenTackled, tryRuling, tryTechnical, undoLabel, undoMatch,
} from '../../../utils/kabaddiBoardModel';
import './kabaddiOneTap.css';

// Kabaddi scorer, one-tap variant (exploration k2, round 3, 2026-11-01). One tap scores the raid,
// like the football and volleyball boards; Undo is the safety net and names what it puts back.
// Point keys replace "Touched, then a count"; Bonus is a modifier armed before the result; rare
// rulings (raider stepped out, touched then tackled, technical point) live in the options sheet.
// With a team list, a skippable "Who was out?" row follows the tap and renames the raid without
// changing a point. Every number and every enabled key comes from the raid engine through
// kabaddiBoardModel; this view decides nothing about the rules.

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const BONUS = { bonusAwarded: true, bonusBeforeContact: true };

export default function KabaddiOneTap({ initialMatch, colourStyle, title, subtitle, now = Date.now, nameWindowMs = 8000, onSave, onFinish, onDiscard }) {
  const [match, setMatch] = useState(initialMatch);
  const [bonus, setBonus] = useState(false);
  const [picker, setPicker] = useState(false);
  const [commit, setCommit] = useState(null); // the last raid scored here: { id, ruling, atMs, raider, before }
  const [naming, setNaming] = useState(null); // { kind: 'outs'|'raider', team, need, picked: [] }
  const [note, setNote] = useState(null); // moment of the last tap, or the undo it made
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!naming || nameWindowMs === null) return undefined;
    const id = setTimeout(() => setNaming(null), nameWindowMs);
    return () => clearTimeout(id);
  }, [naming, nameWindowMs]);

  const at = now();
  const view = boardView(match, at);
  const { state } = match;
  const raiding = view.raidingTeam;
  const scoring = ['ready', 'playing'].includes(view.phase);
  const B = bonus ? BONUS : {};

  // Engine answers: a key is live only when the engine accepts its ruling right now.
  const ok = (ruling) => scoring && tryRuling(state, ruling, { atMs: at }) !== null;
  const rulings = {
    empty: { type: 'empty' },
    tackled: { type: 'tackled', ...B },
    bonusOnly: { type: 'bonus', bonusBeforeContact: true },
    selfOut: { type: 'selfOut', reason: 'Raider stepped out', ...B },
    mixed: { ...touchedThenTackled(state), ...B },
  };
  const touch = (n) => ({ type: 'touch', count: n, ...B });

  const save = (next) => {
    setMatch(next);
    onSave?.(next);
  };

  // Who can be named for the raid just scored: the defenders out, or the raider who went out.
  const namingFor = (entry, before) => {
    if (entry.outcome === 'touch' && hasRoster(match, 1 - entry.raidingTeam)) {
      return { kind: 'outs', team: 1 - entry.raidingTeam, need: entry.input.count, picked: [], before };
    }
    if (raiderLost(entry) && hasRoster(match, entry.raidingTeam)) return { kind: 'raider', team: entry.raidingTeam, need: 1, picked: [], before };
    return null;
  };

  const score = (ruling) => {
    if (!ok(ruling)) return;
    const before = state;
    const next = confirmRuling(match, ruling, { atMs: at });
    const entry = liveRaids(next.state)[0];
    save(next);
    setBonus(false);
    setPicker(false);
    setCommit({ id: entry.id, ruling, atMs: at, before });
    setNaming(namingFor(entry, before));
    const moment = momentOf(entry);
    setNote(moment ? { ...moment, kind: 'moment', totals: boardView(next, at).totals } : null);
  };

  const technical = (team) => {
    if (!scoring || !tryTechnical(state, team, { atMs: at })) return;
    save(confirmTechnical(match, team, { atMs: at }));
    setBonus(false);
    setPicker(false);
    setCommit(null);
    setNaming(null);
    setNote(null);
  };

  const pickName = (slot) => {
    const picked = naming.picked.includes(slot) ? naming.picked.filter((s) => s !== slot) : [...naming.picked, slot];
    if (picked.length < naming.need) {
      setNaming({ ...naming, picked });
      return;
    }
    const renamed = renameLast(match, commit, naming.kind === 'outs' ? { outs: picked } : { raider: slot });
    if (renamed) {
      save(renamed);
      setCommit({ ...commit, id: liveRaids(renamed.state)[0].id, raider: naming.kind === 'raider' ? slot : commit.raider, named: true });
    }
    setNaming(null);
  };

  const undoLast = () => {
    const undone = lastAction(state);
    const next = undoMatch(match);
    save(next);
    setBonus(false);
    setPicker(false);
    setCommit(null);
    setNaming(null);
    setNote(undone ? { kind: 'undo', what: undone.type === 'raid' ? `raid ${undone.raidNumber}` : 'technical point', totals: boardView(next, at).totals } : null);
  };

  // The last raid can be named later by tapping its line, while it is still the latest action.
  const latest = lastAction(state);
  const nameable = Boolean(commit && latest?.id === commit.id && latest.type === 'raid' && namingFor(latest, commit.before));
  const reopenNaming = () => { if (nameable) setNaming(namingFor(latest, commit.before)); };

  const halfWord = view.phase === 'finishReview' ? 'Full time' : view.phase === 'halfTime' ? 'Half time' : view.paused ? 'Paused' : view.half === 1 ? '1st half' : '2nd half';
  let last;
  if (note?.kind === 'undo') last = { label: 'Undone', text: `Undid ${note.what} · ${note.totals.join('–')}` };
  else if (latest) last = { label: latest.type === 'raid' ? `Raid ${latest.raidNumber}` : 'Technical', text: readback(match, latest, { guessed: nameable && !commit.named }) };
  else last = { label: 'First raid', text: `${state.teams[raiding].name} raid first` };
  if (view.phase === 'finishReview') {
    const [a, b] = view.totals;
    last = { label: 'Full time', text: a === b ? `Draw ${a}–${b}` : `${state.teams[a > b ? 0 : 1].name} win by ${Math.abs(a - b)}` };
  }

  const beforeView = naming ? boardView({ ...match, state: naming.before }, at) : null;
  const rare = [
    { key: 'selfOut', label: 'Raider stepped out', ruling: rulings.selfOut },
    { key: 'mixed', label: 'Touched, then tackled', ruling: rulings.mixed },
  ].map((r) => {
    const entry = scoring ? tryRuling(state, r.ruling, { atMs: at }) : null;
    return { ...r, entry, sub: entry ? readback(match, entry) : 'Not now' };
  });
  const technicals = [0, 1].map((team) => {
    const entry = scoring ? tryTechnical(state, team, { atMs: at }) : null;
    return { team, entry, sub: entry ? readback(match, entry) : 'Not now' };
  });

  return (
    <KabaddiOneTapBoard
      title={title} subtitle={subtitle} colourStyle={colourStyle}
      view={view} names={state.teams.map((t) => t.name)} clock={mmss(view.remainingMs)} halfWord={halfWord} scoring={scoring}
      bonus={bonus} picker={picker}
      keyOk={{
        empty: !bonus && ok(rulings.empty), tackled: ok(rulings.tackled), one: ok(touch(1)), two: ok(touch(2)), three: ok(touch(3)),
        bonus: ok({ type: 'bonus', bonusBeforeContact: true }), bonusOnly: ok(rulings.bonusOnly),
      }}
      countOk={(n) => ok(touch(n))}
      naming={naming && { ...naming, chips: beforeView.mat[naming.team].onMat }}
      last={last} moment={note?.kind === 'moment' ? note : null} nameable={nameable && !naming}
      rare={rare} technicals={technicals}
      canUndo={canUndo(state)} undoHint={undoLabel(state)}
      onEmpty={() => score(rulings.empty)} onTackled={() => score(rulings.tackled)}
      onTouch={(n) => score(touch(n))} onBonusOnly={() => score(rulings.bonusOnly)}
      onBonus={() => { setPicker(false); setBonus((b) => !b); }}
      onPicker={() => setPicker((p) => !p)}
      onRare={(ruling) => score(ruling)} onTechnical={technical}
      onName={pickName} onSkipNames={() => setNaming(null)} onReopenNames={reopenNaming}
      onUndo={undoLast}
      onClock={() => save(togglePause(match, at))}
      onStartHalf={() => save({ ...match, state: startHalf(state, { atMs: at }) })}
      onFinish={onFinish} onDiscard={onDiscard}
    />
  );
}

KabaddiOneTap.propTypes = {
  initialMatch: PropTypes.object.isRequired,
  colourStyle: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  now: PropTypes.func,
  nameWindowMs: PropTypes.number,
  onSave: PropTypes.func,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};

/** Presentation only: every label, number and enabled state arrives as a prop. */
export function KabaddiOneTapBoard({
  title, subtitle, colourStyle, view, names, clock, halfWord, scoring, bonus, picker, keyOk, countOk, naming, last, moment, nameable,
  rare, technicals, canUndo: undoable, undoHint: hint, onEmpty, onTackled, onTouch, onBonusOnly, onBonus, onPicker, onRare,
  onTechnical, onName, onSkipNames, onReopenNames, onUndo, onClock, onStartHalf, onFinish, onDiscard,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const sheetId = useId();
  const style = useMemo(() => ({ ...colourStyle, ...sportIdentityVars('kabaddi') }), [colourStyle]);
  const off = !scoring;
  const close = (fn) => () => { fn(); setOptionsOpen(false); };

  let slot = null;
  if (naming) {
    slot = (
      <>
        <p className="ko-ask">
          <span>{naming.kind === 'outs' ? `Who was out? ${names[naming.team]}${naming.need > 1 ? `, ${naming.need} in order` : ''}` : `Who raided? ${names[naming.team]}`}</span>
          <button type="button" className="ko-skip" onClick={onSkipNames}>Skip</button>
        </p>
        <div className="kit-seg ko-seg ko-names" role="group" aria-label={naming.kind === 'outs' ? `${names[naming.team]} players out, in order` : `${names[naming.team]} raider`}>
          {naming.chips.map((p) => (
            <button key={p.slot} type="button" aria-pressed={naming.picked.includes(p.slot)} onClick={() => onName(p.slot)}>
              {naming.picked.includes(p.slot) && <span className="ko-order">{naming.picked.indexOf(p.slot) + 1}</span>}{p.name}
            </button>
          ))}
        </div>
      </>
    );
  } else if (picker) {
    slot = (
      <>
        <p className="ko-ask">How many touched?{bonus ? ' Bonus is on' : ''}</p>
        <div className="kit-seg ko-seg ko-count" role="group" aria-label="Defenders touched">
          {[3, 4, 5, 6, 7].map((n) => <button key={n} type="button" aria-pressed={false} disabled={!countOk(n)} onClick={() => onTouch(n)}>{n}</button>)}
        </div>
      </>
    );
  } else if (bonus) {
    slot = (
      <>
        <p className="ko-ask">Bonus is on: tap the result, or</p>
        <div className="ko-bonusonly">
          <button type="button" className="se-ctl ko-chip" disabled={!keyOk.bonusOnly} onClick={onBonusOnly}>Bonus only</button>
        </div>
      </>
    );
  }

  return (
    <div className="sb kb ko" style={style} data-team-board="">
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" onFinish={onFinish} />
      <KabaddiHeader view={view} names={names} clock={clock} halfWord={halfWord} scoring={scoring} momentTeam={moment?.team} onClock={onClock} />

      <div className="ko-pad">
        {/* one status card: the last raid, prominent, so a wrong tap is obvious; while a follow-up is
            open (bonus, 3+, who was out) it takes the card's place, so nothing below ever moves */}
        <div className={`ko-status${slot ? ' ko-status-ask' : ''}`}>
          {(!slot || naming) && (
            <button type="button" className={`ko-last${moment ? ' ko-last-moment' : ''}`} disabled={!nameable} onClick={onReopenNames}
              aria-live="polite" style={moment ? { '--kit-underline': `var(--team-${moment.team === 0 ? 'a' : 'b'}-line)` } : undefined}>
              {!naming && <small>{last.label}{nameable ? ' · tap to name players' : ''}</small>}
              <span>
                {moment
                  ? <><HandUnderline>{moment.word}</HandUnderline>{` · ${names[moment.team]} +${moment.points} · ${moment.totals.join('–')}`}</>
                  : last.text}
              </span>
            </button>
          )}
          {slot}
        </div>

        {view.phase === 'finishReview' && <div className="ko-go"><button type="button" className="se-go" onClick={onFinish}>Finish match</button></div>}
        {view.phase === 'halfTime' && <div className="ko-go"><button type="button" className="se-go" onClick={onStartHalf}>Start 2nd half</button></div>}

        <div className="ko-keys" role="group" aria-label="Score the raid">
          <button type="button" className="se-ctl ko-key" aria-pressed={bonus} disabled={off || (!bonus && !keyOk.bonus)} onClick={onBonus}>Bonus</button>
          <button type="button" className="se-ctl ko-key" disabled={off || !keyOk.two} onClick={() => onTouch(2)}>+2</button>
          <button type="button" className="se-ctl ko-key" aria-pressed={picker} disabled={off || !keyOk.three} onClick={onPicker}>3+</button>
          <button type="button" className="se-ctl ko-key ko-key-big" disabled={off || !keyOk.empty} onClick={onEmpty}>Empty</button>
          <button type="button" className="se-ctl ko-key ko-key-big" disabled={off || !keyOk.one} onClick={() => onTouch(1)}>+1</button>
          <button type="button" className="se-ctl ko-key ko-key-big" disabled={off || !keyOk.tackled} onClick={onTackled}>Tackled</button>
        </div>
      </div>

      <BoardBar canUndo={undoable} undoHint={hint} onUndo={onUndo} sheetId={sheetId} sheetOpen={optionsOpen} onMore={() => setOptionsOpen(true)} />
      <BoardOptionsSheet id={sheetId} open={optionsOpen} onClose={() => setOptionsOpen(false)} onDiscard={onDiscard}>
        <p className="sb-sheet-note">Rare rulings score at once; Undo puts them back.</p>
        <BoardSheetGroup>
          {rare.map((r) => (
            <button key={r.key} type="button" className="sb-row ko-row" disabled={!r.entry} onClick={close(() => onRare(r.ruling))}>
              <span>{r.label}</span><small>{r.sub}</small>
            </button>
          ))}
          {technicals.map((t) => (
            <button key={t.team} type="button" className="sb-row ko-row" disabled={!t.entry} onClick={close(() => onTechnical(t.team))}>
              <span>Technical point to {names[t.team]}</span><small>{t.sub}</small>
            </button>
          ))}
        </BoardSheetGroup>
        <BoardSheetGroup>
          <button type="button" className="sb-row" disabled={!scoring} onClick={close(onClock)}>{view.paused ? 'Resume clock' : 'Pause clock'}</button>
        </BoardSheetGroup>
      </BoardOptionsSheet>
    </div>
  );
}

KabaddiOneTapBoard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  colourStyle: PropTypes.object.isRequired,
  view: PropTypes.object.isRequired,
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  clock: PropTypes.string.isRequired,
  halfWord: PropTypes.string.isRequired,
  scoring: PropTypes.bool,
  bonus: PropTypes.bool,
  picker: PropTypes.bool,
  keyOk: PropTypes.object.isRequired,
  countOk: PropTypes.func.isRequired,
  naming: PropTypes.object,
  last: PropTypes.object.isRequired,
  moment: PropTypes.object,
  nameable: PropTypes.bool,
  rare: PropTypes.array.isRequired,
  technicals: PropTypes.array.isRequired,
  canUndo: PropTypes.bool.isRequired,
  undoHint: PropTypes.string,
  onEmpty: PropTypes.func.isRequired,
  onTackled: PropTypes.func.isRequired,
  onTouch: PropTypes.func.isRequired,
  onBonusOnly: PropTypes.func.isRequired,
  onBonus: PropTypes.func.isRequired,
  onPicker: PropTypes.func.isRequired,
  onRare: PropTypes.func.isRequired,
  onTechnical: PropTypes.func.isRequired,
  onName: PropTypes.func.isRequired,
  onSkipNames: PropTypes.func.isRequired,
  onReopenNames: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onClock: PropTypes.func.isRequired,
  onStartHalf: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};
