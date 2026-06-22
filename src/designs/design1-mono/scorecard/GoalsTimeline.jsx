import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { goalsState } from '../../../models/live/goals';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Scoring-events timeline for ANY goals/period sport (research §4.D football
// match-centre + rugby/kabaddi templates). One row per scoring event from
// `goalsState(events, config).timeline`, each carrying its period label, minute,
// team, signed value, sport subtype, and stored running totals. Supports +N rows
// — rugby `TRY +5 → 5-0`, kabaddi raid/tackle — by surfacing the event TYPE (only
// when it is not a plain "point") alongside the value. Newest-first toggle;
// lead-change rows flagged with ► + bold "Lead change".
//
// The lead-change flag is computed in chronological order (comparing each row's
// running lead sign against the previous decisive row), THEN the list is reversed
// for newest-first display. CSS-variable tokens only; numerics tabular.

function sign(n) {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/** Signs a value for display: rugby +5, an undo/correction -2, a zero 0. */
function signed(value) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

/**
 * Projects `goalsState().timeline` into self-describing display rows. Period
 * labels resolve from the line-score buckets (Q1.., P1.., or a single FINAL when
 * no periods config); the lead-change flag compares this row's running lead sign
 * against the previous decisive row's sign.
 */
function buildRows(events, config) {
  const { timeline, lineScore } = goalsState(events, config);
  const periodLabels = lineScore.periods.map((p) => p.label);
  const rows = [];
  let prevSign = 0;
  for (const entry of timeline) {
    const currentSign = sign(entry.runningA - entry.runningB);
    const leadChange = currentSign !== 0 && prevSign !== 0 && currentSign !== prevSign;
    rows.push({
      seq: entry.seq,
      minute: entry.minute,
      periodLabel: periodLabels[entry.periodIndex] ?? null,
      team: entry.team,
      value: entry.value,
      type: entry.type,
      runningA: entry.runningA,
      runningB: entry.runningB,
      leaderSide: currentSign === 0 ? null : currentSign > 0 ? 'A' : 'B',
      leadChange,
    });
    if (currentSign !== 0) prevSign = currentSign;
  }
  return rows;
}

export default function GoalsTimeline({ events, config, teamA, teamB, defaultNewestFirst }) {
  const [newestFirst, setNewestFirst] = useState(defaultNewestFirst);
  const rows = useMemo(() => buildRows(events, config), [events, config]);
  const ordered = newestFirst ? [...rows].reverse() : rows;

  return (
    <section aria-label="Goals timeline">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <p style={eyebrowStyle}>Timeline</p>
        <button
          type="button"
          onClick={() => setNewestFirst((value) => !value)}
          aria-pressed={newestFirst}
          className="font-mono cursor-pointer"
          style={{
            minHeight: 36,
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid color-mix(in oklch, var(--border) 22%, transparent)',
            borderRadius: 'var(--radius)',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
          }}
        >
          {newestFirst ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {ordered.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
          No scoring yet.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {ordered.map((row) => {
            const teamName = sideName(row.team, teamA, teamB) ?? row.team;
            const leaderName = sideName(row.leaderSide, teamA, teamB);
            const showType = row.type && row.type !== 'point';
            return (
              <li
                key={row.seq}
                data-lead-change={row.leadChange ? 'true' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)',
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--muted-foreground)',
                    whiteSpace: 'nowrap',
                    ...tabularNums,
                  }}
                >
                  {row.periodLabel ? `${row.periodLabel} ` : ''}
                  {row.minute}&#39;
                </span>
                <span
                  style={{ fontSize: '0.8125rem', color: 'var(--foreground)', flex: 1, minWidth: 0 }}
                >
                  <span style={{ fontWeight: 700 }}>{teamName}</span>
                  {showType && (
                    <span
                      className="font-mono"
                      style={{
                        marginLeft: 6,
                        fontSize: '0.625rem',
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      {row.type}
                    </span>
                  )}
                  <span className="font-mono" style={{ ...tabularNums }}>
                    {' '}
                    {signed(row.value)}
                  </span>
                  {row.leadChange && (
                    <span
                      className="font-mono"
                      style={{
                        marginLeft: 8,
                        fontSize: '0.625rem',
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--primary)',
                      }}
                    >
                      &#9658; Lead change
                    </span>
                  )}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    color: 'var(--foreground)',
                    ...tabularNums,
                  }}
                >
                  {row.runningA}-{row.runningB}
                </span>
                <span
                  style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', minWidth: 0 }}
                >
                  {leaderName ? `${leaderName} leads` : 'TIED'}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

GoalsTimeline.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  config: PropTypes.object,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
  defaultNewestFirst: PropTypes.bool,
};

GoalsTimeline.defaultProps = {
  config: undefined,
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
  defaultNewestFirst: true,
};
