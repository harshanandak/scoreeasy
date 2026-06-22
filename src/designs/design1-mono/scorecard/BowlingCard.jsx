import PropTypes from 'prop-types';
import { buildBowlingCard } from '../../../models/live/cricket';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Cricket bowling card (research §4.C "BOWLING CARD", design §6.5). One row per
// bowler. Columns: BOWLER · O · M · R · W · ECON (numerics right, tabular). An
// optional trailing `(2w 1nb)` micro-note under the name when the bowler bowled any
// wides / no-balls.
//
// EVERY figure is derived from `buildBowlingCard(deliveries)` — overs (via
// `ballsToOvers`), maidens, runs conceded (wides/no-balls count; byes/leg-byes do
// NOT), wickets credited (bowled/caught/lbw/stumped/hit-wicket, NOT run-out), and
// economy (via `calculateRunRate`). The component only formats and resolves NAMES
// through the `players` id→name map (raw id fallback). CSS-variable tokens only;
// numerics tabular.

/** Resolve a player id to a display name; fall back to the raw id. */
function nameOf(players, id) {
  if (id == null) return '';
  return (players && players[id]) || id;
}

/** Economy display: two decimals, or a dash when the bowler bowled no legal ball. */
function economyText(economy) {
  return economy == null ? '-' : economy.toFixed(2);
}

/** Trailing `(Nw Mnb)` micro-note, or null when the bowler bowled no extras. */
function extrasNote(row) {
  const parts = [];
  if (row.wides) parts.push(`${row.wides}w`);
  if (row.noballs) parts.push(`${row.noballs}nb`);
  return parts.length ? `(${parts.join(' ')})` : null;
}

const NUM_COL = {
  padding: '8px 8px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--foreground)',
  width: 48,
};

/** One numeric cell in a bowler row. */
function NumCell({ children, emphasis }) {
  return (
    <td className="font-mono" style={{ ...NUM_COL, fontWeight: emphasis ? 700 : 500 }}>
      {children}
    </td>
  );
}

NumCell.propTypes = {
  children: PropTypes.node.isRequired,
  emphasis: PropTypes.bool,
};

NumCell.defaultProps = {
  emphasis: false,
};

export default function BowlingCard({ deliveries, players }) {
  const rows = buildBowlingCard(deliveries);
  const headStyle = { ...eyebrowStyle, padding: '0 8px 8px', textAlign: 'right' };

  return (
    <section aria-label="Bowling card">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...eyebrowStyle, padding: '0 8px 8px', textAlign: 'left' }}>
              Bowler
            </th>
            <th scope="col" style={headStyle}>O</th>
            <th scope="col" style={headStyle}>M</th>
            <th scope="col" style={headStyle}>R</th>
            <th scope="col" style={headStyle}>W</th>
            <th scope="col" style={headStyle}>Econ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const note = extrasNote(row);
            return (
              <tr
                key={row.bowlerId}
                style={{
                  borderTop:
                    '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)',
                }}
              >
                <th scope="row" style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 400 }}>
                  <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    {nameOf(players, row.bowlerId)}
                  </span>
                  {note ? (
                    <span
                      className="font-mono"
                      style={{
                        display: 'block',
                        marginTop: 2,
                        fontSize: '0.75rem',
                        color: 'var(--muted-foreground)',
                        ...tabularNums,
                      }}
                    >
                      {note}
                    </span>
                  ) : null}
                </th>
                <NumCell>{row.overs}</NumCell>
                <NumCell>{row.maidens}</NumCell>
                <NumCell>{row.runs}</NumCell>
                <NumCell emphasis>{row.wickets}</NumCell>
                <NumCell>{economyText(row.economy)}</NumCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

BowlingCard.propTypes = {
  deliveries: PropTypes.arrayOf(PropTypes.object).isRequired,
  players: PropTypes.object,
};

BowlingCard.defaultProps = {
  players: undefined,
};
