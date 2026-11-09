// Quick setup, Teams step: one card per side showing its name in the team's engine-gated gradient.
// Tapping a card opens one team sheet where the name and the colour are edited together, with a
// live preview of the team chip. The other team's colour is blocked in the picker.
import { useState } from 'react';
import PropTypes from 'prop-types';
import MonoSheet from '../components/MonoSheet';
import TeamColourPicker, { colourNameOf } from '../TeamColourPicker';
import './teamSheet.css';

function Pencil() {
  return (
    <svg className="kit-tcard-pencil" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" />
      <path d="M14 7l3 3" />
    </svg>
  );
}

function TeamSheet({ team, other, coloured, colourStyle, onClose }) {
  const key = team.n === 1 ? 'a' : 'b';
  return (
    <MonoSheet open onClose={onClose} title={`Team ${team.letter}`} primaryAction={{ label: 'Done', onClick: onClose }}>
      <div className="kit-tsheet" style={coloured ? colourStyle : undefined}>
        <div className={`kit-tchip${coloured ? ' is-team' : ''}`} data-team={key} aria-hidden="true">
          <b>{team.name.trim() || `Team ${team.letter}`}</b>
          {coloured && <span>{colourNameOf(team.colour)}</span>}
        </div>
        <label htmlFor={`quick-team-${team.n}`} className="kit-setup-label">Team name</label>
        <div className="kit-tsheet-field" ref={team.rowRef}>
        <input
          id={`quick-team-${team.n}`}
          type="text"
          className="kit-setup-input"
          aria-label={`Team ${team.letter} name`}
          placeholder={`Team ${team.letter}`}
          value={team.name}
          onChange={team.onName}
          onFocus={team.onFocus}
          maxLength={50}
          autoComplete="off"
        />
        {team.suggestions}
        </div>
        {coloured && (
          <>
            <p className="kit-setup-label kit-tsheet-colour-label">Colour</p>
            <TeamColourPicker
              label={`Team ${team.letter} colour`}
              value={team.colour}
              onChange={team.onColour}
              blockedHex={other.colour}
              blockedLabel={`Team ${other.letter}`}
            />
          </>
        )}
      </div>
    </MonoSheet>
  );
}
TeamSheet.propTypes = {
  team: PropTypes.object.isRequired,
  other: PropTypes.object.isRequired,
  coloured: PropTypes.bool,
  colourStyle: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

/**
 * `teams` is [{ n, letter, name, onName, onFocus, colour, onColour, suggestions }]. The wrapper keeps
 * data-testid="matchup-preview" and is-team so the engine colour variables the cards use stay observable.
 */
export default function TeamCards({ teams, coloured, colourStyle }) {
  const [openTeam, setOpenTeam] = useState(null);
  const open = teams.find((t) => t.n === openTeam);
  const other = open ? teams.find((t) => t.n !== open.n) : null;
  return (
    <>
      <div
        className={`kit-teams${coloured ? ' is-team' : ''}`}
        style={coloured ? colourStyle : undefined}
        data-testid="matchup-preview"
      >
        {teams.map((t) => (
          <button
            key={t.n}
            type="button"
            className="kit-tcard"
            data-team={t.n === 1 ? 'a' : 'b'}
            aria-haspopup="dialog"
            aria-label={`Edit Team ${t.letter}: ${t.name.trim() || `Team ${t.letter}`}${coloured ? `, ${colourNameOf(t.colour)}` : ''}`}
            onClick={() => setOpenTeam(t.n)}
          >
            <span className="kit-tcard-tag">Team {t.letter}</span>
            <span className="kit-tcard-name">{t.name.trim() || `Team ${t.letter}`}</span>
            <span className="kit-tcard-edit"><Pencil />Edit name and colour</span>
          </button>
        ))}
      </div>
      {open && (
        <TeamSheet team={open} other={other} coloured={coloured} colourStyle={colourStyle} onClose={() => setOpenTeam(null)} />
      )}
    </>
  );
}
TeamCards.propTypes = {
  teams: PropTypes.arrayOf(PropTypes.object).isRequired,
  coloured: PropTypes.bool,
  colourStyle: PropTypes.object,
};
