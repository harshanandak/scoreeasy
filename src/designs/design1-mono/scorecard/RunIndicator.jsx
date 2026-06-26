import PropTypes from 'prop-types';
import { currentRun } from '../../../models/live/scorecard';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { tabularNums } from './scorecardStyles';

// "🔥 {TEAM} {len}-0 RUN" pill (research §4.E "RUN"). The run team + length come
// solely from `currentRun(events)`; the name is a static label. Renders nothing
// when there is no active run (empty stream / tie reset).

export default function RunIndicator({ events, teamA, teamB }) {
  const { team, len } = currentRun(events);
  const name = sideName(team, teamA, teamB);

  if (!name || len <= 0) return null;

  return (
    <span
      className="font-mono"
      role="status"
      aria-label={`${name} on a ${len} point run`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--primary)',
        background: 'var(--accent)',
        color: 'var(--accent-foreground)',
        fontSize: '0.75rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        ...tabularNums,
      }}
    >
      <span aria-hidden="true">🔥</span>
      {`${name} ${len}-0 run`}
    </span>
  );
}

RunIndicator.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

RunIndicator.defaultProps = {
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
