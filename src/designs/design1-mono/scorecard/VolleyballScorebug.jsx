import PropTypes from 'prop-types';
import { volleyballState } from '../../../models/live/volleyball';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { eyebrowStyle, tabularNums } from './scorecardStyles';

// Volleyball live scorebug (research §4.A "VOLLEYBALL LIVE SCOREBUG", design §6.2 /
// L162). A horizontal strip that mirrors around a center spine: each side carries
// a serving glyph (filled green dot, shown ONLY for `state.servingTeam`), a team
// name/abbr (700), a sets-won pill (800, var(--primary) fill, white text), and the
// current-set points (largest numeral, 900, tabular-nums). The center spine shows
// the set label (eyebrow 700 / 0.08em) and — when state.pointState !== 'normal' —
// a SET POINT / MATCH POINT chip.
//
// EVERY value is derived from `volleyballState(events, config)`; team NAMES are
// static presentation labels resolved via `sideName`. `servingTeam` is read from
// the engine (stored serve_change / config.initialServer), NEVER inferred from the
// last scorer. Numeral slots fit 2 digits so a no-cap deuce (32-30) never clips.

/** 8px serving dot for the serving side, else an 8px spacer that holds the slot. */
function ServingGlyph({ active }) {
  return (
    <span
      aria-hidden={!active}
      aria-label={active ? 'Serving' : undefined}
      role={active ? 'img' : undefined}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: active ? 'var(--primary)' : 'transparent',
      }}
    />
  );
}

ServingGlyph.propTypes = {
  active: PropTypes.bool.isRequired,
};

/** Sets-won pill: var(--primary) fill, white text, 800 weight, tabular. */
function SetsPill({ value }) {
  return (
    <span
      className="font-mono"
      style={{
        minWidth: '1.5rem',
        padding: '2px 8px',
        textAlign: 'center',
        borderRadius: 'var(--radius)',
        background: 'var(--primary)',
        color: 'var(--primary-foreground)',
        fontSize: '0.8125rem',
        fontWeight: 800,
        ...tabularNums,
      }}
    >
      {value}
    </span>
  );
}

SetsPill.propTypes = {
  value: PropTypes.number.isRequired,
};

/** The big current-set points numeral — 900, tabular, slot fits 2 digits. */
function Points({ value }) {
  return (
    <span
      className="font-mono"
      style={{
        minWidth: '1.6ch',
        textAlign: 'center',
        fontSize: '2rem',
        fontWeight: 900,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        color: 'var(--foreground)',
        ...tabularNums,
      }}
    >
      {value}
    </span>
  );
}

Points.propTypes = {
  value: PropTypes.number.isRequired,
};

/**
 * One mirrored team cluster. The element order flows toward the center spine, so
 * the right side passes `mirror` to reverse it (points sit innermost on both
 * sides). Glyph → name → pill → points (left); points → pill → name → glyph
 * (right).
 */
function TeamCluster({ name, setsWon, points, serving, mirror }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: mirror ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        flex: 1,
      }}
    >
      <ServingGlyph active={serving} />
      <span
        style={{
          fontWeight: 700,
          fontSize: '0.875rem',
          color: 'var(--foreground)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {name}
      </span>
      <SetsPill value={setsWon} />
      <Points value={points} />
    </div>
  );
}

TeamCluster.propTypes = {
  name: PropTypes.string.isRequired,
  setsWon: PropTypes.number.isRequired,
  points: PropTypes.number.isRequired,
  serving: PropTypes.bool.isRequired,
  mirror: PropTypes.bool.isRequired,
};

const POINT_STATE_LABEL = {
  setPoint: 'SET POINT',
  matchPoint: 'MATCH POINT',
};

export default function VolleyballScorebug({ events, config, teamA, teamB }) {
  const state = volleyballState(events, config);
  const nameA = sideName('A', teamA, teamB);
  const nameB = sideName('B', teamA, teamB);
  const setLabel = `SET ${state.currentSet}`;
  const chipLabel = POINT_STATE_LABEL[state.pointState] ?? null;

  return (
    <section
      aria-label="Volleyball scorebug"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        background: 'var(--card)',
        border: '1px solid var(--foreground)',
        borderRadius: 'var(--radius)',
      }}
    >
      <TeamCluster
        name={nameA}
        setsWon={state.setsA}
        points={state.pointsA}
        serving={state.servingTeam === 'A'}
        mirror={false}
      />

      {/* CENTER SPINE — set label + optional set/match-point chip. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <p style={eyebrowStyle}>{setLabel}</p>
        {chipLabel ? (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius)',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: '0.625rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}
          >
            {chipLabel}
          </span>
        ) : null}
      </div>

      <TeamCluster
        name={nameB}
        setsWon={state.setsB}
        points={state.pointsB}
        serving={state.servingTeam === 'B'}
        mirror
      />
    </section>
  );
}

VolleyballScorebug.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  config: PropTypes.object,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

VolleyballScorebug.defaultProps = {
  config: undefined,
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
