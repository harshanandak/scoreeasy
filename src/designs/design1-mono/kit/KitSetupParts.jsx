// Kit S2 quick setup parts (plan 2026-10-22 §9 S2, prototype `setup`): the 48px segmented control,
// the 48px stepper and the matchup preview. Colour comes only from --se-color-* tokens and engine
// output (--team-a-*, --team-b-* from teamColour.js via useTeamColours), so dark mode is a token swap.
import PropTypes from 'prop-types';
import './kit.css';
import './setup.css';

/**
 * A segmented choice: a sunk track of toggle buttons, 48px tall. The chosen one is a Mono-strength
 * control (ink edge, offset shadow, heavier type) and carries aria-pressed, so colour is never the
 * only signal. Columns: up to four across, more wrap onto a second row.
 */
export function KitSegmented({ label, options, value, onChange, labelledBy }) {
  const columns = options.length <= 4 ? options.length : Math.ceil(options.length / 2);
  return (
    <div
      className="kit-seg"
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      style={{ '--kit-seg-cols': Math.max(1, columns) }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value ? 'true' : 'false'}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
KitSegmented.propTypes = {
  label: PropTypes.string,
  labelledBy: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.node.isRequired })).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

/** A number with − and + controls either side, all 48px. */
export function KitStepper({ label, value, onDecrease, onIncrease, canDecrease = true, canIncrease = true, labelledBy }) {
  return (
    <div className="kit-stepper" role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label}>
      <button type="button" className="se-ctl" onClick={onDecrease} disabled={!canDecrease} aria-label={`Fewer ${label}`}>&minus;</button>
      <output aria-live="polite">{value}</output>
      <button type="button" className="se-ctl" onClick={onIncrease} disabled={!canIncrease} aria-label={`More ${label}`}>+</button>
    </div>
  );
}
KitStepper.propTypes = {
  label: PropTypes.string.isRequired,
  labelledBy: PropTypes.string,
  value: PropTypes.node.isRequired,
  onDecrease: PropTypes.func.isRequired,
  onIncrease: PropTypes.func.isRequired,
  canDecrease: PropTypes.bool,
  canIncrease: PropTypes.bool,
};

/**
 * The setup's one hand-drawn accent: a loose "v" between the two teams (the ui-back/ui-chev stroke
 * family from the hand-drawn layer, 2.1 on the 24 grid, in ink on the surface disc).
 */
function HandV() {
  return (
    <svg className="kit-mu-v" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.3 7.1C8.2 10.7 9.9 14.3 11.8 18.3" />
      <path d="M11.3 17.8C13.3 13.8 15.4 9.9 17.9 5.6" />
    </svg>
  );
}

/**
 * The matchup preview: two keys the way the board will show them. Team-colour sports paint each
 * key in its engine-gated team gradient (the engine's on-colour for the text, re-derived on every
 * pick, clash split included); other sports get neutral surface keys. Decorative for assistive
 * tech: the names live in the inputs and the colours in the pickers.
 */
export function MatchupPreview({ nameA, nameB, coloured, colourStyle }) {
  return (
    <div
      className={`kit-mu${coloured ? ' is-team' : ''}`}
      style={coloured ? colourStyle : undefined}
      aria-hidden="true"
      data-testid="matchup-preview"
    >
      <div className="kit-mu-key kit-mu-a">
        <b>{nameA.trim() || 'Team A'}</b>
        <span>0</span>
      </div>
      <div className="kit-mu-key kit-mu-b">
        <b>{nameB.trim() || 'Team B'}</b>
        <span>0</span>
      </div>
      <span className="kit-mu-vs"><HandV /></span>
    </div>
  );
}
MatchupPreview.propTypes = {
  nameA: PropTypes.string.isRequired,
  nameB: PropTypes.string.isRequired,
  coloured: PropTypes.bool,
  colourStyle: PropTypes.object,
};
