import PropTypes from 'prop-types';
import { buildBattingCard } from '../../../models/live/cricket';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Cricket batting card (research §4.C "BATTING CARD", design §6.5). One row per
// batter who appears as striker OR non-striker. Columns: NAME · R · B · 4s · 6s · SR
// (numerics right, tabular, fixed widths). Each row: line 1 = name (800 + green dot
// when on strike, 800 when not-out), line 2 = muted dismissal phrase.
//
// EVERY figure is derived from `buildBattingCard(deliveries)` — runs/balls/4s/6s/SR
// and the dismissal record. The component only FORMATS: it turns the structured
// `{kind, bowlerId, fielderId}` into `c Smith b Bumrah`, `lbw b Shami`,
// `run out (Jadeja)`, `b Starc`, `st Pant b Chahal`, or `not out`, and renders SR as
// `(R/B*100).toFixed(2)` (a `-` when no ball faced). Player NAMES resolve through the
// `players` id→name map (raw id fallback). CSS-variable tokens only; numerics tabular.

/** Resolve a player id to a display name; fall back to the raw id. */
function nameOf(players, id) {
  if (id == null) return '';
  return (players && players[id]) || id;
}

/**
 * Build the full dismissal phrase from a structured dismissal record. Mirrors the
 * official-scorecard vocabulary; bowler-credited kinds name the bowler, catches and
 * stumpings name the fielder, run-outs name the fielder in parentheses only.
 */
function dismissalText(dismissal, players) {
  if (!dismissal) return 'not out';
  const bowler = nameOf(players, dismissal.bowlerId);
  const fielder = dismissal.fielderId ? nameOf(players, dismissal.fielderId) : null;
  switch (dismissal.kind) {
    case 'bowled':
      return `b ${bowler}`;
    case 'lbw':
      return `lbw b ${bowler}`;
    case 'hitwicket':
      return `hit wicket b ${bowler}`;
    case 'caught':
      return fielder ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`;
    case 'stumped':
      return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case 'runout':
    case 'run out':
      return fielder ? `run out (${fielder})` : 'run out';
    default:
      return dismissal.kind;
  }
}

/** Strike rate display: two decimals, or a dash when no ball was faced. */
function strikeRateText(strikeRate) {
  return strikeRate == null ? '-' : strikeRate.toFixed(2);
}

const NUM_COL = {
  padding: '8px 8px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--foreground)',
  width: 48,
};

/** One numeric cell in a batter row. */
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

export default function BattingCard({ deliveries, players, strikerId }) {
  const rows = buildBattingCard(deliveries);
  const headStyle = { ...eyebrowStyle, padding: '0 8px 8px', textAlign: 'right' };

  return (
    <section aria-label="Batting card">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...eyebrowStyle, padding: '0 8px 8px', textAlign: 'left' }}>
              Batter
            </th>
            <th scope="col" style={headStyle}>R</th>
            <th scope="col" style={headStyle}>B</th>
            <th scope="col" style={headStyle}>4s</th>
            <th scope="col" style={headStyle}>6s</th>
            <th scope="col" style={headStyle}>SR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = nameOf(players, row.batterId);
            const onStrike = strikerId != null && row.batterId === strikerId && !row.out;
            const notOut = !row.out;
            const highlight = notOut || onStrike;
            return (
              <tr
                key={row.batterId}
                style={{
                  borderTop:
                    '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)',
                }}
              >
                <th scope="row" style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 400 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 4,
                      fontWeight: highlight ? 800 : 600,
                      color: 'var(--foreground)',
                    }}
                  >
                    {name}
                    {onStrike ? (
                      <span
                        role="img"
                        aria-label="On strike"
                        style={{ color: 'var(--primary)', fontWeight: 900 }}
                      >
                        *
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 2,
                      fontSize: '0.75rem',
                      fontWeight: notOut ? 700 : 400,
                      color: notOut ? 'var(--primary)' : 'var(--muted-foreground)',
                    }}
                  >
                    {dismissalText(row.dismissal, players)}
                  </span>
                </th>
                <NumCell emphasis={highlight}>{row.runs}</NumCell>
                <NumCell>{row.balls}</NumCell>
                <NumCell>{row.fours}</NumCell>
                <NumCell>{row.sixes}</NumCell>
                <NumCell>{strikeRateText(row.strikeRate)}</NumCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

BattingCard.propTypes = {
  deliveries: PropTypes.arrayOf(PropTypes.object).isRequired,
  players: PropTypes.object,
  strikerId: PropTypes.string,
};

BattingCard.defaultProps = {
  players: undefined,
  strikerId: undefined,
};
