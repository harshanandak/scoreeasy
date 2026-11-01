import { useEffect, useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import KabaddiStrip from './KabaddiStrip';
import { HandUnderline } from '../kit/KitParts';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import {
  beginRaid, boardView, cancelActiveRaid, canCancelRaid, canUndo, confirmRuling, confirmTechnical, hasRoster, lastAction, liveRaids,
  momentOf, raidFlags, raiderLost, readback, renameLast, startHalf, stepBackLabel, togglePause, touchedThenTackled, tryRuling,
  tryTechnical, undoMatch,
} from '../../../utils/kabaddiBoardModel';
import './kabaddiOneTap.css';
import './kabaddiRaid.css';

// Kabaddi scorer, round 4 (exploration k2, 2026-11-01): a raid is two taps. "Raid by Royals" is one
// big key in the raiding team's colour, in the same place every raid; it starts the 30 s raid clock
// (the ring in the strip). Then the round 3 outcome keys score it, with no Confirm; Undo is the
// safety net (before the outcome it cancels the started raid). With a team list, a touch or a
// tackle opens big player chips for the players who went out (skippable, the raid stands either
// way); with no team list the board shows counts only. "Quick scoring" in the options sheet drops
// the Raid by tap for 1-tap scoring. Every number, key state and word comes from the raid engine
// through kabaddiBoardModel; this view decides nothing about the rules.

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const BONUS = { bonusAwarded: true, bonusBeforeContact: true };
const teamKey = (team) => (team === 0 ? 'a' : 'b');

export default function KabaddiRaid({ initialMatch, colourStyle, title, subtitle, now = Date.now, onSave, onFinish, onDiscard }) {
  const [match, setMatch] = useState(initialMatch);
  const [bonus, setBonus] = useState(false);
  const [picker, setPicker] = useState(false);
  const [quick, setQuick] = useState(false);
  const [commit, setCommit] = useState(null); // { id, ruling, atMs (raid start), before, named }
  const [naming, setNaming] = useState(null); // { kind: 'outs'|'raider', team, need, picked: [], before }
  const [namedOut, setNamedOut] = useState([{}, {}]); // team -> { slot: outEventId } the scorer named when they left
  const [note, setNote] = useState(null);
  const [flash, setFlash] = useState(null); // id of the raid whose "off the court" caption is showing
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const at = now();
  const view = boardView(match, at);
  const { state } = match;
  const raiding = view.raidingTeam;
  const scoring = ['ready', 'playing'].includes(view.phase);
  const B = bonus ? BONUS : {};

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
  const resetFollowUps = () => { setBonus(false); setPicker(false); };

  const namingFor = (entry, before) => {
    if (entry.outcome === 'touch' && hasRoster(match, 1 - entry.raidingTeam)) {
      return { kind: 'outs', team: 1 - entry.raidingTeam, need: entry.input.count, picked: [], before };
    }
    if (raiderLost(entry) && hasRoster(match, entry.raidingTeam)) return { kind: 'raider', team: entry.raidingTeam, need: 1, picked: [], before };
    return null;
  };

  const raidBy = () => {
    if (!scoring || state.activeRaid) return;
    save(beginRaid(match, { atMs: at }));
    resetFollowUps();
    setCommit(null);
    setNaming(null);
    setNote(null);
    setFlash(null);
  };

  const score = (ruling) => {
    if (!ok(ruling)) return;
    const before = state;
    const raidAt = state.activeRaid ? state.activeRaid.raidClock.startedAtMs : at;
    const next = confirmRuling(match, ruling, { atMs: at });
    const entry = liveRaids(next.state)[0];
    save(next);
    resetFollowUps();
    setCommit({ id: entry.id, ruling, atMs: raidAt, before, named: false });
    setNaming(namingFor(entry, before));
    setFlash(entry.id);
    const moment = momentOf(entry);
    setNote(moment ? { ...moment, kind: 'moment', totals: boardView(next, at).totals } : null);
  };

  const technical = (team) => {
    if (!scoring || !tryTechnical(state, team, { atMs: at })) return;
    save(confirmTechnical(match, team, { atMs: at }));
    resetFollowUps();
    setCommit(null);
    setNaming(null);
    setNote(null);
    setFlash(null);
  };

  const pickName = (slot) => {
    const picked = naming.picked.includes(slot) ? naming.picked.filter((s) => s !== slot) : [...naming.picked, slot];
    if (picked.length < naming.need) {
      setNaming({ ...naming, picked });
      return;
    }
    const renamed = renameLast(match, commit, naming.kind === 'outs' ? { outs: picked } : { raider: slot });
    if (renamed) {
      const entry = liveRaids(renamed.state)[0];
      const queue = renamed.state.outQueue[naming.team];
      setNamedOut((prev) => prev.map((m, t) => (t !== naming.team ? m : {
        ...m, ...Object.fromEntries(picked.map((s) => [s, queue.find((o) => o.slotId === s)?.outEventId]).filter(([, id]) => id)),
      })));
      save(renamed);
      setCommit({ ...commit, id: entry.id, raider: naming.kind === 'raider' ? slot : commit.raider, named: true });
      setFlash(entry.id);
    }
    setNaming(null);
  };

  // One step back. A started raid is cancelled (no score change); otherwise the last raid is undone.
  const stepBack = () => {
    resetFollowUps();
    setNaming(null);
    setFlash(null);
    if (state.activeRaid) {
      const cancelled = cancelActiveRaid(match);
      if (cancelled) save(cancelled);
      setNote({ kind: 'undo', what: `raid ${state.raidNumber + 1} (cancelled)`, totals: view.totals });
      return;
    }
    const undone = lastAction(state);
    const next = undoMatch(match);
    save(next);
    setCommit(null);
    setNote(undone ? { kind: 'undo', what: undone.type === 'raid' ? `raid ${undone.raidNumber}` : 'technical point', totals: boardView(next, at).totals } : null);
  };

  const latest = lastAction(state);
  const justScored = commit && latest?.id === commit.id ? latest : null;
  const nameable = Boolean(justScored && namingFor(justScored, commit.before));
  const reopenNaming = () => { if (nameable) setNaming(namingFor(justScored, commit.before)); };

  const lastRaid = !state.activeRaid && latest?.type === 'raid' ? latest : null;
  const outsNamed = Boolean(commit?.named && lastRaid && commit.id === lastRaid.id);
  const flags = raidFlags(match, lastRaid, { outsNamed, namedOut });
  const known = lastRaid ? {
    back: (team, slots) => {
      if (!hasRoster(match, team)) return null;
      const wasNamed = (slot) => lastRaid.before.outQueue[team].find((o) => o.slotId === slot)?.outEventId === namedOut[team]?.[slot];
      return slots.every(wasNamed) ? slots.map((slot) => view.mat[team].onMat.find((p) => p.slot === slot)?.name).filter(Boolean) : null;
    },
  } : null;

  const halfWord = view.phase === 'finishReview' ? 'Full time' : view.phase === 'halfTime' ? 'Half time' : view.paused ? 'Paused' : view.half === 1 ? '1st half' : '2nd half';
  let last;
  if (state.activeRaid) {
    // do or die: the engine turns Empty into a lost raid; say so from its own preview of that key
    const emptyOutcome = tryRuling(state, rulings.empty, { atMs: at })?.outcome;
    last = {
      label: `Raid ${view.raidNumber} · ${state.teams[raiding].name} raiding`,
      text: emptyOutcome === 'doOrDieFailure' ? 'Do or die: Empty puts the raider out' : 'Tap what happened',
    };
  }
  else if (note?.kind === 'undo') last = { label: 'Undone', text: `Undid ${note.what} · ${note.totals.join('–')}` };
  else if (latest) {
    const guessed = !(commit && latest.id === commit.id && commit.named);
    last = { label: latest.type === 'raid' ? `Raid ${latest.raidNumber}` : 'Technical', text: readback(match, latest, { guessed, known: latest.type === 'raid' ? known : null }) };
  } else last = { label: 'First raid', text: `${state.teams[raiding].name} raid first` };
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
    return { team, entry, sub: entry ? readback(match, entry) : state.activeRaid ? 'Between raids only' : 'Not now' };
  });

  const stepBackOk = state.activeRaid ? canCancelRaid(state) : canUndo(state);

  return (
    <KabaddiRaidBoard
      title={title} subtitle={subtitle} colourStyle={colourStyle}
      view={view} names={state.teams.map((t) => t.name)} clock={mmss(view.remainingMs)} halfWord={halfWord} scoring={scoring}
      flags={flags} flashId={flash} quick={quick} bonus={bonus} picker={picker}
      showRaidBy={scoring && !quick && !view.raidActive}
      keyOk={{
        empty: !bonus && ok(rulings.empty), tackled: ok(rulings.tackled), one: ok(touch(1)), two: ok(touch(2)), three: ok(touch(3)),
        bonus: ok({ type: 'bonus', bonusBeforeContact: true }), bonusOnly: ok(rulings.bonusOnly),
      }}
      countOk={(n) => ok(touch(n))}
      naming={naming && { ...naming, chips: beforeView.mat[naming.team].onMat }}
      last={last} moment={note?.kind === 'moment' && !state.activeRaid ? note : null} nameable={nameable && !naming}
      rare={rare} technicals={technicals}
      canUndo={stepBackOk} undoHint={stepBackLabel(state)}
      onRaidBy={raidBy}
      onEmpty={() => score(rulings.empty)} onTackled={() => score(rulings.tackled)}
      onTouch={(n) => score(touch(n))} onBonusOnly={() => score(rulings.bonusOnly)}
      onBonus={() => { setPicker(false); setBonus((b) => !b); }}
      onPicker={() => setPicker((p) => !p)}
      onRare={(ruling) => score(ruling)} onTechnical={technical}
      onName={pickName} onSkipNames={() => setNaming(null)} onReopenNames={reopenNaming}
      onQuick={() => setQuick((q) => !q)}
      onUndo={stepBack}
      onClock={() => save(togglePause(match, at))}
      onStartHalf={() => save({ ...match, state: startHalf(state, { atMs: at }) })}
      onFinish={onFinish} onDiscard={onDiscard}
    />
  );
}

