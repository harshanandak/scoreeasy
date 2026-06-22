import PropTypes from 'prop-types';
import { goalsState } from '../../../models/live/goals';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Period-by-period LINE SCORE table for ANY goals/period sport (research §4.D
// "LINE SCORE table"). Header `TEAM | P1..Pn | FINAL`; exactly two body rows
// (one per side). Each period cell = points that team scored in that period
// bucket; FINAL is bold and decisive. The winner's FINAL cell is green-filled
// (var(--primary) + white text). 2px black rule under the header; t.divider row
// rules; numerics tabular so a 32-30 deuce or a rugby +5 column stays aligned.
//
// EVERY value comes from `goalsState(events, config).lineScore` — per-period
// team totals, the FINAL totals, and the period LABELS (Q1..Q4, P1.., or a
// single FINAL bucket when no periods config is supplied). Team NAMES are static
// presentation labels resolved via `sideName`. CSS-variable tokens only.

const cellBase = {
  padding: '8px 10px',
  fontSize: '0.8125rem',
  textAlign: 'right',
  ...tabularNums,
};

const headCell = {
  ...eyebrowStyle,
  padding: '0 10px 8px',
  textAlign: 'right',
};

/** One team data row: name (match winner bolded), period cells, FINAL total. */
function TeamRow({ name, cells, final, isWinner, finalLabel }) {
  return (
    <tr style={{ borderTop: '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)' }}>
      <th
        scope="row"
        style={{
          ...cellBase,
          textAlign: 'left',
          fontWeight: isWinner ? 800 : 600,
          color: 'var(--foreground)',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </th>
      {cells.map((cell) => (
        <td key={cell.label} style={{ ...cellBase, color: 'var(--foreground)' }}>
          {cell.value}
        </td>
      ))}
      <td
        className="font-mono"
        data-winner={isWinner ? 'true' : undefined}
        aria-label={`${name} final ${final}`}
        title={finalLabel}
        style={{
          ...cellBase,
          fontWeight: 900,
          background: isWinner ? 'var(--primary)' : 'transparent',
          color: isWinner ? 'var(--primary-foreground)' : 'var(--foreground)',
        }}
      >
        {final}
      </td>
    </tr>
  );
}

TeamRow.propTypes = {
  name: PropTypes.string.isRequired,
  cells: PropTypes.arrayOf(PropTypes.object).isRequired,
  final: PropTypes.number.isRequired,
  isWinner: PropTypes.bool.isRequired,
  finalLabel: PropTypes.string.isRequired,
};

export default function LineScore({ events, config, teamA, teamB }) {
  const { lineScore } = goalsState(events, config);
  const { periods, totalA, totalB, segmentedBy } = lineScore;

  // A whole-match bucket equals FINAL itself — render FINAL alone (no duplicate
  // column). Period / count buckets get their own labelled columns.
  const columns = segmentedBy === 'whole' ? [] : periods;

  const nameA = sideName('A', teamA, teamB);
  const nameB = sideName('B', teamA, teamB);
  const cellsA = columns.map((p) => ({ label: p.label, value: p.a }));
  const cellsB = columns.map((p) => ({ label: p.label, value: p.b }));

  // A clear single leader gets the green FINAL fill; a tie or an all-zero table
  // has no winner to highlight.
  const decided = totalA !== totalB && Math.max(totalA, totalB) > 0;
  const aWins = decided && totalA > totalB;
  const bWins = decided && totalB > totalA;

  return (
    <section aria-label="Line score">
      <table
        className="font-mono"
        style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--foreground)' }}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--foreground)' }}>
            <th scope="col" style={{ ...headCell, textAlign: 'left' }}>
              Team
            </th>
            {columns.map((p) => (
              <th scope="col" key={p.label} style={headCell}>
                {p.label}
              </th>
            ))}
            <th scope="col" style={headCell}>
              Final
            </th>
          </tr>
        </thead>
        <tbody>
          <TeamRow name={nameA} cells={cellsA} final={totalA} isWinner={aWins} finalLabel="Final" />
          <TeamRow name={nameB} cells={cellsB} final={totalB} isWinner={bWins} finalLabel="Final" />
        </tbody>
      </table>
    </section>
  );
}

LineScore.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  config: PropTypes.object,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

LineScore.defaultProps = {
  config: undefined,
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
