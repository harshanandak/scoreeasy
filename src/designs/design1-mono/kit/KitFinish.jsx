// Kit S3 Finish: the winner moment (plan 2026-10-22 §9 S3, prototype `finish`). One presentational
// screen for every result: quick matches (MonoQuickMatch) and tournament sets results
// (MonoMatchResult). It renders a FinishModel (finishModel.js) and owns no sport rule.
//
// Colour: the winner card is the winner's engine-gated team gradient (teamColour.js), its text the
// engine's on-colour; the loser row is that team's tint with the engine's ink; the gold Winner tag
// is the screen's one gold. Hand-drawn layer (medium dosage, one accent per component): scribble
// confetti and a doodled trophy behind the text, a loose circle round the winner's name. Scores,
// names, text and every control edge stay crisp; the header (navigation chrome) is never drawn.
// Motion plays once and is off under prefers-reduced-motion (confetti gone, circle drawn still).
import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useScoringBoard } from '../scoring/scoringProgressContext';
import { NEUTRAL, colourVars, deriveTeamColours } from '../../../lib/teamColour';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { GoArrow } from './KitParts';
import './finish.css';

/** OS reduced-motion setting; a boolean override (tests, previews) wins. */
export function useReducedMotion(override) {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => (
    typeof override === 'boolean' ? override : Boolean(globalThis.matchMedia?.(query)?.matches)
  ));
  useEffect(() => {
    if (typeof override === 'boolean') { setReduced(override); return undefined; }
    const mq = globalThis.matchMedia?.(query);
    if (!mq) return undefined;
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [override]);
  return reduced;
}

// moment-confetti.svg: arcs, waves, sparks, dashes, hooks and dabs (never letter-like loops), each
// on a 12-unit box. Placed in the card's right column only, so no piece ever sits under text.
const CONFETTI_SHAPES = {
  arc: 'M2 9.6C3.4 5 7.4 2.6 10.6 3.4',
  wave: 'M1.2 6.6C2.7 3.8 4.4 3.9 5.6 6.4C6.8 8.9 8.6 8.9 10.6 6',
  spark: 'M6 1.4C6.1 2.9 6.1 4.2 6 5.5M2 4.4C3.1 5.2 3.9 6 4.6 7M10 4.2C8.9 5.1 8.1 5.9 7.4 6.9',
  dash: 'M1.5 7.2C4.2 5.9 7.3 5.3 10.5 5.6',
  hook: 'M2 3C5.2 3.4 8.6 5.6 9.6 9.8',
  dab: 'M5.4 6.3C5.7 5.7 6.4 5.6 6.6 6.2',
};
// [shape, x%, y%, rotation, size px, gold?] — the on-colour plus three gold.
const CONFETTI = [
  ['arc', 4, 6, -20, 18], ['dab', 16, 30, 0, 15, true], ['spark', 4, 50, 10, 20],
  ['hook', 34, 50, -40, 19], ['wave', 62, 52, 30, 20], ['dash', 86, 46, -10, 18],
  ['arc', 20, 70, 120, 20], ['dash', 50, 68, 20, 22, true], ['spark', 76, 66, -15, 18],
  ['wave', 2, 86, -60, 17], ['hook', 36, 84, 70, 18], ['dab', 64, 88, 0, 15, true], ['arc', 88, 84, 40, 16],
];

function Confetti() {
  return (
    <div className="kit-fin-confetti" aria-hidden="true" data-testid="finish-confetti">
      {CONFETTI.map(([shape, x, y, r, size, gold], i) => (
        <span
          key={`${shape}-${x}-${y}`}
          className={gold ? 'is-gold' : undefined}
          style={{ left: `${x}%`, top: `${y}%`, '--r': `${r}deg`, '--d': `${i * 40}ms` }}
        >
          <svg width={size} height={size} viewBox="0 0 12 12" focusable="false">
            <path d={CONFETTI_SHAPES[shape]} strokeWidth={shape === 'dab' ? 3.4 : 1.35} />
          </svg>
        </span>
      ))}
    </div>
  );
}

// moment-trophy.svg, non-scaling 2.6px, in the card's on-colour.
const TROPHY = [
  'M13.2 9.4C13 17 14.6 24.4 23.8 25.2C33 25 35.2 17.4 34.8 9',
  'M10.8 9.9C19.3 8.8 28.6 8.6 37.3 9.3',
  'M13.6 12.6C9.4 11.4 6.6 13.4 7.4 16.6C8.2 19.6 11.4 20.6 15.3 19.8',
  'M34.4 12.4C38.6 11.2 41.6 13.2 40.8 16.4C40 19.4 36.8 20.6 32.9 19.8',
  'M23.6 25.4C23.9 27.6 23.7 30 24.1 32.3',
  'M17 32.6C16.6 34.6 16.7 36.4 16.6 38.4C21.6 38.8 26.6 38.7 31.6 38.3C31.4 36.4 31.4 34.4 31 32.4C26.4 32 21.6 32.1 15.6 32.6',
  'M17.6 12.8C17.5 15.2 18 17.3 19.3 19.1',
  'M40.6 2.6C40.9 4 41 5.2 40.9 6.4',
  'M43.6 6.4C44.6 5.8 45.6 5.4 46.6 5.2',
  'M43.2 9.6C44.2 9.8 45.2 10.2 46 10.8',
];

