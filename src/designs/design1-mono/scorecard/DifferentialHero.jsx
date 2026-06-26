import PropTypes from 'prop-types';
import { differential } from '../../../models/live/scorecard';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Brutal differential hero (research §4.E "DIFFERENTIAL"). One hero object per
// screen: a hard 4px offset shadow in var(--primary), sharp 4px radius, black
// edge. The live margin is a big tabular "+N" and the leader name carries the
// only accent. Leader + value come solely from `differential(events)`; the name
// is a static presentation label resolved via `sideName`. On a tie / empty
// stream it renders a neutral "Tied" hero with a +0 differential.

export default function DifferentialHero({ events, teamA, teamB }) {
  const { leaderTeam, value } = differential(events);
  const leaderName = sideName(leaderTeam, teamA, teamB);

  return (
    <section
      aria-label="Differential"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--foreground)',
        borderRadius: 'var(--radius)',
        boxShadow: '4px 4px 0 var(--primary)',
        padding: '16px 18px',
      }}
    >
      <p style={eyebrowStyle}>Differential</p>
      <p
        className="font-mono"
        style={{
          margin: '4px 0 0',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          fontSize: '2.5rem',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: 'var(--foreground)',
          ...tabularNums,
        }}
      >
        <span style={{ color: leaderName ? 'var(--primary)' : 'var(--foreground)' }}>
          +{value}
        </span>
      </p>
      <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: 'var(--foreground)' }}>
        {leaderName ? (
          <>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{leaderName}</span>
            <span style={{ color: 'var(--muted-foreground)' }}> ahead</span>
          </>
        ) : (
          <span style={{ fontWeight: 800 }}>Tied</span>
        )}
      </p>
    </section>
  );
}

DifferentialHero.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

DifferentialHero.defaultProps = {
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
