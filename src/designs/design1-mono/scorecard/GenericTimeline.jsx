import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Running point-by-point timeline (research §4.E "RUNNING TIMELINE"). This is
// the documented exception: no scorecard.js selector returns per-row timeline
// data, so each row is mapped straight from the self-describing event — reading
// stored `runningA`/`runningB`, never re-summing. Per-row leader/TIED and the
// lead-change flag come from comparing this row's stored sign against the
// previous surviving row's sign.

function sign(n) {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function formatClock(at) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  const totalSeconds = Math.max(0, Math.floor(at / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Projects the raw event stream into self-describing timeline rows. Only scoring
 * `point` rows appear; each carries its stored running totals and a lead-change
 * flag computed against the previous point row's lead sign.
 */
function buildRows(events) {
  const rows = [];
  let prevSign = 0;
  for (const event of events) {
    if (event.type !== 'point') continue;
    const runningA = Number(event.runningA ?? 0);
    const runningB = Number(event.runningB ?? 0);
    const currentSign = sign(runningA - runningB);
    const leadChange = currentSign !== 0 && prevSign !== 0 && currentSign !== prevSign;
    rows.push({
      seq: Number(event.seq ?? rows.length + 1),
      team: event.team,
      value: Number(event.value ?? 0),
      runningA,
      runningB,
      leaderSide: currentSign === 0 ? null : currentSign > 0 ? 'A' : 'B',
      leadChange,
      at: typeof event.at === 'number' ? event.at : null,
    });
    if (currentSign !== 0) prevSign = currentSign;
  }
  return rows;
}

export default function GenericTimeline({ events, teamA, teamB, defaultNewestFirst }) {
  const [newestFirst, setNewestFirst] = useState(defaultNewestFirst);
  const rows = useMemo(() => buildRows(events), [events]);
  const ordered = newestFirst ? [...rows].reverse() : rows;

  return (
    <section aria-label="Running timeline">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
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
          No points yet.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {ordered.map((row) => {
            const teamName = sideName(row.team, teamA, teamB) ?? row.team;
            const leaderName = sideName(row.leaderSide, teamA, teamB);
            const clock = formatClock(row.at);
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
                {clock && (
                  <span className="font-mono" style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', ...tabularNums }}>
                    {clock}
                  </span>
                )}
                <span style={{ fontSize: '0.8125rem', color: 'var(--foreground)', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700 }}>{teamName}</span>
                  <span className="font-mono" style={{ ...tabularNums }}> +{row.value}</span>
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
                      ► Lead change
                    </span>
                  )}
                </span>
                <span className="font-mono" style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--foreground)', ...tabularNums }}>
                  {row.runningA}-{row.runningB}
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', minWidth: 0 }}>
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

GenericTimeline.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
  defaultNewestFirst: PropTypes.bool,
};

GenericTimeline.defaultProps = {
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
  defaultNewestFirst: true,
};
