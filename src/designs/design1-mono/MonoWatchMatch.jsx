// PUBLIC spectator page for /live/:token — no sign-in required.
//
// ── EGRESS / CACHING-EFFICIENT SPLIT-QUERY CONTRACT ────────────────────────
// The ONLY per-point reactive surface is the tiny denormalized snapshot:
//   useQuery(api.live.getByToken, { token })   → re-runs each point, but Convex
//   caches the result so fan-out to many spectators is cheap. It drives the
//   pinned scorebug (score / sets / serve / period / LIVE-PAUSED-FINAL).
// Team & player NAMES come from a SEPARATE read-once query:
//   useQuery(api.live.getMeta, { token })       → changes ~never (effectively
//   read-once); names are deliberately kept OFF the hot snapshot path.
// The event log is loaded ON DEMAND and paginated — never read whole, never
// reactive into the scorebug:
//   usePaginatedQuery(api.live.listEvents, { token }, { initialNumItems: 30 })
// (api.live.eventsSince exists and is bounded, but the paginated feed is
// preferred.) Feed + Scorecard + Stats all read from this one paginated result.
// ───────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, usePaginatedQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import VolleyballScorebug from './scorecard/VolleyballScorebug';
import TennisScorebug from './scorecard/TennisScorebug';
import LineScore from './scorecard/LineScore';
import GenericStatHeader from './scorecard/GenericStatHeader';
import GenericTimeline from './scorecard/GenericTimeline';
import { tabularNums, eyebrowStyle } from './scorecard/scorecardStyles';
import ReportMatch from './live/ReportMatch';

// A live match with no event in this window reads as PAUSED / DELAY (research
// §2 "Stale / paused"). 90s mirrors the spec.
const STALE_MS = 90000;

const TABS = ['Feed', 'Scorecard', 'Stats'];

/** Format an absolute epoch-ms timestamp as a short wall clock (HH:MM). */
function formatClock(at) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return '';
  const d = new Date(at);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Winner label from the snapshot: sets are primary, points break ties only. */
function winnerName(snapshot, nameA, nameB) {
  if (snapshot.setsA !== snapshot.setsB) {
    return snapshot.setsA > snapshot.setsB ? nameA : nameB;
  }
  if (snapshot.pointsA !== snapshot.pointsB) {
    return snapshot.pointsA > snapshot.pointsB ? nameA : nameB;
  }
  return null;
}

/** Live-pulse dot — solid green when live; dimmed + static when stale/final. */
function PulseDot({ dim }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: dim ? 'var(--muted-foreground)' : 'var(--primary)',
      }}
    />
  );
}

PulseDot.propTypes = {
  dim: PropTypes.bool.isRequired,
};

/**
 * Pinned scorebug — driven ENTIRELY by the snapshot (correct current state)
 * plus names from getMeta. Deliberately NOT a per-sport scorebug: those
 * recompute from the full event log, which the egress contract keeps off this
 * reactive path. Sticky, var(--card), 2px bottom rule, no shadow (chrome gets
 * hairlines, not shadows).
 */
