// Quick setup team rows: one row per side, name and colour together. The row is painted in the
// team's engine-gated gradient (--team-a-* / --team-b-* from teamColour.js via useTeamColours), so
// it doubles as the matchup preview and the names are never shown twice. The colour is a single
// 48px button beside the name that opens the existing TeamColourPicker in a small dialog.
import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import TeamColourPicker, { TEAM_SWATCHES } from '../TeamColourPicker';
import { normaliseHex } from '../../../lib/teamColour';
import './teamRows.css';

const colourName = (hex) => {
  const h = normaliseHex(hex);
  return TEAM_SWATCHES.find((s) => s.hex === h)?.name ?? 'Custom';
};

function Chevron() {
  return (
    <svg className="kit-trow-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TeamRow({ team, coloured, open, onToggle, onClose }) {
  const wrap = useRef(null);
  const button = useRef(null);
  const key = team.n === 1 ? 'a' : 'b';
  const close = (refocus) => { onClose(); if (refocus) button.current?.focus(); };
  const label = `Team ${team.letter} colour`;

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (wrap.current && !wrap.current.contains(e.target)) onClose(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, onClose]);

  return (
    <div
      className="kit-trow-wrap"
      ref={(el) => { wrap.current = el; if (team.rowRef) team.rowRef.current = el; }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) { e.stopPropagation(); close(true); }
      }}
    >
      <div className="kit-trow" data-team={key}>
        <input
          id={`quick-team-${team.n}`}
          type="text"
          className="kit-trow-input"
          aria-label={`Team ${team.letter} name`}
          placeholder={`Team ${team.letter}`}
          value={team.name}
          onChange={team.onName}
          onFocus={team.onFocus}
          maxLength={50}
          autoComplete="off"
        />
        {coloured && (
          <button
            ref={button}
            type="button"
            className="se-ctl kit-trow-colour"
            aria-haspopup="dialog"
            aria-expanded={open ? 'true' : 'false'}
            aria-label={`${label}: ${colourName(team.colour)}`}
            onClick={onToggle}
            style={{ '--kit-dot': `var(--team-${key}-core)` }}
          >
            <span className="kit-trow-dot" aria-hidden="true" />
            <Chevron />
          </button>
        )}
      </div>
      {team.suggestions}
      {coloured && open && (
        <div className="kit-trow-pop" role="dialog" aria-label={`Choose ${label}`}>
          <TeamColourPicker
            label={label}
            value={team.colour}
            onChange={(hex) => {
              team.onColour(hex);
              // A named kit colour is a finished choice; the custom picker keeps the dialog open.
              if (TEAM_SWATCHES.some((s) => s.hex === normaliseHex(hex))) close(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
TeamRow.propTypes = {
  team: PropTypes.object.isRequired,
  coloured: PropTypes.bool,
  open: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

/**
 * Both team rows. `teams` is [{ n, letter, name, onName, onFocus, colour, onColour, rowRef,
 * suggestions }]. The wrapper keeps data-testid="matchup-preview" and is-team so the engine colour
 * variables the rows use stay observable.
 */
export default function TeamRows({ teams, coloured, colourStyle }) {
  const [openTeam, setOpenTeam] = useState(null);
  return (
    <div
      className={`kit-teams${coloured ? ' is-team' : ''}`}
      style={coloured ? colourStyle : undefined}
      data-testid="matchup-preview"
    >
      {teams.map((team) => (
        <TeamRow
          key={team.n}
          team={team}
          coloured={coloured}
          open={openTeam === team.n}
          onToggle={() => setOpenTeam((cur) => (cur === team.n ? null : team.n))}
          onClose={() => setOpenTeam((cur) => (cur === team.n ? null : cur))}
        />
      ))}
    </div>
  );
}
TeamRows.propTypes = {
  teams: PropTypes.arrayOf(PropTypes.object).isRequired,
  coloured: PropTypes.bool,
  colourStyle: PropTypes.object,
};
