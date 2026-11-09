import PropTypes from 'prop-types';
import './setupSteps.css';

/**
 * The step indicator: one 48px button per step, the current one filled. Any step can be opened at
 * any time, so the scorer is never forced through all of them. Tabs open any step and the header
 * Back returns to the previous one; Start is the one button at the bottom of every step.
 */
export function SetupStepper({ steps, current, onSelect }) {
  return (
    <nav aria-label="Setup steps">
      <ol className="kit-steps">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className="kit-step"
              aria-current={i === current ? 'step' : undefined}
              onClick={() => onSelect(i)}
            >
              <b aria-hidden="true">{i + 1}</b>
              {s.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
SetupStepper.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired })).isRequired,
  current: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
};

/** One quiet opt-in row; saved rules are never applied to a new match automatically. */
export function LastCustomSetup({ saved, summary, onUse }) {
  if (!saved) return null;
  return <button type="button" className="kit-rrow" onClick={() => onUse(saved)}>
    <span className="kit-rrow-text">
      <span className="kit-rrow-label">Use my last custom setup</span>
      <span className="kit-rrow-summary">{summary}</span>
    </span>
  </button>;
}
LastCustomSetup.propTypes = { saved: PropTypes.object, summary: PropTypes.string, onUse: PropTypes.func.isRequired };
