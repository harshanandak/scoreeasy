import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './teamBoard.css';

// Team-colour scorer for sets sports ("B · Mono hard shell", picked by Harsha 2026-10-21 from three
// rendered options). Presentational only: every number, label and handler comes from the scorer that
// owns the rules (MonoQuickMatch), so the board can't disagree with the match state.
// Layout is thumb-first: status at the top, the two point keys in the middle, Undo and the options
// sheet in the bottom thumb zone. Team colour is the engine's --team-{a,b}-* variables (colourStyle).

function OptionsSheet({ id, open, onClose, halves, setHistory, onSwap, onCorrect, onDiscard, live }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Kept mounted while closed (hidden) so the live-sharing bar inside keeps running.
  return (
    <div className="tsb-sheet-layer" hidden={!open}>
      <button type="button" className="tsb-scrim" aria-label="Close match options" tabIndex={-1} onClick={onClose} />
      <div id={id} className="tsb-sheet" role="dialog" aria-modal="true" aria-label="Match options">
        <div className="tsb-sheet-head">
          <b>Match options</b>
          <button ref={closeRef} type="button" className="tsb-btn tsb-sheet-close" onClick={onClose}>Done</button>
        </div>
        {live && <div className="tsb-sheet-live">{live}</div>}
        {setHistory.length > 0 && (
          <div className="tsb-sets" aria-label="Completed sets">
            {setHistory.map((s) => (
              <span key={s.label} className={`tsb-set tsb-win-${s.winnerKey}`}>
                {s.label} <b>{s.left}&ndash;{s.right}</b>
                <span className="sr-only">, {s.winnerName} won</span>
              </span>
            ))}
          </div>
        )}
        <div className="tsb-sheet-group">
          <button type="button" className="tsb-row" onClick={() => { onSwap(); onClose(); }}>Swap sides</button>
          {halves.map((h) => (
            <button
              key={h.team}
              type="button"
              className="tsb-row"
              aria-label={`Subtract one from ${h.name}`}
              onClick={() => onCorrect(h.team)}
            >
              <span>Correct {h.name}</span>
              <span className="tsb-row-aside">&minus;1</span>
            </button>
          ))}
        </div>
        <div className="tsb-sheet-group">
          <button type="button" className="tsb-row tsb-row-danger" onClick={() => { onClose(); onDiscard(); }}>Discard match</button>
        </div>
      </div>
    </div>
  );
}

OptionsSheet.propTypes = {
  id: PropTypes.string.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  halves: PropTypes.array.isRequired,
  setHistory: PropTypes.array.isRequired,
  onSwap: PropTypes.func.isRequired,
  onCorrect: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  live: PropTypes.node,
};

export default function TeamSetsBoard({
  title,
  subtitle,
  isLive,
  colourStyle,
  halves,
  chips,
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

  return (
    <div className="tsb" style={colourStyle} data-team-board="">
      {notice}
      <header className="tsb-top">
        <div className="tsb-title">
          <b>{title}</b>
          {subtitle && <small>{subtitle}</small>}
        </div>
        <button type="button" className="tsb-btn tsb-finish" onClick={onFinish}>Finish</button>
      </header>

      <div className="tsb-chips">
        {isLive && <span className="tsb-chip tsb-chip-live">Live</span>}
        {chips.map((c) => <span key={c} className="tsb-chip">{c}</span>)}
      </div>

      <p className="tsb-last" aria-live="polite">{lastLine}</p>

      <div className="tsb-keys">
        {halves.map((h) => (
          <button
            key={h.team}
            type="button"
            className={`tsb-key tsb-key-${h.key}`}
            data-team={h.key}
            onClick={() => onPoint(h.team)}
            aria-label={`Add point for ${h.name}`}
          >
            {h.serving && <span className="tsb-srvtag">&#9679; Serving</span>}
            <span className="tsb-who">{h.name}</span>
            <span className="tsb-big">{h.score}</span>
            <span className="tsb-word">Tap +1</span>
          </button>
        ))}
      </div>

      <div className="tsb-bar">
        <button type="button" className="tsb-btn tsb-undo" onClick={onUndo} disabled={!canUndo} aria-label="Undo last action">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-2" />
          </svg>
          <span className="tsb-undo-t">Undo</span>
          <span className="tsb-undo-w">{canUndo ? undoHint : 'nothing yet'}</span>
        </button>
        <button
          type="button"
          className="tsb-btn tsb-more"
          aria-label="Match options"
          aria-haspopup="dialog"
          aria-expanded={optionsOpen}
          aria-controls={sheetId}
          onClick={() => setOptionsOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /></svg>
        </button>
      </div>

      <OptionsSheet
        id={sheetId}
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        halves={halves}
        setHistory={setHistory}
        onSwap={onSwap}
        onCorrect={onCorrect}
        onDiscard={onDiscard}
        live={live}
      />
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
  isLive: PropTypes.bool,
  colourStyle: PropTypes.object.isRequired,
  halves: PropTypes.arrayOf(half).isRequired,
  chips: PropTypes.arrayOf(PropTypes.string).isRequired,
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
