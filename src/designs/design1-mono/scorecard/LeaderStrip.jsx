import PropTypes from 'prop-types';
import { leaderStrip } from '../../../models/live/scorecard';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { tabularNums } from './scorecardStyles';

// Proportional leader strip (research §4.E "LEADER"): two segments sized by each
// team's share of total points; the leader segment is filled var(--primary) with
// white text; the margin sits centred between them. Shares + leader + margin all
// come from `leaderStrip(events)`.

function Segment({ name, share, isLeader, align }) {
  const pct = `${Math.round(share * 100)}%`;
  return (
    <div
      style={{
        flexGrow: Math.max(share, 0.0001),
        flexBasis: 0,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align,
        padding: '6px 10px',
        background: isLeader ? 'var(--primary)' : 'var(--card)',
        color: isLeader ? 'var(--primary-foreground)' : 'var(--foreground)',
        fontSize: '0.75rem',
        fontWeight: isLeader ? 800 : 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name} <span className="font-mono" style={tabularNums}>{pct}</span>
      </span>
    </div>
  );
}

Segment.propTypes = {
  name: PropTypes.string.isRequired,
  share: PropTypes.number.isRequired,
  isLeader: PropTypes.bool.isRequired,
  align: PropTypes.string.isRequired,
};

export default function LeaderStrip({ events, teamA, teamB }) {
  const { leaderTeam, aShare, bShare, margin } = leaderStrip(events);
  const nameA = sideName('A', teamA, teamB);
  const nameB = sideName('B', teamA, teamB);
  const leaderName = sideName(leaderTeam, teamA, teamB);

  return (
    <section aria-label="Leader strip">
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          border: '1px solid var(--foreground)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        <Segment name={nameA} share={aShare} isLeader={leaderTeam === 'A'} align="flex-start" />
        <Segment name={nameB} share={bShare} isLeader={leaderTeam === 'B'} align="flex-end" />
      </div>
      <p
        className="font-mono"
        style={{
          margin: '6px 0 0',
          textAlign: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--muted-foreground)',
          ...tabularNums,
        }}
      >
        {leaderName ? `${leaderName} +${margin}` : 'Tied'}
      </p>
    </section>
  );
}

LeaderStrip.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

LeaderStrip.defaultProps = {
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
