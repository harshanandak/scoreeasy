import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AppScoringConfirmDialog } from '../components/AppScoringPrompt';
import './goalsPeriods.css';

export default function GoalsPeriodControls({ state, remaining, onAction, onFinish, locked = false, tied = false }) {
  const [confirm, setConfirm] = useState(false);
  const prompted = useRef(null);
  const zero = state.phase === 'playing' && remaining === 0;
  useEffect(() => {
    const key = `${state.periodIndex}:${state.durations.length}`;
    if (zero && prompted.current !== key) { prompted.current = key; setConfirm(true); }
    if (!zero) prompted.current = null;
  }, [zero, state.periodIndex, state.durations.length]);
  const last = state.periodIndex === state.durations.length - 1;
  const overtime = last && tied && (state.overtimeSeconds > 0 || state.extraDurations?.length > 0);
  const endLabel = state.sport === 'football' ? 'End half' : 'End quarter';
  return <div className="gp-controls">
    {state.phase === 'playing' ? <>
      <button type="button" disabled={locked} onClick={() => onAction(state.startedAt == null ? 'resume' : 'pause')}>{state.startedAt == null ? 'Resume clock' : 'Pause clock'}</button>
      <button type="button" disabled={locked} onClick={() => setConfirm(true)}>{endLabel}</button>
    </> : state.phase === 'interval' ? <>
      {!last && <button type="button" disabled={locked} onClick={() => onAction('startPeriod')}>Start next period</button>}
      {overtime && <button type="button" disabled={locked} onClick={() => onAction('overtime')}>Start extra time</button>}
      {last && (!tied || state.sport !== 'basketball' || state.endedEarly) && <button type="button" disabled={locked} onClick={onFinish}>Confirm full time</button>}
    </> : <span>Full-time</span>}
    {confirm && <AppScoringConfirmDialog title={zero ? "Time's up: end period?" : 'End this period?'}
      message={remaining > 0 ? 'This period is ending early. Finishing this match will record Abandoned / no result.' : 'Confirm the referee decision. The clock never ends a period automatically.'}
      cancelLabel="Keep scoring" confirmLabel="Confirm period end" onCancel={() => setConfirm(false)}
      onConfirm={() => { if (!locked) { setConfirm(false); onAction('endPeriod'); } }} />}

  </div>;
}
GoalsPeriodControls.propTypes = { state: PropTypes.object.isRequired, remaining: PropTypes.number.isRequired, onAction: PropTypes.func.isRequired, onFinish: PropTypes.func.isRequired, locked: PropTypes.bool, tied: PropTypes.bool };
