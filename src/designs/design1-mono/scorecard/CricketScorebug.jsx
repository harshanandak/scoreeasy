import PropTypes from 'prop-types';
import {
  inningsTotals,
  thisOverTokens,
  buildBattingCard,
  buildBowlingCard,
  requiredRunRate,
} from '../../../models/live/cricket';
import { ballsToOvers, calculateRunRate } from '../../../utils/cricketCalculations';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Cricket live scorebug (research §4.C "LIVE SCOREBUG", design §6.5). Five stacked
// lines, ALL derived purely from the per-ball `deliveries` log via cricket.js:
//   1. hero  `${runs}/${wickets} (${overs})`            → 145/3 (18.2)
//   2. rates `CRR 7.84`  + in a chase `RRR 9.20` / `Need 56 off 38`
//   3. THIS OVER token strip — 4/6 green, W in a black pill
//   4. two batter chips `<name> <runs>(<balls>)` with a green * dot on strike
//   5. bowler chip `<name> <w>-<r> (<overs>)`             → Bumrah 2-31 (4.0)
//
// Totals come from `inningsTotals`; tokens from `thisOverTokens`; batter/bowler
// figures from `buildBattingCard`/`buildBowlingCard`; the chase ask from
// `requiredRunRate`. CRR reuses `calculateRunRate` (runs over legal balls) — never
// reinvented. Player NAMES resolve through the `players` id→name map (raw id as the
// fallback), the cricket equivalent of `sideName`. CSS-variable tokens only;
// numerics tabular. The on-strike / bowler identity is READ from the most recent
// delivery (the scorer's authoritative ids) — never inferred from aggregates.

/** Resolve a player id to a display name; fall back to the raw id. */
function nameOf(players, id) {
  if (id == null) return '';
  return (players && players[id]) || id;
}

/** The most-recent delivery (highest seq) — the live striker/bowler context. */
function lastDelivery(deliveries) {
  let latest = null;
  for (const d of deliveries || []) {
    if (latest === null || (d.seq ?? 0) >= (latest.seq ?? 0)) latest = d;
  }
  return latest;
}

/** A two-decimal rate string, or an em dash when the rate is undefined. */
function rate(value) {
  return value == null ? '—' : value.toFixed(2);
}

/** One THIS OVER token. 4/6 go green; W rides in a black pill; rest are plain. */
function OverToken({ token }) {
  const isBoundary = token === '4' || token === '6';
  const isWicket = token === 'W';
  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        height: 22,
        padding: '0 6px',
        borderRadius: isWicket ? 11 : 'var(--radius)',
        fontSize: '0.8125rem',
        fontWeight: 800,
        background: isWicket ? 'var(--foreground)' : 'transparent',
        color: isWicket
          ? 'var(--primary-foreground)'
          : isBoundary
            ? 'var(--primary)'
            : 'var(--foreground)',
        ...tabularNums,
      }}
    >
      {token}
    </span>
  );
}

OverToken.propTypes = {
  token: PropTypes.string.isRequired,
};

/** A batter chip — `<name> <runs>(<balls>)` with a green * dot when on strike. */
function BatterChip({ name, runs, balls, onStrike }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        fontSize: '0.8125rem',
        fontWeight: onStrike ? 800 : 600,
        color: 'var(--foreground)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      {onStrike ? (
        <span
          role="img"
          aria-label="On strike"
          style={{ color: 'var(--primary)', fontWeight: 900 }}
        >
          *
        </span>
      ) : null}
      <span className="font-mono" style={tabularNums}>
        {runs}({balls})
      </span>
    </span>
  );
}

BatterChip.propTypes = {
  name: PropTypes.string.isRequired,
  runs: PropTypes.number.isRequired,
  balls: PropTypes.number.isRequired,
  onStrike: PropTypes.bool.isRequired,
};

