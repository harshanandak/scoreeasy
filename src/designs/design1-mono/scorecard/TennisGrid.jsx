import PropTypes from 'prop-types';
import { tennisState } from '../../../models/live/tennis';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Tennis full-scorecard set grid (research §4.B "FULL SCORECARD GRID", design §6.2).
// A compact table: rows = players, header ['', 'S1'..'S5', 'GM', 'PT']. Each set
// cell is the completed integer game count (tiebreak sets append a <sup> mini-
// score); the winner of a set is 800-weight, the loser 400. `GM` is the current-
// set live game count and `PT` the current-game point (15/30/40/AD or a tiebreak
// integer). The current set column is highlighted with bg var(--accent); the
// serving player's row is marked with a leading ball dot in the name cell.
//
// EVERY value is derived from `tennisState(events, config)`; team NAMES are static
// presentation labels resolved via `sideName`. CSS-variable tokens only (no
// hardcoded hex); numerics are tabular so the columns stay aligned.

const SET_COUNT = 5; // S1..S5 grid; unplayed sets render an empty "-".

/** One set cell — completed game count (+ optional tiebreak sup), winner bolded. */
function SetCell({ value, isWinner, tiebreak, isCurrent }) {
  return (
    <td
      style={{
        padding: '8px 10px',
        textAlign: 'right',
        fontWeight: isWinner ? 800 : 400,
        color: 'var(--foreground)',
        background: isCurrent ? 'var(--accent)' : 'transparent',
        ...tabularNums,
      }}
    >
      {value === null ? (
        <span style={{ color: 'var(--muted-foreground)' }}>-</span>
      ) : (
        <>
          {value}
          {tiebreak != null ? (
            <sup style={{ fontSize: '0.6em', verticalAlign: 'super', ...tabularNums }}>
              {tiebreak}
            </sup>
          ) : null}
        </>
      )}
    </td>
  );
}

SetCell.propTypes = {
  value: PropTypes.number,
  isWinner: PropTypes.bool.isRequired,
  tiebreak: PropTypes.number,
  isCurrent: PropTypes.bool.isRequired,
};

SetCell.defaultProps = {
  value: null,
  tiebreak: null,
};

/** Builds the per-set cell descriptors for one side ('A' | 'B'). */
function buildSetCells(side, state, currentSetIndex) {
  const cells = [];
  for (let i = 0; i < SET_COUNT; i += 1) {
    const set = state.sets[i];
    if (set) {
      const own = side === 'A' ? set.a : set.b;
      const other = side === 'A' ? set.b : set.a;
      const tb = side === 'A' ? set.tbA : set.tbB;
      cells.push({ key: i, value: own, isWinner: own > other, tiebreak: tb ?? null, isCurrent: false });
    } else {
      cells.push({
        key: i,
        value: null,
        isWinner: false,
        tiebreak: null,
        isCurrent: i === currentSetIndex && !state.isMatchOver,
      });
    }
  }
  return cells;
}

/** One player data row: name (server-dotted) → set cells → GM → PT. */
function PlayerRow({ name, cells, games, point, serving }) {
  return (
    <tr style={{ borderTop: '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)' }}>
      <th
        scope="row"
        style={{
          padding: '8px 10px',
          textAlign: 'left',
          fontWeight: 600,
          color: 'var(--foreground)',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden={!serving}
          aria-label={serving ? 'Serving' : undefined}
          role={serving ? 'img' : undefined}
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            marginRight: 8,
            borderRadius: '50%',
            background: serving ? 'var(--primary)' : 'transparent',
          }}
        />
        {name}
      </th>
      {cells.map((cell) => (
        <SetCell
          key={cell.key}
          value={cell.value}
          isWinner={cell.isWinner}
          tiebreak={cell.tiebreak}
          isCurrent={cell.isCurrent}
        />
      ))}
      <td
        className="font-mono"
        style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: 'var(--foreground)', ...tabularNums }}
      >
        {games}
      </td>
      <td
        className="font-mono"
        style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--foreground)', ...tabularNums }}
      >
        {point}
      </td>
    </tr>
  );
}

PlayerRow.propTypes = {
  name: PropTypes.string.isRequired,
  cells: PropTypes.arrayOf(PropTypes.object).isRequired,
  games: PropTypes.number.isRequired,
  point: PropTypes.string.isRequired,
  serving: PropTypes.bool.isRequired,
};

export default function TennisGrid({ events, config, teamA, teamB }) {
  const state = tennisState(events, config);
  const nameA = sideName('A', teamA, teamB);
  const nameB = sideName('B', teamA, teamB);
  const currentSetIndex = state.sets.length; // the live set is the next unplayed index
  const cellsA = buildSetCells('A', state, currentSetIndex);
  const cellsB = buildSetCells('B', state, currentSetIndex);

  const headStyle = { ...eyebrowStyle, padding: '0 10px 8px', textAlign: 'right' };

  return (
    <section aria-label="Tennis set grid">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...eyebrowStyle, padding: '0 10px 8px', textAlign: 'left' }}>
              {''}
            </th>
            {Array.from({ length: SET_COUNT }, (unused, i) => (
              <th key={i + 1} scope="col" style={headStyle}>
                {`S${i + 1}`}
              </th>
            ))}
            <th scope="col" style={headStyle}>
              GM
            </th>
            <th scope="col" style={headStyle}>
              PT
            </th>
          </tr>
        </thead>
        <tbody>
          <PlayerRow
            name={nameA}
            cells={cellsA}
            games={state.currentSet.gamesA}
            point={state.currentGame.labelA}
            serving={state.server === 'A'}
          />
          <PlayerRow
            name={nameB}
            cells={cellsB}
            games={state.currentSet.gamesB}
            point={state.currentGame.labelB}
            serving={state.server === 'B'}
          />
        </tbody>
      </table>
    </section>
  );
}

TennisGrid.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  config: PropTypes.object,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

TennisGrid.defaultProps = {
  config: undefined,
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
