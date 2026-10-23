import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import './teamBoard.css';

// Team-colour scorer for sets sports: "Refined Soft with Mono-strength controls" (Harsha,
// 2026-10-21). Calm neutral chrome and sentence-case type around two bold team-colour gradient
// keys; the controls you press (Finish, Undo, More) keep Mono's hard ink edge and offset shadow.
// The chrome is the shared board shell (BoardShell.jsx); this file adds what a two-key sets board
// needs: the status line, the two point keys, the sport mark and the completed-set chips.
// Presentational only: every number, label and handler comes from the scorer that owns the rules
// (MonoQuickMatch), so the board can't disagree with the match state.
// Layout is thumb-first: status at the top, the two point keys in the middle, Undo and the options
// sheet in the bottom thumb zone. Team colour is the engine's --team-{a,b}-* variables (colourStyle).
// The sport's mark (--sport-mark, when the sport has one) sits on the serving team's key only, so
// the decoration names the game and carries the serve instead of being wallpaper.

export default function TeamSetsBoard({
  title,
  subtitle,
  sportColour,
  setUnit = 'Set',
  isLive,
  colourStyle,
  halves,
  meta,
  pointCue,
  setHistory,
  lastLine,
  canUndo,
  undoHint,
  onUndo,
  onPoint,
  onSwap,
  onCorrect,
  onDiscard,
  onFinish,
  live,
  notice,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const sheetId = useId();
  const hasMark = Boolean(colourStyle['--sport-mark']);

  return (
    <div className="sb tsb" style={colourStyle} data-team-board="">
      {notice}
      <BoardHeader title={title} subtitle={subtitle} sportColour={sportColour} isLive={isLive} onFinish={onFinish} />

      <p className="tsb-meta">
        {meta.map((m) => <span key={m} className="tsb-meta-item">{m}</span>)}
        {pointCue && <span className="tsb-point-cue" role="status">{pointCue}</span>}
      </p>

      <p className="tsb-last" aria-live="polite">{lastLine}</p>

      <div className="tsb-keys">
        {halves.map((h, i) => (
          <button
            key={h.team}
            type="button"
            className={`tsb-key tsb-key-${h.key}`}
            data-team={h.key}
            data-side={i === 0 ? 'left' : 'right'}
            onClick={() => onPoint(h.team)}
            aria-label={`Add point for ${h.name}`}
          >
            {hasMark && h.serving && <span className="tsb-mark" aria-hidden="true" />}
            {h.serving && <span className="tsb-srv">Serving</span>}
            <span className="tsb-who">{h.name}</span>
            <span className="tsb-big">{h.score}</span>
            <span className="tsb-word">Tap +1</span>
          </button>
        ))}
      </div>

      <BoardBar
        canUndo={canUndo}
        undoHint={undoHint}
        onUndo={onUndo}
        sheetId={sheetId}
        sheetOpen={optionsOpen}
        onMore={() => setOptionsOpen(true)}
      />

      <BoardOptionsSheet
        id={sheetId}
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        live={live}
        onDiscard={onDiscard}
      >
        {setHistory.length > 0 && (
          <div className="tsb-sets" aria-label={`Completed ${setUnit.toLowerCase()}s`}>
            {setHistory.map((s) => (
              <span key={s.label} className={`tsb-set tsb-win-${s.winnerKey}`}>
                {s.label} <b>{s.left}&ndash;{s.right}</b>
                <span className="sr-only">, {s.winnerName} won</span>
              </span>
            ))}
          </div>
        )}
        <BoardSheetGroup>
          <button type="button" className="sb-row" onClick={() => { onSwap(); setOptionsOpen(false); }}>Swap sides</button>
          {halves.map((h) => (
            <button
              key={h.team}
              type="button"
              className="sb-row"
              aria-label={`Subtract one from ${h.name}`}
              onClick={() => onCorrect(h.team)}
            >
              <span>Correct {h.name}</span>
              <span className="sb-row-aside">&minus;1</span>
            </button>
          ))}
        </BoardSheetGroup>
      </BoardOptionsSheet>
    </div>
  );
}

const half = PropTypes.shape({
  key: PropTypes.oneOf(['a', 'b']).isRequired,
  team: PropTypes.oneOf([1, 2]).isRequired,
  name: PropTypes.string.isRequired,
  score: PropTypes.number.isRequired,
  serving: PropTypes.bool,
});

TeamSetsBoard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  sportColour: PropTypes.string,
  setUnit: PropTypes.string,
  isLive: PropTypes.bool,
  colourStyle: PropTypes.object.isRequired,
  halves: PropTypes.arrayOf(half).isRequired,
  meta: PropTypes.arrayOf(PropTypes.string).isRequired,
  pointCue: PropTypes.string,
  setHistory: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    left: PropTypes.number.isRequired,
    right: PropTypes.number.isRequired,
    winnerKey: PropTypes.oneOf(['a', 'b']).isRequired,
    winnerName: PropTypes.string.isRequired,
  })).isRequired,
  lastLine: PropTypes.string.isRequired,
  canUndo: PropTypes.bool.isRequired,
  undoHint: PropTypes.string,
  onUndo: PropTypes.func.isRequired,
  onPoint: PropTypes.func.isRequired,
  onSwap: PropTypes.func.isRequired,
  onCorrect: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  live: PropTypes.node,
  notice: PropTypes.node,
};
