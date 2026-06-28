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
// preferred.) ONLY the Feed consumes this paginated result; the Scorecard and
// Stats tabs are driven entirely by the always-current getByToken snapshot.
// ───────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery, usePaginatedQuery, useConvexConnectionState } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import VolleyballScorebug from './scorecard/VolleyballScorebug';
import TennisScorebug from './scorecard/TennisScorebug';
import LineScore from './scorecard/LineScore';
import GenericTimeline from './scorecard/GenericTimeline';
import { tabularNums, eyebrowStyle } from './scorecard/scorecardStyles';
import ReportMatch from './live/ReportMatch';

// A live match with no event in this window reads as PAUSED / DELAY (research
// §2 "Stale / paused"). 90s mirrors the spec.
const STALE_MS = 90000;

// How often we re-render purely so the staleness clock advances. The staleness
// cue (PAUSED) is derived from `Date.now() - lastEventAt`; without a periodic
// re-render it would only flip when a NEW snapshot arrives — which by definition
// never happens once the operator goes quiet. A coarse 15s tick is enough to
// surface PAUSED within the ~90s window without being a busy loop.
const STALE_TICK_MS = 15000;

const TABS = ['Feed', 'Scorecard', 'Stats'];

/**
 * Forces a re-render on a fixed interval so time-derived UI (the PAUSED / stale
 * cue) updates even when no new data arrives. Returns a monotonically rising
 * tick the caller can read to keep the value "live"; the value itself is unused
 * beyond triggering the render. The interval is cleared on unmount.
 */
function useStaleTick(intervalMs = STALE_TICK_MS) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/**
 * Derives a coarse connection status from Convex's connectionState() for the
 * spectator banner. This page is only ever mounted under a ConvexProvider, so
 * `useConvexConnectionState()` is always safe to call here.
 *
 *   'online'        → socket connected (or never-yet-connected first load)
 *   'reconnecting'  → dropped after connecting, still retrying within bounds
 *   'offline'       → sustained outage (retries exhausted the calm window)
 */
function deriveConnectionStatus(state) {
  if (!state || state.isWebSocketConnected) return 'online';
  if (!state.hasEverConnected) return 'online';
  if (state.connectionRetries > 0 && state.connectionRetries < 8) return 'reconnecting';
  return 'offline';
}

/**
 * Calm banner shown when the spectator's live connection drops. Distinct copy
 * for the transient reconnecting state vs a sustained offline outage; reuses the
 * mono.css alert surface. role=status + aria-live=polite so screen readers are
 * notified without stealing focus.
 */
function ConnectionBanner({ status }) {
  if (status === 'online') return null;
  const reconnecting = status === 'reconnecting';
  return (
    <div
      className="mono-alert mono-alert-info"
      role="status"
      aria-live="polite"
      style={{ margin: 0, padding: '8px 16px', borderRadius: 0, textAlign: 'center' }}
    >
      <p
        className="font-mono"
        style={{
          margin: 0,
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted-foreground)',
        }}
      >
        {reconnecting
          ? 'Reconnecting to live updates…'
          : 'You’re offline — scores may be out of date'}
      </p>
    </div>
  );
}