function Trophy() {
  return (
    <svg className="kit-fin-trophy" viewBox="0 0 48 42" aria-hidden="true" focusable="false" data-testid="finish-trophy">
      {TROPHY.map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

// moment-circle.svg: a loose loop stretched round the name box, drawn in once.
const LOOP = 'M5.3 25.4C5.2 24.5 4 21.7 4.6 19.8C5.2 17.9 6.7 16 9 14.2C11.2 12.5 14.4 10.7 18.1 9.3C21.8 7.9 26.4 6.6 31.1 5.7C35.8 4.8 41.1 4.2 46.2 3.9C51.2 3.7 56.4 3.8 61.2 4C66.1 4.3 70.8 4.9 75.2 5.7C79.6 6.4 84 7.4 87.5 8.7C91 9.9 94.5 11.5 96.5 13.3C98.5 15 99.7 17.1 99.5 19.1C99.3 21.1 97.6 23.3 95.2 25.1C92.8 27 88.9 28.8 85 30.2C81 31.6 76.3 32.8 71.5 33.8C66.8 34.8 61.8 35.5 56.7 36.1C51.6 36.6 46.3 37 41 36.9C35.8 36.9 30.2 36.7 25.3 36C20.5 35.3 15.6 34.2 11.9 32.9C8.2 31.6 5.2 29.8 3.3 28C1.4 26.2 0.4 24.1 0.4 22C0.4 20 2.7 16.9 3.2 15.9';

function CircledName({ children }) {
  return (
    <span className="kit-fin-circled">
      {children}
      <svg className="kit-fin-loop" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-testid="finish-circle">
        <path d={LOOP} pathLength="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  );
}
CircledName.propTypes = { children: PropTypes.node.isRequired };

const sideTeam = (model, side) => (side === 'team1' ? model.team1 : model.team2);
const other = (side) => (side === 'team1' ? 'team2' : 'team1');

function TeamRow({ team, prefix, label }) {
  return (
    <div className="kit-fin-row" style={{ '--row-tint': `var(${prefix}-tint)`, '--row-dot': `var(${prefix}-core)` }}>
      <i aria-hidden="true" />
      <span className="kit-fin-row-name">{label ? <span className="sr-only">{label}</span> : null}{team.name}</span>
      <span className="kit-fin-row-score">
        {team.score}
        {team.unit && <small>{team.unit}</small>}
      </span>
    </div>
  );
}
TeamRow.propTypes = {
  team: PropTypes.shape({ name: PropTypes.string, score: PropTypes.string, unit: PropTypes.string }).isRequired,
  prefix: PropTypes.string.isRequired,
  label: PropTypes.string,
};

/**
 * @param {object} props
 * @param {import('./finishModel').FinishModel} props.model
 * @param {string} props.sportId registry id (header badge)
 * @param {string} props.sportName
 * @param {string} [props.meta] the header's second line after the sport ("Best of 5 · 1h 12m")
 * @param {string} [props.team1Colour] team 1's picked colour (any hex; the engine gates it)
 * @param {string} [props.team2Colour]
 * @param {{label: string, onClick: Function}} [props.primary] the one Go (Rematch); omit to hide it
 * @param {Array<{label: string, onClick?: Function, disabled?: boolean}>} props.secondary Mono-strength controls
 * @param {Function} props.onDone the header's Done
 * @param {import('react').ReactNode} [props.notices] save/sync/share status, under the actions
 * @param {import('react').ReactNode} [props.footer] e.g. a quiet Sign in
 * @param {boolean} [props.reduceMotion] override for prefers-reduced-motion
 */
export default function KitFinish({
  model, sportId, sportName, meta, team1Colour, team2Colour,
  primary, secondary = [], onDone, doneLabel = 'Done', notices, footer, reduceMotion,
}) {
  useScoringBoard();
  const headingRef = useRef(null);
  const reduced = useReducedMotion(reduceMotion);
  const won = model.outcome === 'win' && (model.winnerSide === 'team1' || model.winnerSide === 'team2');

  // Focus lands on the outcome (a11y): a screen reader hears the result, and keyboard focus is
  // never left inside the finished scorer.
  useEffect(() => { headingRef.current?.focus(); }, []);

  const style = useMemo(() => {
    const { A, B } = deriveTeamColours(team1Colour, team2Colour);
    const vars = {
      ...sportIdentityVars(sportId),
      ...colourVars(A, '--kit-t1'),
      ...colourVars(B, '--kit-t2'),
      // Text on a team tint is the engine's fixed ink (tints are absolute, so this holds in dark).
      '--kit-fin-tint-ink': NEUTRAL.ink,
    };
    if (won) {
      const [win, lose] = model.winnerSide === 'team1' ? [A, B] : [B, A];
      Object.assign(vars, colourVars(win, '--kit-win'), colourVars(lose, '--kit-lose'));
    }
    return vars;
  }, [sportId, team1Colour, team2Colour, won, model.winnerSide]);

  const winner = won ? sideTeam(model, model.winnerSide) : null;
  const loser = won ? sideTeam(model, other(model.winnerSide)) : null;
  const metaLine = [sportName, meta].filter(Boolean).join(' · ');

  return (
    <section className="kit-screen kit-finish" data-screen="finish" role="region" aria-label="Match result" style={style}>
      <div className="kit-fin-top">
        <span className="kit-fin-badge" aria-hidden="true" />
        <div className="kit-fin-title">
          <b>{model.outcome === 'none' ? 'No result' : 'Full time'}</b>
          {metaLine && <small>{metaLine}</small>}
        </div>
        <button type="button" className="se-ctl" onClick={onDone}>{doneLabel}</button>
      </div>

      {won ? (
        <div className={`kit-fin-win${reduced ? '' : ' is-animated'}`} data-testid="winner-card">
          <Trophy />
          {!reduced && <Confetti />}
          <span className="kit-fin-medallion" aria-hidden="true">Winner</span>
          <h1 className="kit-fin-name" tabIndex={-1} ref={headingRef}>
            <span className="sr-only">Winner: </span>
            <CircledName>{winner.name}</CircledName>
          </h1>
          {model.detail && <p className="kit-fin-detail">{model.detail}</p>}
          <p className="kit-fin-big">
            <span className="sr-only">{`${winner.name} `}</span>
            {winner.unit ? winner.score : `${winner.score}–${loser.score}`}
            {winner.unit && <small>{winner.unit}</small>}
          </p>
        </div>
      ) : (
        <div className="kit-fin-level" data-testid="level-card">
          <h1 className="kit-fin-level-title" tabIndex={-1} ref={headingRef}>{model.headline}</h1>
          {!model.team1.unit && (
            <p className="kit-fin-level-big">{`${model.team1.score}–${model.team2.score}`}</p>
          )}
        </div>
      )}

      {won ? (
        <TeamRow team={loser} prefix="--kit-lose" label="Runner-up: " />
      ) : (
        <div className="kit-fin-rows">
          <TeamRow team={model.team1} prefix="--kit-t1" />
          <TeamRow team={model.team2} prefix="--kit-t2" />
        </div>
      )}

      {model.chips.length > 0 && (
        <ul className="kit-fin-chips" aria-label="Set scores">
          {model.chips.map((chip) => (
            <li
              key={chip.key}
              className="kit-fin-chip"
              style={chip.side ? { '--dot': `var(--kit-${chip.side === 'team1' ? 't1' : 't2'}-core)` } : undefined}
            >
              {chip.label} <b>{chip.score}</b>
              {chip.side && <span className="sr-only">{`, ${sideTeam(model, chip.side).name}`}</span>}
            </li>
          ))}
        </ul>
      )}

      <p className="sr-only" role="status" aria-live="polite">{model.ariaSummary}</p>

      <div className="kit-fin-actions">
        {primary && (
          <button type="button" className="se-go" onClick={primary.onClick}>
            {primary.label}
            <GoArrow />
          </button>
        )}
        {secondary.length > 0 && (
          <div className="kit-fin-ctls">
            {secondary.map((action) => (
              <button
                key={action.label}
                type="button"
                className="se-ctl"
                disabled={action.disabled}
                aria-disabled={action.disabled || undefined}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        {footer}
      </div>
      {notices && <div className="kit-fin-notices">{notices}</div>}
    </section>
  );
}

KitFinish.propTypes = {
  model: PropTypes.shape({
    outcome: PropTypes.oneOf(['win', 'draw', 'none']).isRequired,
    winnerSide: PropTypes.oneOf(['team1', 'team2', null]),
    headline: PropTypes.string.isRequired,
    detail: PropTypes.string,
    team1: PropTypes.shape({ name: PropTypes.string, score: PropTypes.string, unit: PropTypes.string }).isRequired,
    team2: PropTypes.shape({ name: PropTypes.string, score: PropTypes.string, unit: PropTypes.string }).isRequired,
    chips: PropTypes.arrayOf(PropTypes.shape({
      key: PropTypes.string, label: PropTypes.string, score: PropTypes.string, side: PropTypes.string,
    })).isRequired,
    ariaSummary: PropTypes.string,
  }).isRequired,
  sportId: PropTypes.string,
  sportName: PropTypes.string,
  meta: PropTypes.string,
  team1Colour: PropTypes.string,
  team2Colour: PropTypes.string,
  primary: PropTypes.shape({ label: PropTypes.string.isRequired, onClick: PropTypes.func }),
  secondary: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired, onClick: PropTypes.func, disabled: PropTypes.bool,
  })),
  onDone: PropTypes.func,
  doneLabel: PropTypes.string,
  notices: PropTypes.node,
  footer: PropTypes.node,
  reduceMotion: PropTypes.bool,
};