KabaddiRaid.propTypes = {
  initialMatch: PropTypes.object.isRequired,
  colourStyle: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  now: PropTypes.func,
  onSave: PropTypes.func,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};

/** Presentation only: every label, number and enabled state arrives as a prop. */
export function KabaddiRaidBoard({
  title, subtitle, colourStyle, view, names, clock, halfWord, scoring, flags, flashId, quick, bonus, picker, showRaidBy, keyOk, countOk,
  naming, last, moment, nameable, rare, technicals, canUndo: undoable, undoHint: hint, onRaidBy, onEmpty, onTackled, onTouch,
  onBonusOnly, onBonus, onPicker, onRare, onTechnical, onName, onSkipNames, onReopenNames, onQuick, onUndo, onClock, onStartHalf,
  onFinish, onDiscard,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const sheetId = useId();
  const style = useMemo(() => ({ ...colourStyle, ...sportIdentityVars('kabaddi') }), [colourStyle]);
  const off = !scoring;
  const close = (fn) => () => { fn(); setOptionsOpen(false); };
  const raider = view.raidingTeam;

  let slot = null;
  if (naming) {
    const outs = naming.kind === 'outs';
    slot = (
      <>
        <p className="ko-ask">
          <span>{outs ? `Who was out? ${names[naming.team]}` : `Who was tackled? ${names[naming.team]}`}</span>
          <button type="button" className="ko-skip" onClick={onSkipNames}>Skip</button>
        </p>
        <div className="kr-chips" role="group" aria-label={outs ? `${names[naming.team]} players out, in order` : `${names[naming.team]} raider`}>
          {naming.chips.map((p) => (
            <button key={p.slot} type="button" className="se-ctl kr-chip" aria-pressed={naming.picked.includes(p.slot)} onClick={() => onName(p.slot)}>
              {naming.picked.includes(p.slot) && <span className="ko-order">{naming.picked.indexOf(p.slot) + 1}</span>}
              <b>{p.name}</b>
            </button>
          ))}
        </div>
        <p className="kr-hint">
          {naming.need > 1
            ? `Tap in the order they left, ${naming.picked.length} of ${naming.need}. First out is first back.`
            : 'Tap the player who left. Skip keeps the raid as scored.'}
        </p>
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
    <div className="sb kb ko kr" style={style} data-team-board="">
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" onFinish={onFinish} />
      <KabaddiStrip view={view} names={names} clock={clock} halfWord={halfWord} scoring={scoring} flags={flags} flashId={flashId}
        momentTeam={moment?.team} onClock={onClock} />

      <div className="ko-pad">
        <div className={`ko-status${slot ? ' ko-status-ask' : ''}`}>
          {(!slot || naming) && (
            <button type="button" className={`ko-last${moment ? ' ko-last-moment' : ''}${view.raidActive ? ' kr-running' : ''}`} disabled={!nameable} onClick={onReopenNames}
              aria-live="polite" style={moment ? { '--kit-underline': `var(--team-${teamKey(moment.team)}-line)` } : undefined}>
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

        {showRaidBy ? (
          <button type="button" className={`se-ctl kr-raidby kr-raidby-${teamKey(raider)}`} aria-label={`Raid by ${names[raider]}`} onClick={onRaidBy}>
            <i className="kr-raidby-mark" aria-hidden="true" />
            <b>Raid by {names[raider]}</b>
            <small>Raid {view.raidNumber} · starts the 30 second clock</small>
          </button>
        ) : (
          <div className="ko-keys" role="group" aria-label="Score the raid">
            <button type="button" className="se-ctl ko-key" aria-pressed={bonus} disabled={off || (!bonus && !keyOk.bonus)} onClick={onBonus}>Bonus</button>
            <button type="button" className="se-ctl ko-key" disabled={off || !keyOk.two} onClick={() => onTouch(2)}>+2</button>
            <button type="button" className="se-ctl ko-key" aria-pressed={picker} disabled={off || !keyOk.three} onClick={onPicker}>3+</button>
            <button type="button" className="se-ctl ko-key ko-key-big" disabled={off || !keyOk.empty} onClick={onEmpty}>Empty</button>
            <button type="button" className="se-ctl ko-key ko-key-big" disabled={off || !keyOk.one} onClick={() => onTouch(1)}>+1</button>
            <button type="button" className="se-ctl ko-key ko-key-big" disabled={off || !keyOk.tackled} onClick={onTackled}>Tackled</button>
          </div>
        )}
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
          <button type="button" className="sb-row ko-row" role="switch" aria-checked={quick} onClick={onQuick}>
            <span>Quick scoring</span>
            <small>{quick ? 'On: no Raid by tap, no raid clock' : 'Off: tap Raid by first'}</small>
          </button>
          <button type="button" className="sb-row" disabled={!scoring} onClick={close(onClock)}>{view.paused ? 'Resume clock' : 'Pause clock'}</button>
        </BoardSheetGroup>
      </BoardOptionsSheet>
    </div>
  );
}

KabaddiRaidBoard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  colourStyle: PropTypes.object.isRequired,
  view: PropTypes.object.isRequired,
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  clock: PropTypes.string.isRequired,
  halfWord: PropTypes.string.isRequired,
  scoring: PropTypes.bool,
  flags: PropTypes.arrayOf(PropTypes.object).isRequired,
  flashId: PropTypes.string,
  quick: PropTypes.bool,
  bonus: PropTypes.bool,
  picker: PropTypes.bool,
  showRaidBy: PropTypes.bool,
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
  onRaidBy: PropTypes.func.isRequired,
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
  onQuick: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onClock: PropTypes.func.isRequired,
  onStartHalf: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};