export default function CricketScorebug({ deliveries, target, ballsRemaining, players }) {
  const totals = inningsTotals(deliveries);
  const overs = ballsToOvers(totals.legalBalls);
  const crr = totals.legalBalls > 0 ? calculateRunRate(totals.runs, totals.legalBalls) : null;

  const last = lastDelivery(deliveries);
  const tokens = thisOverTokens(deliveries);

  const battingCard = buildBattingCard(deliveries);
  const bowlingCard = buildBowlingCard(deliveries);
  const byId = (card, id) => card.find((r) => (r.batterId ?? r.bowlerId) === id) || null;

  // Striker / non-striker / bowler identity is read from the live delivery's ids.
  const strikerId = last ? last.strikerId : null;
  const nonStrikerId = last ? last.nonStrikerId : null;
  const bowlerId = last ? last.bowlerId : null;

  const strikerRow = strikerId ? byId(battingCard, strikerId) : null;
  const nonStrikerRow = nonStrikerId ? byId(battingCard, nonStrikerId) : null;
  const bowlerRow = bowlerId ? byId(bowlingCard, bowlerId) : null;

  // Chase line: only when a target is supplied. `requiredRunRate` owns the math.
  const isChase = typeof target === 'number';
  const rrr = isChase
    ? requiredRunRate({ target, runs: totals.runs, ballsRemaining: ballsRemaining || 0 })
    : null;
  const need = isChase ? Math.max(0, target - totals.runs) : 0;
  const rrrBeatsCrr = rrr != null && crr != null && rrr <= crr;

  return (
    <section
      aria-label="Cricket scorebug"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
        background: 'var(--card)',
        border: '1px solid var(--foreground)',
        borderRadius: 'var(--radius)',
      }}
    >
      {/* Line 1 — hero score/wickets (overs). */}
      <p
        className="font-mono"
        style={{
          margin: 0,
          fontSize: '2.25rem',
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: 'var(--foreground)',
          ...tabularNums,
        }}
      >
        {totals.runs}
        <span style={{ color: 'var(--muted-foreground)' }}>/</span>
        {totals.wickets}
        <span style={{ marginLeft: 8, fontSize: '0.5em', color: 'var(--muted-foreground)' }}>
          ({overs})
        </span>
      </p>

      {/* Line 2 — run rates; chase ask on the right. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          fontSize: '0.8125rem',
          ...tabularNums,
        }}
      >
        <span className="font-mono" style={{ color: 'var(--muted-foreground)', fontWeight: 700 }}>
          CRR {rate(crr)}
        </span>
        {isChase ? (
          <span
            className="font-mono"
            style={{
              fontWeight: 700,
              textAlign: 'right',
              color: rrrBeatsCrr ? 'var(--primary)' : 'var(--foreground)',
            }}
          >
            RRR {rate(rrr)}
            <span style={{ color: 'var(--muted-foreground)' }}>
              {' · '}Need {need} off {ballsRemaining || 0}
            </span>
          </span>
        ) : null}
      </div>

      {/* Line 3 — THIS OVER token strip. */}
      <div>
        <p style={eyebrowStyle}>This over</p>
        <div
          role="list"
          aria-label="This over"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}
        >
          {tokens.length === 0 ? (
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>—</span>
          ) : (
            tokens.map((token, i) => (
              <span role="listitem" key={i}>
                <OverToken token={token} />
              </span>
            ))
          )}
        </div>
      </div>

      {/* Line 4 — two batter chips. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {strikerRow ? (
          <BatterChip
            name={nameOf(players, strikerId)}
            runs={strikerRow.runs}
            balls={strikerRow.balls}
            onStrike
          />
        ) : null}
        {nonStrikerRow ? (
          <BatterChip
            name={nameOf(players, nonStrikerId)}
            runs={nonStrikerRow.runs}
            balls={nonStrikerRow.balls}
            onStrike={false}
          />
        ) : null}
      </div>

      {/* Line 5 — bowler chip. */}
      {bowlerRow ? (
        <p
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--foreground)',
          }}
        >
          {nameOf(players, bowlerId)}{' '}
          <span className="font-mono" style={tabularNums}>
            {bowlerRow.wickets}-{bowlerRow.runs} ({bowlerRow.overs})
          </span>
        </p>
      ) : null}
    </section>
  );
}

CricketScorebug.propTypes = {
  deliveries: PropTypes.arrayOf(PropTypes.object).isRequired,
  target: PropTypes.number,
  ballsRemaining: PropTypes.number,
  players: PropTypes.object,
};

CricketScorebug.defaultProps = {
  target: undefined,
  ballsRemaining: undefined,
  players: undefined,
};
