import PropTypes from 'prop-types';
import './setupSteps.css';

/**
 * The step indicator: one 48px button per step, the current one filled. Any step can be opened at
 * any time, so the scorer is never forced through all of them; Start stays on every step.
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

/** "Next: Teams" under the step content, a secondary control (Start is the one forward action). */
export function NextStepButton({ label, onClick }) {
  return (
    <button type="button" className="se-ctl kit-step-next" onClick={onClick}>
      Next: {label}
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}
NextStepButton.propTypes = { label: PropTypes.string.isRequired, onClick: PropTypes.func.isRequired };