ConnectionBanner.propTypes = {
  status: PropTypes.oneOf(['online', 'reconnecting', 'offline']).isRequired,
};

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
  // Re-render on a timer so the staleness clock advances even when no new
  // snapshot arrives — otherwise PAUSED would never appear after the operator
  // goes quiet (see useStaleTick). The tick value itself is intentionally unused.
  useStaleTick();

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

  // Single spoken summary of the live score + status, announced politely and
  // atomically whenever any part changes. The visual score below is built from
  // many decorative spans (serve dot, en-dash, winner caret) that read poorly
  // one-by-one, so this dedicated string is the screen-reader source of truth.
  const statusWord = stale ? 'paused' : eyebrow.toLowerCase();
  const spokenScore = `${nameA} ${snapshot.pointsA}, ${nameB} ${snapshot.pointsB}. ${periodLine}. ${statusWord}.`;

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
      {/* Screen-reader source of truth for the live score + status. Polite +
          atomic so it re-announces the whole line on every change without
          interrupting; the visual rows below are aria-hidden to avoid the
          decorative spans being read out one fragment at a time. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {spokenScore}
      </p>

      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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

      {/* Status + period summary line (visual only; spoken via the live region
          above so screen readers get one clean summary, not the badge spans). */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
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
 * NOTE ON ORDER: `api.live.listEvents` is now `.order("desc")`, so the first
 * paginated page is the NEWEST plays — a spectator lands on the live tail — and
 * `loadMore` pages BACKWARD into history (older plays appended below). The rows
 * are rendered as-returned (newest first); no client reversal.
 */
function FeedPanel({ events, nameA, nameB, loadMore, canLoadMore }) {
  const rows = events;

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
          Load earlier plays
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
 * The Scorecard tab — driven ENTIRELY by the operator-pushed SNAPSHOT, never by
 * the event log. listEvents is a paginated tail (the feed), so deriving a
 * scorecard from a single page would show a partial/stale picture; the snapshot
 * is always current and config-independent (§87d). Per-period line scores and
 * cricket's batting/bowling card need the complete ORDERED log (which the public
 * whitelist also strips for cricket) and have no snapshot field yet — tracked in
 * scoreeasy-rvc.
 */
function ScorecardPanel({ scorecardKind, snapshot, nameA, nameB }) {
  if (scorecardKind === 'volleyball') {
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
    // Spectators get no period config, so the line score is total-only — take the
    // authoritative totals straight from the snapshot (re-summing a partial event
    // page would be wrong). isFinalResult gates the winner highlight so a LIVE
    // match isn't shown as decided. Per-period columns: scoreeasy-rvc.
    return (
      <LineScore
        totals={{ a: snapshot.pointsA, b: snapshot.pointsB }}
        isFinalResult={snapshot.status === 'final'}
        teamA={nameA}
        teamB={nameB}
      />
    );
  }
  return <SnapshotSummary snapshot={snapshot} nameA={nameA} nameB={nameB} />;
}

ScorecardPanel.propTypes = {
  scorecardKind: PropTypes.string.isRequired,
  snapshot: PropTypes.object.isRequired,
  nameA: PropTypes.string.isRequired,
  nameB: PropTypes.string.isRequired,
};

/**
 * Generic / cricket fallback scorecard: the authoritative snapshot score line.
 * Cricket's per-ball card + narrative stats (lead changes, biggest run, scoring
 * rate) need the complete ordered log the public surface doesn't expose — those
 * are tracked in scoreeasy-rvc; here we show what is always correct.
 */
function SnapshotSummary({ snapshot, nameA, nameB }) {
  // Per-side score only. We deliberately do NOT render "X leads by N": cricket is
  // the only real consumer of this fallback, and there pointsA/pointsB are each
  // side's CUMULATIVE runs — so during the first innings the not-yet-batted side
  // is structurally 0, and "leads by 150" / a "150–0" margin would be misleading
  // (a chase is also won by wickets, not the run delta). The periodLabel carries
  // the authoritative live line ("India 150/3 (25.2 ov)").
  // Key by SIDE, not name — team names are user data and can legitimately collide
  // (intra-squad scrimmage, identical placeholders), which would dup the React key.
  const rows = [
    { side: 'A', name: nameA, score: snapshot.pointsA },
    { side: 'B', name: nameB, score: snapshot.pointsB },
  ];
  return (
    <section aria-label="Match summary" style={{ borderTop: '2px solid var(--foreground)', paddingTop: 12 }}>
      {rows.map((r) => (
        <div
          key={r.side}
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}
        >
          <span
            style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {r.name}
          </span>
          <span
            className="font-mono"
            style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--foreground)', ...tabularNums }}
          >
            {r.score}
          </span>
        </div>
      ))}
      {snapshot.periodLabel ? (
        <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          {snapshot.periodLabel}
        </p>
      ) : null}
    </section>
  );
}

