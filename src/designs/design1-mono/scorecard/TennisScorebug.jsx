import PropTypes from 'prop-types';
import { tennisState } from '../../../models/live/tennis';
import { sideName, DEFAULT_TEAM_A, DEFAULT_TEAM_B } from './sideName';
import { tabularNums } from './scorecardStyles';

// Tennis live scorebug (research §4.B "LIVE SCOREBUG", design §6.2). Two stacked
// rows — one per player — read left→right (NOT mirrored like volleyball). Per row,
// left→right: player name (mono uppercase, 700, ellipsis) → completed-set game
// columns (oldest left, ~28px tabular, winner-bolded, optional tiebreak <sup>) →
// current-set game column (highlighted bg var(--accent)) → current-game point cell
// (15/30/40/AD ladder or the tiebreak integer) → serve dot (var(--primary) 8px,
// rendered ONLY on the serving row — exactly one row true). A thin pressure ribbon
// (BREAK PT / SET PT / MATCH PT, priority MATCH > SET > BREAK) spans the bug as a
// var(--primary) bar with white text when the corresponding flag is set.
//
// EVERY value is derived from `tennisState(events, config)`; team NAMES are static
// presentation labels resolved via `sideName`. `server` is read from the engine
// (stored serve_change / config.initialServer / alternation), NEVER inferred from
// the last scorer. CSS-variable tokens only (no hardcoded hex); numerics tabular.

const CELL = 28; // px width of a per-set game column
const POINT_CELL = 36; // px width of the current-game point cell
const DOT_CELL = 12; // px width of the trailing serve-dot column

/** A completed-set game count with an optional tiebreak mini-score superscript. */
function SetGameCell({ value, isWinner, tiebreak }) {
  return (
    <span
      className="font-mono"
      style={{
        width: CELL,
        textAlign: 'right',
        fontWeight: isWinner ? 800 : 400,
        color: 'var(--foreground)',
        ...tabularNums,
      }}
    >
      {value}
      {tiebreak != null ? (
        <sup style={{ fontSize: '0.6em', verticalAlign: 'super', ...tabularNums }}>{tiebreak}</sup>
      ) : null}
    </span>
  );
}

SetGameCell.propTypes = {
  value: PropTypes.number.isRequired,
  isWinner: PropTypes.bool.isRequired,
  tiebreak: PropTypes.number,
};

SetGameCell.defaultProps = {
  tiebreak: null,
};

/** The live (current-set) game count — sits in an accent-highlighted column. */
function CurrentSetCell({ value }) {
  return (
    <span
      className="font-mono"
      style={{
        width: CELL,
        textAlign: 'right',
        fontWeight: 700,
        color: 'var(--foreground)',
        background: 'var(--accent)',
        ...tabularNums,
      }}
    >
      {value}
    </span>
  );
}

CurrentSetCell.propTypes = {
  value: PropTypes.number.isRequired,
};

/** The current-game point cell — 15/30/40/AD ladder or a tiebreak integer. */
function PointCell({ label }) {
  return (
    <span
      className="font-mono"
      style={{
        width: POINT_CELL,
        textAlign: 'right',
        fontWeight: 900,
        letterSpacing: '-0.02em',
        color: 'var(--foreground)',
        ...tabularNums,
      }}
    >
      {label}
    </span>
  );
}

PointCell.propTypes = {
  label: PropTypes.string.isRequired,
};

/** 8px serving dot for the serving row, else a spacer that holds the slot. */
function ServeDot({ active }) {
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

ServeDot.propTypes = {
  active: PropTypes.bool.isRequired,
};

/** One player row: name → completed-set cells → live-set cell → point → serve dot. */
function PlayerRow({ name, side, state }) {
  const completed = state.sets.map((set, i) => {
    const own = side === 'A' ? set.a : set.b;
    const other = side === 'A' ? set.b : set.a;
    const tb = side === 'A' ? set.tbA : set.tbB;
    return (
      <SetGameCell
        key={i}
        value={own}
        isWinner={own > other}
        tiebreak={tb ?? null}
      />
    );
  });

  const liveGames = side === 'A' ? state.currentSet.gamesA : state.currentSet.gamesB;
  const pointLabel = side === 'A' ? state.currentGame.labelA : state.currentGame.labelB;

  return (
    <div
      // `group` (not `row`): there is no table/grid/rowgroup ancestor here, so a
      // `row` role would be an invalid orphan. `group` is valid standalone and
      // still carries the player's accessible name.
      role="group"
      aria-label={name}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: 700,
          fontSize: '0.875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          color: 'var(--foreground)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>
      {completed}
      <CurrentSetCell value={liveGames} />
      <PointCell label={pointLabel} />
      <ServeDot active={state.server === side} />
    </div>
  );
}

PlayerRow.propTypes = {
  name: PropTypes.string.isRequired,
  side: PropTypes.oneOf(['A', 'B']).isRequired,
  state: PropTypes.object.isRequired,
};

/** Pressure ribbon label by priority MATCH > SET > BREAK; null when none set. */
function pressureLabel(state) {
  if (state.isMatchPoint) return 'MATCH PT';
  if (state.isSetPoint) return 'SET PT';
  if (state.isBreakPoint) return 'BREAK PT';
  return null;
}

export default function TennisScorebug({ events, state: stateProp, config, teamA, teamB }) {
  // `state` lets the spectator page pass the operator-pushed snapshot directly —
  // authoritative and current — instead of re-deriving from an earliest-page
  // event slice (§87d). Falls back to deriving from events (local scorer path).
  const state = stateProp ?? tennisState(events ?? [], config);
  const nameA = sideName('A', teamA, teamB);
  const nameB = sideName('B', teamA, teamB);
  const ribbon = pressureLabel(state);

  return (
    <section
      aria-label="Tennis scorebug"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 14px',
        background: 'var(--card)',
        border: '1px solid var(--foreground)',
        borderRadius: 'var(--radius)',
      }}
    >
      <PlayerRow name={nameA} side="A" state={state} />
      <PlayerRow name={nameB} side="B" state={state} />

      {ribbon ? (
        <p
          style={{
            margin: 0,
            padding: '2px 8px',
            borderRadius: 'var(--radius)',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontSize: '0.625rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {ribbon}
        </p>
      ) : null}
    </section>
  );
}

TennisScorebug.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object),
  // Pre-derived tennisState-shaped object (operator snapshot). Wins over events.
  state: PropTypes.object,
  config: PropTypes.object,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
};

TennisScorebug.defaultProps = {
  events: undefined,
  state: undefined,
  config: undefined,
  teamA: DEFAULT_TEAM_A,
  teamB: DEFAULT_TEAM_B,
};
