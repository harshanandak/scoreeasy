import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import './goalsBoard.css';

// Presentation only. Registry actions and scorer-owned clock/handlers let later goals sports
// opt in without duplicating the board or moving their rules into the view.
export default function TeamGoalsBoard({
  sportConfig, title, subtitle, colourStyle, halves, clock, clockLabel, status, isTimeUp, scoringLocked,
  lastLine, momentTeam, actionCount, canUndo, undoHint, isLive,
  onScore, onUndo, onSwap, onCorrect, onFinish, onDiscard, live, notice,
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const sheetId = useId();
  const actions = sportConfig.config.quickButtons;
  const hasActions = actions?.length > 0;
  const closeAnd = (action) => { action(); setOptionsOpen(false); };
  const contents = (h) => <>
    <span className="tgb-name">{h.name}</span>
    <span key={actionCount} aria-label={`${h.name} score`} className={`tgb-score${hasActions && momentTeam === h.team ? ' tgb-moment' : ''}`}>{h.score}</span>
  </>;

  return (
    <div className="sb tgb" data-team-board="" data-goals-board="" style={{ ...colourStyle, ...sportIdentityVars(sportConfig.id) }}>
      {notice}
      <BoardHeader title={title} subtitle={subtitle} sportColour="var(--sport-core)" isLive={isLive} onFinish={onFinish} />
      <div className="tgb-meta">
        <span className="tgb-sport"><i className="tgb-sport-mark" aria-hidden="true" />{sportConfig.name}</span>
        <span className="tgb-clock" aria-label={clockLabel}>{isTimeUp ? "Time's up!" : clock}</span>
        {status && <span className="tgb-status">{status}</span>}
      </div>
      <p className="tgb-last" aria-label="Last action" aria-live="polite">{lastLine}</p>
      <div className="tgb-keys">
        {halves.map((h) => hasActions ? (
          <div key={h.team} className={`tgb-team tgb-team-${h.key}`} data-team={h.key} role="group" aria-label={`Score for ${h.name}`}>
            <>
              {contents(h)}
              <div className="tgb-actions">
                {actions.map((action) => <button
                  type="button" key={action.label} disabled={scoringLocked}
                  aria-label={`Add ${action.label} for ${h.name}`}
                  onClick={() => onScore(h.team, action.value, action.label)}
                >{action.label}</button>)}
              </div>
            </>
          </div>
        ) : (
          <button key={h.team} type="button" data-team={h.key} data-action={actionCount % 2}
            className={`tgb-team tgb-team-${h.key} tgb-whole${momentTeam === h.team ? ' tgb-moment' : ''}`}
            disabled={scoringLocked} aria-label={`Add 1 to ${h.name}`}
            onClick={() => onScore(h.team, sportConfig.config.pointIncrement || 1)}>
            {contents(h)}<span>Tap +1</span>
          </button>
        ))}
      </div>
      <BoardBar canUndo={canUndo} undoHint={undoHint} onUndo={onUndo} sheetId={sheetId} sheetOpen={optionsOpen} onMore={() => setOptionsOpen(true)} />
      <BoardOptionsSheet id={sheetId} open={optionsOpen} onClose={() => setOptionsOpen(false)} live={live} onDiscard={onDiscard}>
        <BoardSheetGroup>
          <button type="button" className="sb-row" onClick={() => closeAnd(onSwap)}>Swap sides</button>
          {halves.map((h) => <button type="button" key={h.team} className="sb-row" aria-label={`Subtract one from ${h.name}`} onClick={() => closeAnd(() => onCorrect(h.team))}>
            <span>Correct {h.name}</span><span className="sb-row-aside">−1</span>
          </button>)}
        </BoardSheetGroup>
      </BoardOptionsSheet>
    </div>
  );
}

TeamGoalsBoard.propTypes = {
  sportConfig: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  colourStyle: PropTypes.object.isRequired,
  halves: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.oneOf(['a', 'b']).isRequired, team: PropTypes.number.isRequired, name: PropTypes.string.isRequired, score: PropTypes.number.isRequired })).isRequired,
  clock: PropTypes.string.isRequired,
  clockLabel: PropTypes.string.isRequired,
  status: PropTypes.string,
  isTimeUp: PropTypes.bool,
  scoringLocked: PropTypes.bool,
  lastLine: PropTypes.string.isRequired,
  momentTeam: PropTypes.number,
  actionCount: PropTypes.number.isRequired,
  canUndo: PropTypes.bool.isRequired,
  undoHint: PropTypes.string,
  isLive: PropTypes.bool,
  onScore: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onSwap: PropTypes.func.isRequired,
  onCorrect: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  live: PropTypes.node,
  notice: PropTypes.node,
};