SnapshotSummary.propTypes = {
  snapshot: PropTypes.object.isRequired,
  nameA: PropTypes.string.isRequired,
  nameB: PropTypes.string.isRequired,
};

/**
 * Stats tab — authoritative aggregates from the always-current SNAPSHOT (never
 * the partial event page). Narrative stats that need the full ordered log (lead
 * changes, biggest run, scoring rate) are tracked in scoreeasy-rvc.
 */
function StatsPanel({ snapshot, nameA, nameB }) {
  const serving =
    snapshot.servingTeam === 'A' ? nameA : snapshot.servingTeam === 'B' ? nameB : '—';
  // Stable `id` keys — the labels embed team names, which can collide.
  const cells = [
    { id: 'a-points', label: `${nameA} points`, value: snapshot.pointsA },
    { id: 'b-points', label: `${nameB} points`, value: snapshot.pointsB },
    { id: 'sets', label: 'Sets', value: `${snapshot.setsA}–${snapshot.setsB}` },
    { id: 'period', label: 'Period', value: snapshot.periodLabel || `#${snapshot.currentUnit}` },
    { id: 'serving', label: 'Serving', value: serving },
  ];

  return (
    <section aria-label="Match stats" style={{ borderTop: '2px solid var(--foreground)', paddingTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        {cells.map((c) => (
          <div key={c.id} style={{ minWidth: 0 }}>
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

  // Drive the offline / reconnecting banner from Convex's live socket state.
  // Called unconditionally before the early returns to satisfy the Rules of
  // Hooks; this page is always mounted under a ConvexProvider.
  const connectionStatus = deriveConnectionStatus(useConvexConnectionState());

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
      {/* Brand / home bar — gives a spectator who landed cold on a share link a
          way to identify the product and step into the app. Hidden in kiosk mode
          (a fixed display surface, not a navigable session). */}
      {!kiosk ? (
        <nav
          aria-label="Site"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 16px',
            background: 'var(--background)',
            borderBottom: '1px solid color-mix(in oklch, var(--foreground) 12%, transparent)',
          }}
        >
          <Link
            to="/"
            aria-label="Score Easy home"
            className="cursor-pointer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 4px',
              fontWeight: 900,
              fontSize: '1rem',
              letterSpacing: '-0.02em',
              color: 'var(--foreground)',
              textDecoration: 'none',
            }}
          >
            Score Easy
          </Link>
          <Link
            to="/"
            className="font-mono cursor-pointer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 14px',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              borderRadius: 'var(--radius)',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Open app
          </Link>
        </nav>
      ) : null}

      {/* Scorebug + tab bar are ONE sticky unit. Previously each stuck to top:0
          independently, so on scroll the higher-z scorebug overlapped the tab bar
          and the tabs became unclickable. Wrapping pins them together as a block. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <ConnectionBanner status={connectionStatus} />
      <PinnedScorebug snapshot={snapshot} nameA={nameA} nameB={nameB} kiosk={kiosk} />

      {!kiosk ? (
        <div
          role="tablist"
          aria-label="Match views"
          style={{
            display: 'flex',
            gap: 16,
            padding: '0 16px',
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
                  // >=44px touch target (WCAG 2.5.5 / mobile-first): the visible
                  // underline still sits at the bottom edge, but the hit area now
                  // fills a full 44px-tall tap zone instead of ~28px.
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                  background: 'transparent',
                  border: 0,
                  borderBottom: selected ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '6px 4px',
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
          <ScorecardPanel scorecardKind={snapshot.scorecardKind} snapshot={snapshot} nameA={nameA} nameB={nameB} />
        ) : tab === 'Feed' ? (
          <FeedPanel events={eventRows} nameA={nameA} nameB={nameB} loadMore={loadMore} canLoadMore={canLoadMore} />
        ) : tab === 'Scorecard' ? (
          <ScorecardPanel scorecardKind={snapshot.scorecardKind} snapshot={snapshot} nameA={nameA} nameB={nameB} />
        ) : (
          <StatsPanel snapshot={snapshot} nameA={nameA} nameB={nameB} />
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
