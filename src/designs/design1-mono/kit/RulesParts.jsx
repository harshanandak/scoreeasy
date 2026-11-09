// The Rules step, the same for every sport: one summary line (with Reset only after a change), one
// quiet card of compact rows (label left, control right), and the less common rules folded under a
// single "More rules" row. A sport supplies its own rows and its own rules module; these parts
// carry only layout, so every sport's Rules step looks and behaves alike.
import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { KitSegmented } from './KitSetupParts';
import './formControls.css';
import './setupSteps.css';

/**
 * "Quick casual · 5 a side · first to 21": the chosen preset in bold, a plain-words detail after
 * it, and a Reset link only while the rules differ from that preset. The explicit space matters:
 * the heading's accessible name drops whitespace that sits only inside an inline element.
 */
export function RulesSummaryLine({ id, title, detail, resetLabel, onReset }) {
  return (
    <div className="kit-rules-line">
      <h2 id={id}>
        <b>{title}</b>
        {' '}
        <span>{`· ${detail}`}</span>
      </h2>
      {onReset && <button type="button" className="kit-linkbtn" onClick={onReset}>{resetLabel}</button>}
    </div>
  );
}
RulesSummaryLine.propTypes = {
  id: PropTypes.string,
  title: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
  resetLabel: PropTypes.string,
  onReset: PropTypes.func,
};

/** The quiet card the rows sit in. */
export function RulesPanel({ children, testId }) {
  return <div className="kit-rules-panel" data-testid={testId}>{children}</div>;
}
RulesPanel.propTypes = { children: PropTypes.node, testId: PropTypes.string };

/** A labelled segmented choice as one row of the panel, with an optional one-line hint. */
export function RulesSegmentRow({ label, options, value, onChange, hint }) {
  const id = useId();
  return (
    <div className="kit-rules-block">
      <p id={id} className="kit-setup-label">{label}</p>
      <KitSegmented labelledBy={id} options={options} value={value} onChange={onChange} />
      {hint && <p className="kit-setup-hint">{hint}</p>}
    </div>
  );
}
RulesSegmentRow.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  hint: PropTypes.string,
};

/**
 * A row with the label on the left and one native control (select or number box) on the right, for
 * a rule whose values are not a short fixed list. The control keeps its own accessible name.
 */
export function RulesFieldRow({ label, children }) {
  return <label className="kit-fieldrow"><span>{label}</span>{children}</label>;
}
RulesFieldRow.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node };

/** Rows that only apply while a switch above them is on, set in a step. */
export function RulesSub({ children }) {
  return <div className="kit-rules-sub">{children}</div>;
}
RulesSub.propTypes = { children: PropTypes.node };

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}
Chevron.propTypes = { open: PropTypes.bool };

/** One collapsed row; the less common rules open under it. Every rule stays reachable. */
export function MoreRules({ children, label = 'More rules' }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <>
      <button type="button" className="kit-more" aria-expanded={open ? 'true' : 'false'} aria-controls={bodyId} onClick={() => setOpen(v => !v)}>
        {label}
        <Chevron open={open} />
      </button>
      {open && <div id={bodyId} className="kit-rules-more-body">{children}</div>}
    </>
  );
}
MoreRules.propTypes = { children: PropTypes.node, label: PropTypes.string };
