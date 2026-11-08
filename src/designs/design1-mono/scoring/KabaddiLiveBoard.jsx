import { useEffect, useId, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import KabaddiScoreStrip from './KabaddiScoreStrip';
import { HandUnderline } from '../kit/KitParts';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import {
  beginLiveRaid, boardView, callDeadline, canCancelRaid, cancelLiveRaid, canUndo, confirmTechnical, draftOf, hasRoster, landRaid, lastAction, lastMark,
  liveRaids, markDefender, momentOf, namedOutMap, playerName, previewDraft, raidFlags, readback, reopenRaid, startNextHalf, toggleBonus,
  togglePause, touchCount, tryTechnical, undoLabel, undoMark, undoMatch,
} from '../../../utils/kabaddiBoardModel';
import './kabaddiOneTap.css';
import './kabaddiLive.css';

// Kabaddi scorer, round 5 (exploration k2, 2026-11-01): the raid happens live and points land when
// it ends. "Raid by <team>" starts the raid and its 30 s clock. While it runs the defending side's
// players are big tokens: tap one when the raider touches him, or switch to "Stepped out" and tap
// one who left the court; the Bonus cell marks the bonus line. Nothing is scored; the score cards
// only preview what the marks would do. The raid ends with one tap on the result (Back safe,
// Tackled, Raider out, or Empty when nothing was marked) and everything lands together. Undo
// takes back the last mark; after a raid has landed it reopens that raid with its marks. The marks
// live on the match draft (`match.draft`), so a refresh mid-raid keeps them. Every number, key
// state and word comes from the raid engine through kabaddiBoardModel; this view decides nothing
// about the rules.

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const teamKey = (team) => (team === 0 ? 'a' : 'b');

/** "Royals +3 · Strikers +1 · all out": what an engine record awards, in words. */
function effectLine(entry, names) {
  const total = [0, 1].map((team) => entry.effects.awards.filter((a) => a.team === team).reduce((sum, a) => sum + a.points, 0));
  const parts = [0, 1].filter((team) => total[team] > 0).map((team) => `${names[team]} +${total[team]}`);
  if (entry.effects.allOut.length) parts.push('all out');
  return parts.length ? parts.join(' · ') : 'No points';
}

export default function KabaddiLive({ initialMatch, colourStyle, title, subtitle, now = Date.now, onSave, onFinish, onDiscard, notice, broadcast }) {
  const [match, setMatch] = useState(initialMatch);
  const [raiderPick, setRaiderPick] = useState('');
  const [mode, setMode] = useState('touched'); // what a token tap marks: 'touched' or 'out' (stepped out of the court)
  const [, setLanded] = useState(null); // { raidId, startedAtMs, draft } of the raid that just landed, so Undo can reopen it
  const [note, setNote] = useState(null);
  const [flash, setFlash] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const at = Math.max(now(), match.state.clock?.anchorMonotonicMs ?? 0, match.state.activeRaid?.raidClock?.anchorMonotonicMs ?? 0);
  const view = boardView(match, at);
  const { state } = match;
  const raiding = view.raidingTeam;
  const defending = 1 - raiding;
  const scoring = ['ready', 'playing', 'halfPending', 'fullPending'].includes(view.phase);
  const names = state.teams.map((t) => t.name);
  const draft = draftOf(match);
  const live = Boolean(state.activeRaid);

  const save = (next) => {
    if (onSave?.(next) === false) return false;
    setMatch(next);
    return true;
  };

  const raidBy = () => {
    if (!scoring || live) return;
    if (!save(beginLiveRaid(match, { atMs: at, raider: raiderPick }))) return;
    setMode('touched');
    setRaiderPick('');
    setLanded(null);
    setNote(null);
    setFlash(null);
  };

  const mark = (slot) => save(markDefender(match, slot, mode));
  const bonus = () => save(toggleBonus(match));

  const land = (result) => {
    if (!draft) return;
    const startedAtMs = state.activeRaid.startedAtMs;
    const next = landRaid(match, result, { atMs: at });
    if (!next) return;
    const entry = liveRaids(next.state)[0];
    if (!save(next)) return;
    setLanded({ raidId: entry.id, startedAtMs, draft });
    setFlash(entry.id);
    const moment = momentOf(entry);
    setNote(moment ? { ...moment, kind: 'moment', totals: boardView(next, at).totals } : null);
  };

  const technical = (team) => {
    if (!scoring || !tryTechnical(state, team, { atMs: at })) return;
    save(confirmTechnical(match, team, { atMs: at }));
    setLanded(null);
    setNote(null);
    setFlash(null);
  };

  const latest = lastAction(state);
  const canReopen = Boolean(!live && latest?.type === 'raid' && latest.raidDraft && canUndo(state));

  // One step back: a live raid loses its last mark (then it is cancelled); a landed raid reopens
  // with its marks; anything older is undone as before.
  const stepBack = () => {
    setFlash(null);
    if (live) {
      if (lastMark(match)) save(undoMark(match));
      else {
        const cancelled = cancelLiveRaid(match);
        if (cancelled) save(cancelled);
        setNote({ kind: 'undo', what: `raid ${state.raidNumber + 1} (cancelled)`, totals: view.totals });
      }
      return;
    }
    if (canReopen) {
      const reopened = reopenRaid(match, { atMs: at });
      if (reopened) {
        save(reopened);
        setLanded(null);
        setNote(null);
        return;
      }
    }
    const undone = lastAction(state);
    const next = undoMatch(match);
    save(next);
    setLanded(null);
    setNote(undone ? { kind: 'undo', what: undone.type === 'raid' ? `raid ${undone.raidNumber}` : 'technical point', totals: boardView(next, at).totals } : null);
  };

  // ---- derived, all from the engine ----
  const markName = (m) => {
    if (m.bonus) return 'bonus';
    return `${playerName(match, defending, m.slot)} ${m.kind === 'touched' ? 'touched' : 'out of court'}`;
  };
  const prior = lastMark(match);
  let undoHint = '';
  let undoable;
  if (live) {
    undoHint = prior ? `Take back ${markName(prior)}` : `Cancel raid ${state.raidNumber + 1}`;
    undoable = Boolean(prior) || canCancelRaid(state);
  } else if (canReopen) {
    undoHint = `Reopen raid · ${undoLabel(state).split(' · ').at(-1)}`;
    undoable = canUndo(state);
  } else {
    undoHint = undoLabel(state);
    undoable = canUndo(state);
  }

  const marksOn = Boolean(draft && (draft.marks.length || draft.bonus));
  const preview = (result) => (live && scoring ? previewDraft(state, draft, result, { atMs: at }) : null);
  const safeEntry = preview('safe');
  const pending = marksOn && safeEntry ? {
    points: [0, 1].map((team) => safeEntry.effects.awards.filter((a) => a.team === team).reduce((sum, a) => sum + a.points, 0)),
    mat: safeEntry.after.mat.map((slots) => slots.length),
  } : null;
  const touchedCount = draft ? draft.marks.filter((m) => m.kind === 'touched').length : 0;
  const results = live ? [
    { key: 'safe', label: marksOn ? 'Back safe' : 'Empty', entry: safeEntry, tint: marksOn },
    { key: 'tackled', label: 'Tackled', entry: preview('tackled') },
    { key: 'raiderOut', label: 'Raider out', entry: preview('raiderOut') },
  ].map((r) => {
    let sub = r.entry ? effectLine(r.entry, names) : 'Not now';
    if (r.entry?.outcome === 'doOrDieFailure') sub = `Do or die: raider out · ${sub}`;
    if (r.key !== 'safe' && touchedCount && r.entry) sub += ` · ${touchedCount === 1 ? '1 touch' : `${touchedCount} touches`} not counted`;
    return { ...r, sub };
  }) : [];

  const namedOut = namedOutMap(state);
  const lastRaid = !live && latest?.type === 'raid' ? latest : null;
  const flags = raidFlags(match, lastRaid, { outsNamed: Boolean(lastRaid?.input.outsInOrder || lastRaid?.input.dismissals), namedOut, raiderNamed: false });
  const known = lastRaid ? {
    back: (team, slots) => {
      if (!hasRoster(match, team)) return null;
      const wasNamed = (slot) => lastRaid.before.outQueue[team].find((o) => o.slotId === slot)?.outEventId === namedOut[team][slot];
      return slots.every(wasNamed) ? slots.map((slot) => view.mat[team].players.find((p) => p.slot === slot)?.name).filter(Boolean) : null;
    },
  } : null;

  const halfWord = !view.timed ? view.progress : view.phase === 'finishReview' ? 'Full time' : view.phase === 'halfTime' ? 'Half time' : view.paused ? 'Paused' : view.half === 1 ? '1st half' : '2nd half';
  let last;
  if (note?.kind === 'undo') last = { label: 'Undone', text: `Undid ${note.what} · ${note.totals.join('–')}` };
  else if (latest) {
    // outs the scorer did not pick (an earlier raid, a raider who went out) stay counts, never guessed names
    const picked = latest.type === 'raid' && Boolean(latest.input.outsInOrder || latest.input.dismissals);
    last = { label: latest.type === 'raid' ? `Raid ${latest.raidNumber}` : 'Technical', text: readback(match, latest, { guessed: !picked, known: latest.type === 'raid' ? known : null, raiderNamed: false }) };
  } else last = { label: 'First raid', text: `${names[raiding]} raid first` };
  if (view.phase === 'finishReview') {
    const [a, b] = view.totals;
    last = { label: 'Full time', text: a === b ? `Draw ${a}–${b}` : `${names[a > b ? 0 : 1]} win by ${Math.abs(a - b)}` };
  }

  const technicals = [0, 1].map((team) => {
    const entry = scoring ? tryTechnical(state, team, { atMs: at }) : null;
    return { team, entry, sub: entry ? readback(match, entry) : live ? 'Between raids only' : 'Not now' };
  });

  const tokens = live ? view.mat[defending].players.map((p) => {
    const m = draft?.marks.findIndex((x) => x.slot === p.slot) ?? -1;
    return { ...p, label: hasRoster(match, defending) ? p.name : p.name.replace(/^Player /, ''), mark: m >= 0 ? draft.marks[m].kind : null, order: m >= 0 ? m + 1 : null };
  }) : [];

  return (
    <KabaddiLiveBoard
      title={title} subtitle={subtitle} colourStyle={colourStyle}
      view={view} names={names} clock={mmss(view.remainingMs)} halfWord={halfWord} scoring={scoring}
      flags={flags} flashId={flash} pending={pending} live={live} mode={mode}
      showRaidBy={['ready', 'playing'].includes(view.phase) && !live}
      tokens={tokens} defending={defending} hasRoster={hasRoster(match, defending)}
      bonus={{ on: Boolean(draft?.bonus), ok: Boolean(state.activeRaid?.bonusEligibleAtStart) }}
      results={results}
      last={last} moment={note?.kind === 'moment' && !live ? note : null} reopenable={canReopen}
      technicals={state.rules.technical === 'off' ? [] : technicals}
      canUndo={undoable} undoHint={undoHint}
      onRaidBy={raidBy} onMode={setMode} onMark={mark} onBonus={bonus} onResult={land} onTechnical={technical}
      raiderPick={raiderPick} onRaiderPick={setRaiderPick} raiderOptions={hasRoster(match, raiding) ? view.mat[raiding].onMat : []}
      onTimeUp={() => save(callDeadline(match, at))}
      onCount={(count) => {
        const marked = touchCount(match, count);
        const next = landRaid(marked, 'safe', { atMs: at });
        if (next && save(next)) { setNote(null); setFlash(liveRaids(next.state)[0].id); }
      }}
      notice={notice} broadcast={broadcast}
      onUndo={stepBack}
      onClock={() => save(togglePause(match, at))}
      onStartHalf={() => save(startNextHalf(match, at))}
      onFinish={onFinish} onDiscard={onDiscard}
    />
  );
}

KabaddiLive.propTypes = {
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
export function KabaddiLiveBoard({
  title, subtitle, colourStyle, view, names, clock, halfWord, scoring, flags, flashId, pending, live, mode, showRaidBy, tokens, defending,
  hasRoster: named, bonus, results, last, moment, reopenable, technicals, canUndo: undoable, undoHint: hint, onRaidBy, onMode, onMark,
  onBonus, onResult, onTechnical, onUndo, onClock, onStartHalf, onFinish, onDiscard, onCount, notice, broadcast, onTimeUp, raiderPick, onRaiderPick, raiderOptions,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [moreCounts, setMoreCounts] = useState(false);
  const sheetId = useId();
  const style = useMemo(() => ({ ...colourStyle, ...sportIdentityVars('kabaddi') }), [colourStyle]);
  const raider = view.raidingTeam;
  const close = (fn) => () => { fn(); setOptionsOpen(false); };

  return (
    <div className="sb kb ko kl" style={style} data-team-board="">
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" onFinish={onFinish} />
      {notice}
      <KabaddiScoreStrip view={view} names={names} clock={clock} halfWord={halfWord} scoring={scoring} flags={flags} flashId={flashId}
        momentTeam={moment?.team} pending={pending} onClock={onClock} />

      <div className="ko-pad">
        {live ? (
          <div className={`kl-live kl-def-${teamKey(defending)} kl-rd-${teamKey(raider)}`}>
            <p className="kl-hint">{mode === 'out' ? `Tap each ${names[defending]} player who stepped out of the court` : `Tap each ${names[defending]} player the raider touches`}</p>
            <div className="kl-tools">
            <div className="kit-seg kl-mode" role="group" aria-label="What a tap on a player marks">
              <button type="button" aria-pressed={mode === 'touched'} onClick={() => onMode('touched')}>Touched</button>
              <button type="button" disabled={view.rules.boundary === 'none'} aria-pressed={mode === 'out'} onClick={() => onMode('out')}>Stepped out</button>
            </div>
            {!named && <div className={`kit-seg kl-counts${moreCounts ? ' kl-counts-more' : ''}`} role="group" aria-label="Quick touch count">
              {(moreCounts ? tokens.filter(p => p.on).map((_, i) => i + 1).filter(n => n >= 3) : [1, 2]).map(n => <button key={n} type="button" disabled={n > tokens.filter(p => p.on).length} onClick={() => { onCount(n); setMoreCounts(false); }}>+{n}</button>)}
              <button type="button" disabled={tokens.filter(p => p.on).length < 3} onClick={() => setMoreCounts(v => !v)}>{moreCounts ? '1 / 2' : '3+'}</button>
            </div>}
            </div>
            <div className="kl-tokens" role="group" aria-label={`${names[defending]} on the mat`}>
              {tokens.map((p) => (
                <button key={p.slot} type="button" className={`se-ctl kl-token${p.mark ? ` kl-token-${p.mark}` : ''}${p.on ? '' : ' kl-token-gone'}${named ? '' : ' kl-token-num'}`}
                  disabled={!p.on} aria-pressed={Boolean(p.mark)} onClick={() => onMark(p.slot)}
                  aria-label={`${p.name}${p.mark === 'touched' ? ', touched' : p.mark === 'out' ? ', stepped out of the court' : p.on ? '' : ', already out'}`}>
                  {p.order && <span className="kl-order">{p.order}</span>}
                  <b>{p.label}</b>
                  {p.mark === 'out' && <small>↗ out</small>}
                  {!p.on && <small>off</small>}
                </button>
              ))}
              {view.rules.bonus.enabled && <button type="button" className="se-ctl kl-token kl-bonus" aria-label="Bonus line crossed" aria-pressed={bonus.on} disabled={!bonus.ok && !bonus.on} onClick={onBonus}>
                <b>Bonus</b>
                <small>{bonus.ok || bonus.on ? 'line crossed' : 'not this raid'}</small>
              </button>}
            </div>
            <div className="kl-results" role="group" aria-label="How the raid ended">
              {results.map((r) => (
                <button key={r.key} type="button" className={`se-ctl kl-result kl-result-${r.key}${r.key === 'safe' && !r.tint ? ' kl-result-idle' : ''}`} disabled={!scoring || !r.entry} onClick={() => onResult(r.key)}>
                  <b>{r.label}</b>
                  <small>{r.sub}</small>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="ko-status">
              <button type="button" className={`ko-last${moment ? ' ko-last-moment' : ''}`} disabled aria-live="polite"
                style={moment ? { '--kit-underline': `var(--team-${teamKey(moment.team)}-line)` } : undefined}>
                <small>{last.label}{reopenable ? ' · Undo reopens it' : ''}</small>
                <span>
                  {moment
                    ? <><HandUnderline>{moment.word}</HandUnderline>{` · ${names[moment.team]} +${moment.points} · ${moment.totals.join('–')}`}</>
                    : last.text}
                </span>
              </button>
            </div>
            {view.phase === 'finishReview' && <div className="ko-go"><button type="button" className="se-go" onClick={onFinish}>Finish match</button></div>}
            {view.phase === 'halfTime' && <div className="ko-go"><button type="button" className="se-go" onClick={onStartHalf}>Start 2nd half</button></div>}
            {showRaidBy && raiderOptions.length > 0 && <label className="kl-raider-select">Raider (optional)
              <select aria-label="Raider" value={raiderPick} onChange={e => onRaiderPick(e.target.value)}>
                <option value="">Not named</option>{raiderOptions.map(p => <option key={p.slot} value={p.slot}>{p.name}</option>)}
              </select>
            </label>}
            {showRaidBy && (
              <button type="button" className={`se-ctl kl-raidby kl-raidby-${teamKey(raider)}`} aria-label={`Raid by ${names[raider]}`} onClick={onRaidBy}>
                <b>Raid by {names[raider]}</b>
                <small>Raid {view.raidNumber}{view.raidTotalMs === null ? ' - mark what happens' : ` - starts the ${Math.round(view.raidTotalMs / 1000)} second clock`}</small>
              </button>
            )}
          </>
        )}
      </div>

      {broadcast}
      <BoardBar canUndo={undoable} undoHint={hint} onUndo={onUndo} sheetId={sheetId} sheetOpen={optionsOpen} onMore={() => setOptionsOpen(true)} />
      <BoardOptionsSheet id={sheetId} open={optionsOpen} onClose={() => setOptionsOpen(false)} onDiscard={onDiscard}>
        {technicals.length > 0 && <p className="sb-sheet-note">Technical points score at once; Undo puts them back.</p>}
        <BoardSheetGroup>
          {technicals.map((t) => (
            <button key={t.team} type="button" className="sb-row ko-row" disabled={!t.entry} onClick={close(() => onTechnical(t.team))}>
              <span>Technical point to {names[t.team]}</span><small>{t.sub}</small>
            </button>
          ))}
        </BoardSheetGroup>
        <BoardSheetGroup>
          {view.timed && <button type="button" className="sb-row" disabled={view.phase !== 'playing'} onClick={close(onTimeUp)}>{view.half === 1 ? 'Call half time' : 'Call full time'}</button>}
          {view.timed && <button type="button" className="sb-row" disabled={!scoring} onClick={close(onClock)}>{view.paused ? 'Resume clock' : 'Pause clock'}</button>}
        </BoardSheetGroup>
      </BoardOptionsSheet>
    </div>
  );
}

KabaddiLiveBoard.propTypes = {
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
  pending: PropTypes.object,
  live: PropTypes.bool,
  mode: PropTypes.string,
  showRaidBy: PropTypes.bool,
  tokens: PropTypes.array.isRequired,
  defending: PropTypes.number.isRequired,
  hasRoster: PropTypes.bool,
  bonus: PropTypes.shape({ on: PropTypes.bool, ok: PropTypes.bool }).isRequired,
  results: PropTypes.array.isRequired,
  last: PropTypes.object.isRequired,
  moment: PropTypes.object,
  reopenable: PropTypes.bool,
  technicals: PropTypes.array.isRequired,
  canUndo: PropTypes.bool.isRequired,
  undoHint: PropTypes.string,
  onRaidBy: PropTypes.func.isRequired,
  onMode: PropTypes.func.isRequired,
  onMark: PropTypes.func.isRequired,
  onBonus: PropTypes.func.isRequired,
  onResult: PropTypes.func.isRequired,
  onTechnical: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onClock: PropTypes.func.isRequired,
  onStartHalf: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};
