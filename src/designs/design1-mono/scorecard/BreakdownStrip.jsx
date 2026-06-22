import PropTypes from 'prop-types';
import { goalsState } from '../../../models/live/goals';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Per-team scoring breakdown by event subtype (research §4.D rugby
// `TRIES | CONV | PEN | DG` and kabaddi `RAID | TACKLE`). Renders one labelled
// column group per team from `goalsState(events, config).breakdown`, which sums
// each event's `value` keyed by `meta.type`. Sport-agnostic: the columns are
// exactly whatever subtypes appear in the stream (so rugby, kabaddi, or a custom
// `+N` game all surface their own buckets with ZERO per-sport branching).
//
// Pure-type eyebrow labels over tabular values; CSS-variable tokens only.

/** Stable union of subtype keys across both teams, in first-seen order. */
function subtypeKeys(breakdown) {
  const keys = [];
  for (const side of ['A', 'B']) {
    for (const key of Object.keys(breakdown[side] ?? {})) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/** One labelled value cell: eyebrow whisper label above a tabular value. */
function Cell({ label, value }) {
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

Cell.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
};

/** One team's breakdown row: name then a value cell per subtype. */
function TeamBreakdown({ name, side, keys, breakdown }) {
  return (
    <div>
      <p style={{ ...eyebrowStyle, color: 'var(--foreground)', marginBottom: 6 }}>{name}</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${keys.length}, minmax(56px, 1fr))`,
          gap: '8px 16px',
        }}
      >
        {keys.map((key) => (
          <Cell key={`${side}-${key}`} label={key} value={breakdown[side]?.[key] ?? 0} />
        ))}
      </div>
    </div>
  );
}

TeamBreakdown.propTypes = {
  name: PropTypes.string.isRequired,
  side: PropTypes.oneOf(['A', 'B']).isRequired,
  keys: PropTypes.arrayOf(PropTypes.string).isRequired,
  breakdown: PropTypes.object.isRequired,
};

export default function BreakdownStrip({ events, config, teamA, teamB }) {
  const { breakdown } = goalsState(events, config);
  const keys = subtypeKeys(breakdown);

  if (keys.length === 0) return null;

  return (
    <section
      aria-label="Scoring breakdown"
      style={{
        display: 'grid',
        gap: 14,
        borderTop: '2px solid var(--foreground)',
        paddingTop: 12,
      }}
    >
      <TeamBreakdown
        name={sideName('A', teamA, teamB)}
        side="A"
        keys={keys}
        breakdown={breakdown}
      />
      <TeamBreakdown
        name={sideName('B', teamA, teamB)}
        side="B"
        keys={keys}
        breakdown={breakdown}
      />
    </section>
  );
}

BreakdownStrip.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  config: PropTypes.object,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

BreakdownStrip.defaultProps = {
  config: undefined,
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
