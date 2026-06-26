import PropTypes from 'prop-types';
import { volleyballState } from '../../../models/live/volleyball';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Volleyball full-scorecard set-by-set matrix (research §4.A "VOLLEYBALL FULL
// SCORECARD", design §6.2 / L162). A compact table: TEAM | SET 1..SET 5 | SETS.
// Exactly two data rows (one per team). The set winner's cell gets a
// var(--primary) left-border + bold weight; the live (in-progress) set shows the
// current points; the SETS column is decisive (900-weight).
//
// EVERY value is derived from `volleyballState(events, config)` — completed-set
// scores, the live set's running points, and the sets-won totals. Team NAMES are
// static presentation labels resolved via `sideName`. CSS-variable tokens only;
// numerics are tabular so the columns stay aligned (a no-cap deuce 32-30 fits).

const SET_COUNT = 5; // bo5 grid; trailing sets render as an empty "—".

/** Builds the per-set cell descriptors for one side ('A' | 'B'). */
function buildCells(side, state) {
  const cells = [];
  for (let i = 0; i < SET_COUNT; i += 1) {
    const setNumber = i + 1;
    const completed = state.completedSets[i];
    if (completed) {
      const own = side === 'A' ? completed.a : completed.b;
      const other = side === 'A' ? completed.b : completed.a;
      cells.push({ key: setNumber, value: own, isWinner: own > other, isLive: false });
    } else if (setNumber === state.currentSet && !state.isMatchOver) {
      const own = side === 'A' ? state.pointsA : state.pointsB;
      cells.push({ key: setNumber, value: own, isWinner: false, isLive: true });
    } else {
      cells.push({ key: setNumber, value: null, isWinner: false, isLive: false });
    }
  }
  return cells;
}

/** One set cell — winner gets a var(--primary) left-border + bold. */
function SetCell({ value, isWinner, isLive }) {
  return (
    <td
      style={{
        padding: '8px 10px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: isWinner ? 800 : 500,
        color: 'var(--foreground)',
        borderLeft: isWinner ? '2px solid var(--primary)' : '2px solid transparent',
        textDecoration: isLive ? 'underline' : 'none',
        textUnderlineOffset: 3,
      }}
    >
      {value === null ? <span style={{ color: 'var(--muted-foreground)' }}>—</span> : value}
    </td>
  );
}

SetCell.propTypes = {
  value: PropTypes.number,
  isWinner: PropTypes.bool.isRequired,
  isLive: PropTypes.bool.isRequired,
};

SetCell.defaultProps = {
  value: null,
};

/** One team data row: name (winner of the match bolded), set cells, SETS total. */
function TeamRow({ name, cells, setsWon, isMatchWinner }) {
  return (
    <tr style={{ borderTop: '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)' }}>
      <th
        scope="row"
        style={{
          padding: '8px 10px',
          textAlign: 'left',
          fontWeight: isMatchWinner ? 800 : 600,
          color: 'var(--foreground)',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </th>
      {cells.map((cell) => (
        <SetCell key={cell.key} value={cell.value} isWinner={cell.isWinner} isLive={cell.isLive} />
      ))}
      <td
        className="font-mono"
        style={{
          padding: '8px 10px',
          textAlign: 'right',
          fontWeight: 900,
          color: 'var(--foreground)',
          ...tabularNums,
        }}
      >
        {setsWon}
      </td>
    </tr>
  );
}

TeamRow.propTypes = {
  name: PropTypes.string.isRequired,
  cells: PropTypes.arrayOf(PropTypes.object).isRequired,
  setsWon: PropTypes.number.isRequired,
  isMatchWinner: PropTypes.bool.isRequired,
};

export default function VolleyballMatrix({ events, config, teamA, teamB }) {
  const state = volleyballState(events, config);
  const nameA = sideName('A', teamA, teamB);
  const nameB = sideName('B', teamA, teamB);
  const cellsA = buildCells('A', state);
  const cellsB = buildCells('B', state);

  const headStyle = { ...eyebrowStyle, padding: '0 10px 8px', textAlign: 'right' };

  return (
    <section aria-label="Volleyball set-by-set matrix">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...eyebrowStyle, padding: '0 10px 8px', textAlign: 'left' }}>
              Team
            </th>
            {Array.from({ length: SET_COUNT }, (unused, i) => (
              <th key={i + 1} scope="col" style={headStyle}>
                {`Set ${i + 1}`}
              </th>
            ))}
            <th scope="col" style={headStyle}>
              Sets
            </th>
          </tr>
        </thead>
        <tbody>
          <TeamRow
            name={nameA}
            cells={cellsA}
            setsWon={state.setsA}
            isMatchWinner={state.winner === 'A'}
          />
          <TeamRow
            name={nameB}
            cells={cellsB}
            setsWon={state.setsB}
            isMatchWinner={state.winner === 'B'}
          />
        </tbody>
      </table>
    </section>
  );
}

VolleyballMatrix.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  config: PropTypes.object,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

VolleyballMatrix.defaultProps = {
  config: undefined,
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