function PinnedScorebug({ snapshot, nameA, nameB, kiosk }) {
  const isFinal = snapshot.status === 'final';
  const stale = !isFinal && Date.now() - snapshot.lastEventAt > STALE_MS;

  let eyebrow = 'LIVE';
  if (isFinal) eyebrow = 'FINAL';
  else if (snapshot.status === 'paused') eyebrow = 'PAUSED';

  const winner = isFinal ? winnerName(snapshot, nameA, nameB) : null;
  const periodLine = snapshot.periodLabel
    ? snapshot.periodLabel
    : `${snapshot.setsA}–${snapshot.setsB} sets`;

  const scoreSize = kiosk ? '3.25rem' : '2rem';

  return (
    <header
      aria-label="Match scorebug"
      style={{
        // Stickiness is owned by the wrapper in the page body so the scorebug and
        // the tab bar pin together; this header only paints its own surface.
        background: 'var(--card)',
        borderBottom: '2px solid var(--foreground)',
        padding: kiosk ? '20px 24px' : '12px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Team A */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {snapshot.servingTeam === 'A' ? (
            <span
              role="img"
              aria-label="Serving"
              style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }}
            />
          ) : null}
          <span
            style={{
              fontWeight: winner === nameA ? 900 : 700,
              fontSize: kiosk ? '1.125rem' : '0.9375rem',
              color: 'var(--foreground)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {winner === nameA ? `▸ ${nameA}` : nameA}
          </span>
        </div>

        {/* Center score */}
        <div
          className="font-mono"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontSize: scoreSize,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--foreground)',
            ...tabularNums,
          }}
        >
          <span>{snapshot.pointsA}</span>
          <span style={{ color: 'var(--muted-foreground)' }}>–</span>
          <span>{snapshot.pointsB}</span>
        </div>

        {/* Team B */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <span
            style={{
              fontWeight: winner === nameB ? 900 : 700,
              fontSize: kiosk ? '1.125rem' : '0.9375rem',
              color: 'var(--foreground)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {winner === nameB ? `▸ ${nameB}` : nameB}
          </span>
          {snapshot.servingTeam === 'B' ? (
            <span
              role="img"
              aria-label="Serving"
              style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }}
            />
          ) : null}
        </div>
      </div>

      {/* Status + period summary line */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
        <p style={{ ...eyebrowStyle }}>{periodLine}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {stale ? (
            <span
              className="font-mono"
              style={{
                padding: '1px 8px',
                border: '1px solid var(--foreground)',
                borderRadius: 'var(--radius)',
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--muted-foreground)',
              }}
            >
              PAUSED
            </span>
          ) : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <PulseDot dim={isFinal || stale} />
            <span
              style={{
                fontFamily: 'var(--se-font-mono, monospace)',
                fontSize: '0.6875rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: isFinal ? 'var(--foreground)' : 'var(--primary)',
              }}
            >
              {eyebrow}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

PinnedScorebug.propTypes = {
  snapshot: PropTypes.object.isRequired,
  nameA: PropTypes.string.isRequired,
  nameB: PropTypes.string.isRequired,
  kiosk: PropTypes.bool.isRequired,
};

/**
 * The Feed: list of public events (timestamp + description + score-after),
 * mapped straight from the paginated public event rows.
 *
 * NOTE ON ORDER (egress constraint): the deployed `api.live.listEvents` is
 * `.order("asc")`, so the first paginated page is the OLDEST events and
 * `loadMore` fetches LATER plays. We reverse the loaded rows to show
 * newest-of-page first, and the load button advances toward newer plays. A
 * true newest-first live feed would require a desc-ordered paginated backend
 * query — out of scope for this frontend page.
 */
function FeedPanel({ events, nameA, nameB, loadMore, canLoadMore }) {
  const rows = useMemo(() => [...events].reverse(), [events]);

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, padding: '16px 0', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
        No plays yet.
      </p>
    );
  }

  return (
    <section aria-label="Commentary feed">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((e) => {
          const team = e.team === 'A' ? nameA : e.team === 'B' ? nameB : null;
          const description =
            e.type === 'point'
              ? `${team ?? 'Point'} +${e.value}`
              : e.type === 'undo'
                ? 'Correction (undo)'
                : e.type.replace(/_/g, ' ');
          return (
            <li
              key={e.seq}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)',
              }}
            >
              <span
                className="font-mono"
                style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--muted-foreground)', ...tabularNums }}
              >
                {formatClock(e.at)}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', color: 'var(--foreground)' }}>
                {e.commentary ? e.commentary : description}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--foreground)', ...tabularNums }}
              >
                {e.runningA}–{e.runningB}
              </span>
            </li>
          );
        })}
      </ol>
      {canLoadMore ? (
        <button
          type="button"
          onClick={() => loadMore(30)}
          className="font-mono cursor-pointer"
          style={{
            marginTop: 12,
            minHeight: 40,
            width: '100%',
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
          Load more plays
        </button>
      ) : null}
    </section>
  );
}

FeedPanel.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  nameA: PropTypes.string.isRequired,
  nameB: PropTypes.string.isRequired,
  loadMore: PropTypes.func.isRequired,
  canLoadMore: PropTypes.bool.isRequired,
};

/**
 * The Scorecard tab — reuses the existing per-sport scorecard components,
 * which recompute their full structured view from the paginated event rows.
 * Cricket's batting/bowling card needs per-ball detail the public whitelist
 * intentionally strips, so cricket falls back to the generic stat header.
 */
