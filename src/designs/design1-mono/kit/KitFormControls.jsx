// Kit form controls for setup rules panels: a switch row, a number stepper with typed entry and a
// compact choice grid. Each target is 48px, colour comes only from --se-color-* tokens (see
// formControls.css), and state is never colour alone (the switch has a knob position, the chosen
// chip has an ink edge and a check mark).
import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './kit.css';
import './setup.css';
import './formControls.css';

/**
 * A setting row: label, an optional one-line hint and a switch. The whole row is the button, so the
 * thumb never has to find a small target. role="switch" + aria-checked carry the state.
 */
export function KitToggleRow({ label, hint, checked, onChange, disabled = false }) {
  const uid = useId();
  return (
    <button
      type="button"
      role="switch"
      className="kit-toggle"
      aria-checked={checked ? 'true' : 'false'}
      aria-labelledby={`${uid}-l`}
      aria-describedby={hint ? `${uid}-h` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="kit-toggle-text">
        <span id={`${uid}-l`} className="kit-toggle-label">{label}</span>
        {hint && <span id={`${uid}-h`} className="kit-toggle-hint">{hint}</span>}
      </span>
      <span className="kit-toggle-track" aria-hidden="true"><span className="kit-toggle-knob" /></span>
    </button>
  );
}
KitToggleRow.propTypes = {
  label: PropTypes.node.isRequired,
  hint: PropTypes.node,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

const isInt = (n) => Number.isSafeInteger(n);

/**
 * A number with − and + either side and a typed entry in the middle (role="spinbutton" with
 * aria-valuenow/min/max). A typed value is applied as soon as it is a whole number inside the
 * bounds; anything else is ignored and the field snaps back to the last good value on blur.
 * Arrow Up/Down step too.
 */
export function KitNumberStepper({ label, hint, value, min, max, step = 1, unit, onChange }) {
  const uid = useId();
  const [draft, setDraft] = useState(null);
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setDraft(null); }, [value]);
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const commit = (n) => { if (isInt(n) && n >= min && n <= max && n !== value) onChange(n); };
  const bump = (dir) => { typing.current = false; setDraft(null); commit(clamp(value + dir * step)); };
  return (
    <div className="kit-numrow">
      <div className="kit-numrow-text">
        <span id={`${uid}-l`} className="kit-toggle-label">{label}</span>
        {hint && <span id={`${uid}-h`} className="kit-toggle-hint">{hint}</span>}
      </div>
      <div className="kit-stepper kit-numstep" role="group" aria-labelledby={`${uid}-l`}>
        <button type="button" className="se-ctl" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => bump(-1)}>&minus;</button>
        <input
          className="kit-numstep-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          role="spinbutton"
          aria-label={label}
          aria-describedby={hint ? `${uid}-h` : undefined}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          value={draft ?? String(value)}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            // Read the whole entry: only a plain whole number counts. Never strip or cut characters,
            // which would change its meaning (00021 is 21; 2.5 and 1a2 are rejected, not 25 or 12).
            const text = e.target.value;
            typing.current = true;
            setDraft(text);
            const trimmed = text.trim();
            if (/^\d+$/.test(trimmed)) commit(Number(trimmed));
          }}
          onBlur={() => { typing.current = false; setDraft(null); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
          }}
        />
        {unit && <span className="kit-numstep-unit" aria-hidden="true">{unit}</span>}
        <button type="button" className="se-ctl" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => bump(1)}>+</button>
      </div>
    </div>
  );
}
KitNumberStepper.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.node,
  value: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number,
  unit: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

/**
 * A choice among three or more known options as a wrapping grid of chips (radiogroup). Options with
 * a `hint` become one-per-row cards: a bold title and a one-line plain description. One tab
 * stop; arrow keys move the choice, Home/End jump. The last chip spans the row when the count is odd.
 */
export function KitChoiceGrid({ label, labelledBy, options, value, onChange, columns = 2 }) {
  const refs = useRef([]);
  const uid = useId();
  const enabled = options.filter((o) => !o.disabled);
  const stop = enabled.find((o) => o.id === value) || enabled[0];
  const move = (from, dir) => {
    const at = enabled.findIndex((o) => o.id === from);
    const next = dir === 'first' ? enabled[0] : dir === 'last' ? enabled[enabled.length - 1]
      : enabled[(at + dir + enabled.length) % enabled.length];
    onChange(next.id);
    refs.current[options.indexOf(next)]?.focus();
  };
  const onKeyDown = (e, id) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' }[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    move(id, dir);
  };
  return (
    <div
      className={`kit-choice${options.some((o) => o.hint) ? ' is-cards' : ''}`}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      style={{ '--kit-choice-cols': columns }}
    >
      {options.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={o.id === value ? 'true' : 'false'}
          aria-labelledby={o.hint ? `${uid}-${i}-l` : undefined}
          aria-describedby={o.hint ? `${uid}-${i}-h` : undefined}
          tabIndex={stop && o.id === stop.id ? 0 : -1}
          disabled={o.disabled}
          onClick={() => { if (o.id !== value) onChange(o.id); }}
          onKeyDown={(e) => onKeyDown(e, o.id)}
        >
          {o.hint ? (
            <>
              <span id={`${uid}-${i}-l`} className="kit-choice-label">{o.label}</span>
              <span id={`${uid}-${i}-h`} className="kit-choice-hint">{o.hint}</span>
            </>
          ) : o.label}
        </button>
      ))}
    </div>
  );
}
KitChoiceGrid.propTypes = {
  label: PropTypes.string,
  labelledBy: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.node.isRequired, hint: PropTypes.node, disabled: PropTypes.bool })).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  columns: PropTypes.number,
};
