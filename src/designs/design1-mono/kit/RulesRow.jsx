import { useId } from 'react';
import PropTypes from 'prop-types';
import './teamRows.css';

function Chevron({ open }) {
  return (
    <svg className="kit-rrow-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={open ? 'M6 15l6-6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}
Chevron.propTypes = { open: PropTypes.bool };

/**
 * One compact, whole-row-tappable line for an optional or advanced part of setup: a small label,
 * the current summary, and a chevron. The accessible name is the action ("Edit rules",
 * "Add players"), the summary is its description. With no onClick it is a plain read-only line.
 */
export default function RulesRow({ label, summary, actionLabel, onClick, expanded, controls }) {
  const summaryId = useId();
  const body = (
    <>
      <span className="kit-rrow-text">
        <span className="kit-rrow-label">{label}</span>
        <span id={summaryId} className="kit-rrow-summary">{summary}</span>
      </span>
      {onClick && <Chevron open={expanded} />}
    </>
  );
  if (!onClick) return <div className="kit-rrow is-static">{body}</div>;
  return (
    <button
      type="button"
      className="kit-rrow"
      aria-label={actionLabel}
      aria-describedby={summaryId}
      aria-expanded={expanded === undefined ? undefined : expanded ? 'true' : 'false'}
      aria-controls={controls}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
RulesRow.propTypes = {
  label: PropTypes.string.isRequired,
  summary: PropTypes.node.isRequired,
  actionLabel: PropTypes.string,
  onClick: PropTypes.func,
  expanded: PropTypes.bool,
  controls: PropTypes.string,
};
