// Kit S2 quick setup parts (plan 2026-10-22 §9 S2, prototype `setup`): the 48px segmented control
// and the 48px stepper. Colour comes only from --se-color-* tokens and engine
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
          disabled={o.disabled}
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
  options: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.node.isRequired, disabled: PropTypes.bool })).isRequired,
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
