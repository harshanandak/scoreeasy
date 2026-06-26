import PropTypes from 'prop-types';
import { statHeader } from '../../../models/live/scorecard';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Broadcast-style stat line for ANY +1/+N game (research §4.E "STAT HEADER").
// Every value is derived purely from `statHeader(events)`; team NAMES are static
// presentation labels resolved via `sideName`. Pure-type, no boxes, under a 2px
// black rule, eyebrow labels weight 700 / tracking 0.08em.

/** One labelled stat cell: eyebrow whisper label above a tabular value. */
function StatCell({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={eyebrowStyle}>{label}</p>
      <p
        className="font-mono"
        style={{
          margin: '2px 0 0',
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: 'var(--foreground)',
          ...tabularNums,
        }}
      >
        {value}
      </p>
    </div>
  );
}

StatCell.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
};

export default function GenericStatHeader({ events, teamA, teamB }) {
  const {
    leader,
    margin,
    score,
    leadChanges,
    timesTied,
    largestLead,
    biggestRun,
    scoringRatePerMin,
    lastScore,
  } = statHeader(events);

  const leaderName = sideName(leader, teamA, teamB);
  const largestLeadName = sideName(largestLead.team, teamA, teamB);
  const runName = sideName(biggestRun.team, teamA, teamB);
  const lastScoreName = lastScore ? sideName(lastScore.team, teamA, teamB) : null;
  const rate = Math.round(scoringRatePerMin * 10) / 10;

  return (
    <section
      aria-label="Match stat header"
      style={{ borderTop: '2px solid var(--foreground)', paddingTop: 12 }}
    >
      {/* LEADER + MARGIN — leader name carries the only accent. */}
      <p style={eyebrowStyle}>Leader</p>
      <p style={{ margin: '2px 0 10px', fontSize: '1rem', color: 'var(--foreground)' }}>
        {leaderName ? (
          <>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{leaderName}</span>
            <span style={{ color: 'var(--muted-foreground)' }}> leads by </span>
            <span className="font-mono" style={{ fontWeight: 800, ...tabularNums }}>{margin}</span>
          </>
        ) : (
          <span style={{ fontWeight: 800 }}>Tied</span>
        )}
      </p>

      {/* Big tabular SCORE. */}
      <p style={eyebrowStyle}>Score</p>
      <p
        className="font-mono"
        style={{
          margin: '2px 0 12px',
          fontSize: '2rem',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: 'var(--foreground)',
          ...tabularNums,
        }}
      >
        {score.a}<span style={{ color: 'var(--muted-foreground)' }}>{' – '}</span>{score.b}
      </p>

      {/* Pure-type stat grid (no boxes). */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '10px 16px',
        }}
      >
        <StatCell label="Lead changes" value={leadChanges} />
        <StatCell label="Times tied" value={timesTied} />
        <StatCell
          label="Largest lead"
          value={largestLeadName ? `${largestLeadName} +${largestLead.value}` : '—'}
        />
        <StatCell
          label="Biggest run"
          value={runName ? `🔥 ${runName} ${biggestRun.len}-0` : '—'}
        />
        <StatCell label="Scoring rate" value={`${rate}/min`} />
        <StatCell
          label="Last score"
          value={lastScoreName ? `${lastScoreName} +${lastScore.value}` : '—'}
        />
      </div>
    </section>
  );
}

GenericStatHeader.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

GenericStatHeader.defaultProps = {
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