function ScorecardPanel({ scorecardKind, events, snapshot, nameA, nameB }) {
  if (scorecardKind === 'volleyball') {
    // Render from the operator-pushed SNAPSHOT, not re-derived events: listEvents
    // is paginated oldest-first, so `events` is the earliest page (set-1 state)
    // for any non-trivial match — the snapshot is always current and
    // config-independent (§87d).
    const state = {
      currentSet: snapshot.currentUnit,
      pointsA: snapshot.pointsA,
      pointsB: snapshot.pointsB,
      setsA: snapshot.setsA,
      setsB: snapshot.setsB,
      servingTeam: snapshot.servingTeam ?? null,
      pointState: 'normal',
    };
    return <VolleyballScorebug state={state} teamA={nameA} teamB={nameB} />;
  }
  if (scorecardKind === 'tennis') {
    // From the snapshot (§87d): games -> currentSet, sets -> setScores, current
    // game points -> periodLabel ("40-30"), parsed back into the ladder labels.
    const [labelA = '0', labelB = '0'] = (snapshot.periodLabel || '0-0').split('-');
    const state = {
      sets: snapshot.setScores,
      currentSet: { gamesA: snapshot.pointsA, gamesB: snapshot.pointsB },
      currentGame: { labelA, labelB },
      server: snapshot.servingTeam ?? null,
      isMatchPoint: false,
      isSetPoint: false,
      isBreakPoint: false,
    };
    return <TennisScorebug state={state} teamA={nameA} teamB={nameB} />;
  }
  if (scorecardKind === 'goals' || scorecardKind === 'lines') {
    return <LineScore events={events} teamA={nameA} teamB={nameB} />;
  }
  return <GenericStatHeader events={events} teamA={nameA} teamB={nameB} />;
}

ScorecardPanel.propTypes = {
  scorecardKind: PropTypes.string.isRequired,
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  snapshot: PropTypes.object.isRequired,
  nameA: PropTypes.string.isRequired,
  nameB: PropTypes.string.isRequired,
};

