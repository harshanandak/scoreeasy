import PropTypes from 'prop-types';
import { segmentSummary } from '../../../models/live/scorecard';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Manufactured line-score table for ANY +1/+N game (research §4.E "SEGMENT
// SUMMARY"). Rendered like a basketball line score: TEAM | S1..Sn | TOTAL, with
// the winner's TOTAL green-filled. Bucketing + the human caption come straight
// from `segmentSummary(events, { segments })`.

export default function SegmentSummary({
  events,
  segments = 4,
  teamA = DEFAULT_TEAM_A,
  teamB = DEFAULT_TEAM_B,
}) {
  const { caption, rows } = segmentSummary(events, { segments });
  const segmentCount = rows[0]?.perSegment.length ?? 0;
  const totals = rows.map((row) => row.total);
  const maxTotal = Math.max(...totals);
  // A clear single leader gets the green TOTAL fill; an all-zero or tied table
  // has no winner to highlight.
  const hasWinner = maxTotal > 0 && totals.filter((t) => t === maxTotal).length === 1;

  const cellBase = {
    padding: '6px 10px',
    fontSize: '0.8125rem',
    textAlign: 'right',
    ...tabularNums,
  };
  const headCell = {
    ...cellBase,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--muted-foreground)',
  };

  return (
    <section aria-label="Segment summary">
      <table
        className="font-mono"
        style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--foreground)' }}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--foreground)' }}>
            <th scope="col" style={{ ...headCell, textAlign: 'left' }}>Team</th>
            {Array.from({ length: segmentCount }, (_, i) => (
              <th scope="col" key={`s${i + 1}`} style={headCell}>{`S${i + 1}`}</th>
            ))}
            <th scope="col" style={headCell}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = sideName(row.team, teamA, teamB) ?? row.team;
            const isWinner = hasWinner && row.total === maxTotal;
            return (
              <tr
                key={row.team}
                style={{ borderBottom: '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)' }}
              >
                <th
                  scope="row"
                  style={{
                    ...cellBase,
                    textAlign: 'left',
                    fontWeight: isWinner ? 800 : 600,
                  }}
                >
                  {name}
                </th>
                {row.perSegment.map((value, i) => (
                  <td key={`${row.team}-s${i + 1}`} style={cellBase}>{value}</td>
                ))}
                <td
                  style={{
                    ...cellBase,
                    fontWeight: 800,
                    background: isWinner ? 'var(--primary)' : 'transparent',
                    color: isWinner ? 'var(--primary-foreground)' : 'var(--foreground)',
                  }}
                >
                  {row.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ ...eyebrowStyle, marginTop: 8 }}>{caption}</p>
    </section>
  );
}

SegmentSummary.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  segments: PropTypes.number,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};
// Defaults live in the signature — React 18.3 deprecates defaultProps on
// function components.
