// Kit tournament setup parts: the two pieces the multi-step create flow needs beyond quick setup's
// KitSegmented / KitStepper (progress and choice cards). Presentation only: callers pass in what to
// show. Colour comes from --se-color-* tokens, so dark mode is a token swap.
import PropTypes from 'prop-types';
import './kit.css';
import './setup.css';
import './tournamentSetup.css';

/**
 * Setup progress: one bar per step with its number and name. The current step carries
 * aria-current="step"; finished steps read "(done)" to assistive tech.
 */
export function SetupSteps({ labels, step }) {
  return (
    <ol className="kit-steps" aria-label="Tournament setup progress">
      {labels.map((label, index) => {
        const number = index + 1;
        let state = '';
        if (number < step) state = 'is-done';
        else if (number === step) state = 'is-now';
        return (
          <li key={label} className={state} aria-current={number === step ? 'step' : undefined}>
            <i aria-hidden="true" />
            <span>
              <b>{number}</b> {label}
              {number < step && <span className="kit-sr"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
SetupSteps.propTypes = {
  labels: PropTypes.arrayOf(PropTypes.string).isRequired,
  step: PropTypes.number.isRequired,
};

/**
 * A group of choice cards: a title and a one-line explanation each, for choices that need words
 * (tournament type, cricket format). The card's accessible name is its title and the explanation
 * its description. The chosen card is a Mono-strength control and carries aria-pressed.
 */
export function ChoiceCards({ options, value, onChange, labelledBy }) {
  return (
    <div className="kit-opts" role="group" aria-labelledby={labelledBy}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="kit-opt"
          aria-pressed={option.id === value ? 'true' : 'false'}
          aria-label={option.label}
          aria-description={option.desc}
          onClick={() => onChange(option.id)}
        >
          <b>{option.label}</b>
          <span>{option.desc}</span>
        </button>
      ))}
    </div>
  );
}
ChoiceCards.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    desc: PropTypes.string,
  })).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  labelledBy: PropTypes.string,
};