/** Stats tab — simple aggregate counters derived from the loaded event rows. */
function StatsPanel({ events, snapshot, nameA, nameB }) {
  const stats = useMemo(() => {
    let pointsA = 0;
    let pointsB = 0;
    let leadChanges = 0;
    let prevSign = 0;
    for (const e of events) {
      if (e.type !== 'point') continue;
      if (e.team === 'A') pointsA += 1;
      if (e.team === 'B') pointsB += 1;
      const sign = e.runningA > e.runningB ? 1 : e.runningA < e.runningB ? -1 : 0;
      if (sign !== 0 && prevSign !== 0 && sign !== prevSign) leadChanges += 1;
      if (sign !== 0) prevSign = sign;
    }
    return { pointsA, pointsB, leadChanges, loaded: events.length };
  }, [events]);

  const cells = [
    { label: `${nameA} points`, value: stats.pointsA },
    { label: `${nameB} points`, value: stats.pointsB },
    { label: 'Lead changes', value: stats.leadChanges },
    { label: 'Sets', value: `${snapshot.setsA}–${snapshot.setsB}` },
    { label: 'Events loaded', value: stats.loaded },
  ];

  return (
    <section aria-label="Match stats" style={{ borderTop: '2px solid var(--foreground)', paddingTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        {cells.map((c) => (
          <div key={c.label} style={{ minWidth: 0 }}>
            <p style={eyebrowStyle}>{c.label}</p>
            <p
              className="font-mono"
              style={{ margin: '2px 0 0', fontSize: '1.125rem', fontWeight: 800, color: 'var(--foreground)', ...tabularNums }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

StatsPanel.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  snapshot: PropTypes.object.isRequired,
  nameA: PropTypes.string.isRequired,
  nameB: PropTypes.string.isRequired,
};

/** Loading skeleton — neutral bars, no spinner. */
function WatchSkeleton() {
  const bar = (w) => (
    <div
      style={{
        height: 14,
        width: w,
        borderRadius: 'var(--radius)',
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
      }}
    />
  );
  return (
    <div aria-busy="true" aria-label="Loading match" style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <div style={{ background: 'var(--card)', borderBottom: '2px solid var(--foreground)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {bar('30%')}
          {bar('20%')}
          {bar('30%')}
        </div>
        {bar('40%')}
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bar('100%')}
        {bar('90%')}
        {bar('95%')}
      </div>
    </div>
  );
}

/** Clean unavailable screen for null (not-found / private / removed). */
function UnavailableScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <p style={{ ...eyebrowStyle, marginBottom: 8 }}>Live match</p>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
          This match isn&apos;t available
        </h1>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--muted-foreground)' }}>
          The link may be old, private, or the match was removed.
        </p>
      </div>
    </div>
  );
}

export default function MonoWatchMatch() {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const kiosk = new URLSearchParams(location.search).get('kiosk') === '1';

  // SPLIT-QUERY CONTRACT (see file header). getByToken is the only per-point
  // reactive surface; getMeta is read-once names; listEvents is paginated.
  const snapshot = useQuery(api.live.getByToken, { token });
  const meta = useQuery(api.live.getMeta, { token });
  const {
    results: events,
    status,
    loadMore,
  } = usePaginatedQuery(api.live.listEvents, { token }, { initialNumItems: 30 });

  const [tab, setTab] = useState('Feed');
  const [ctaDismissed, setCtaDismissed] = useState(false);

  // useQuery returns undefined while loading, null when getByToken resolves to
  // not-found/private/removed. Skeleton on undefined; unavailable on null.
  if (snapshot === undefined) return <WatchSkeleton />;
  if (snapshot === null) return <UnavailableScreen />;

  const nameA = meta?.teamA?.name ?? 'Team A';
  const nameB = meta?.teamB?.name ?? 'Team B';
  const eventRows = events ?? [];
  const canLoadMore = status === 'CanLoadMore';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Scorebug + tab bar are ONE sticky unit. Previously each stuck to top:0
          independently, so on scroll the higher-z scorebug overlapped the tab bar
          and the tabs became unclickable. Wrapping pins them together as a block. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <PinnedScorebug snapshot={snapshot} nameA={nameA} nameB={nameB} kiosk={kiosk} />

      {!kiosk ? (
        <div
          role="tablist"
          aria-label="Match views"
          style={{
            display: 'flex',
            gap: 16,
            padding: '8px 16px',
            background: 'var(--background)',
            borderBottom: '1px solid color-mix(in oklch, var(--foreground) 14%, transparent)',
          }}
        >
          {TABS.map((label) => {
            const selected = tab === label;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(label)}
                className="font-mono cursor-pointer"
                style={{
                  background: 'transparent',
                  border: 0,
                  borderBottom: selected ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '6px 2px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: selected ? 'var(--primary)' : 'var(--muted-foreground)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
      </div>

      <main style={{ padding: kiosk ? '16px 24px 40px' : '16px 16px 96px', maxWidth: 720, margin: '0 auto' }}>
        {kiosk ? (
          <ScorecardPanel scorecardKind={snapshot.scorecardKind} events={eventRows} snapshot={snapshot} nameA={nameA} nameB={nameB} />
        ) : tab === 'Feed' ? (
          <FeedPanel events={eventRows} nameA={nameA} nameB={nameB} loadMore={loadMore} canLoadMore={canLoadMore} />
        ) : tab === 'Scorecard' ? (
          <ScorecardPanel scorecardKind={snapshot.scorecardKind} events={eventRows} snapshot={snapshot} nameA={nameA} nameB={nameB} />
        ) : (
          <StatsPanel events={eventRows} snapshot={snapshot} nameA={nameA} nameB={nameB} />
        )}

        {/* Signed-out moderation report affordance (q7k / Apple 1.2). */}
        {!kiosk ? (
          <footer
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid color-mix(in oklch, var(--foreground) 12%, transparent)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <ReportMatch token={token} />
          </footer>
        ) : null}
      </main>

      {!kiosk && !ctaDismissed ? (
        <div
          role="region"
          aria-label="Account invitation"
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 60,
            maxWidth: 560,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--card)',
            border: '1px solid var(--foreground)',
            borderRadius: 'calc(var(--radius) + 4px)',
            boxShadow: '4px 4px 0 var(--primary)',
            padding: '12px 14px',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)' }}>
            Save your matches — create a free account
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="font-mono cursor-pointer"
              style={{
                minHeight: 40,
                padding: '8px 12px',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: 0,
                borderRadius: 'var(--radius)',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Sign up
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setCtaDismissed(true)}
              className="cursor-pointer"
              style={{
                minHeight: 40,
                minWidth: 40,
                background: 'transparent',
                border: 0,
                fontSize: '1.125rem',
                color: 'var(--muted-foreground)',
              }}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
