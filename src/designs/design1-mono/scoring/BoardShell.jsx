import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './boardShell.css';

// The scorer chrome every sport's board shares (Kit plan 2026-10-22, F0): the header (title,
// optional sport dot, Live, Finish), the bottom thumb bar (Undo with where it goes back to, and
// More), and the options sheet with Discard in its own group. A board renders these inside a root
// with the `sb` class and puts its own sport-specific surface (point keys, run pad, ...) between
// the header and the bar. Presentational only: every label and handler comes from the scorer that
// owns the rules, so the chrome can't disagree with the match state.

/** Header: title + subtitle, an optional sport dot, Live (only while shared live) and Finish. */
export function BoardHeader({ title, subtitle, sportColour, isLive, onFinish }) {
  return (
    <header className="sb-top">
      <div className="sb-title">
        <b>{title}</b>
        {subtitle && (
          <small>
            {sportColour && <i className="sb-sport-dot" style={{ '--sb-sport': sportColour }} aria-hidden="true" />}
            {subtitle}
          </small>
        )}
      </div>
      {isLive && <span className="sb-live">Live</span>}
      <button type="button" className="se-ctl sb-finish" onClick={onFinish}>Finish</button>
    </header>
  );
}

BoardHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  // The sport's identity colour (a CSS colour or var()); the dot is never the only cue.
  sportColour: PropTypes.string,
  isLive: PropTypes.bool,
  onFinish: PropTypes.func.isRequired,
};

/** Bottom thumb bar: Undo is always visible (disabled, dashed, when there is nothing to undo). */
export function BoardBar({ canUndo, undoHint, onUndo, sheetId, sheetOpen, onMore }) {
  return (
    <div className="sb-bar">
      <button type="button" className="se-ctl sb-undo" onClick={onUndo} disabled={!canUndo} aria-label="Undo last action">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-2" />
        </svg>
        <span className="sb-undo-t">Undo</span>
        <span className="sb-undo-w">{canUndo ? undoHint : 'Nothing to undo'}</span>
      </button>
      <button
        type="button"
        className="se-ctl sb-more"
        aria-label="Match options"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        aria-controls={sheetId}
        onClick={onMore}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /></svg>
      </button>
    </div>
  );
}

BoardBar.propTypes = {
  canUndo: PropTypes.bool.isRequired,
  undoHint: PropTypes.string,
  onUndo: PropTypes.func.isRequired,
  sheetId: PropTypes.string.isRequired,
  sheetOpen: PropTypes.bool.isRequired,
  onMore: PropTypes.func.isRequired,
};

/** A hairline group of rows inside the options sheet. */
export function BoardSheetGroup({ children }) {
  return <div className="sb-sheet-group">{children}</div>;
}

BoardSheetGroup.propTypes = { children: PropTypes.node };

/**
 * Options sheet. The board passes its sport-specific content (completed sets, swap, corrections)
 * as children; Discard always sits last, in its own group, in danger ink.
 */
export function BoardOptionsSheet({ id, open, onClose, live, onDiscard, children }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Kept mounted while closed (hidden) so the live-sharing bar inside keeps running.
  return (
    <div className="sb-sheet-layer" hidden={!open}>
      <button type="button" className="sb-scrim" aria-label="Close match options" tabIndex={-1} onClick={onClose} />
      <div id={id} className="sb-sheet" role="dialog" aria-modal="true" aria-label="Match options">
        <div className="sb-sheet-head">
          <b>Match options</b>
          <button ref={closeRef} type="button" className="se-ctl sb-sheet-close" onClick={onClose}>Done</button>
        </div>
        {live && <div className="sb-sheet-live">{live}</div>}
        {children}
        <BoardSheetGroup>
          <button type="button" className="sb-row sb-row-danger" onClick={() => { onClose(); onDiscard(); }}>Discard match</button>
        </BoardSheetGroup>
      </div>
    </div>
  );
}

BoardOptionsSheet.propTypes = {
  id: PropTypes.string.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  live: PropTypes.node,
  onDiscard: PropTypes.func.isRequired,
  children: PropTypes.node,
};
