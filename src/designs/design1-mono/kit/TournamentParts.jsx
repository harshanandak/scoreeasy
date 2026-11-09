// Kit tournament parts: the pieces every tournament screen shares (progress, view switch, fixture
// card, set chips, standings rows, champion card). Presentation only: callers pass in what to show,
// nothing here knows a sport's rules or touches storage. Colour comes from --se-color-* tokens and
// the --sport-* vars a screen sets with sportIdentityVars, so dark mode is a token swap.
import PropTypes from 'prop-types';
import './kit.css';
import './history.css';
import './stats.css';
import './tournament.css';

const cx = (...names) => names.filter(Boolean).join(' ');

/** One pill per match (group, then knockout), then the count. The pills are decorative: the count carries it. */
export function TourProgress({ matches, knockoutMatches, completed, total }) {
  const stateOf = (match) => {
    if (match.status === 'completed') return 'is-done';
    if (match.status === 'in-progress') return 'is-live';
    return '';
  };
  const knockout = knockoutMatches ?? [];
  return (
    <div className="kit-tour-progress">
      <ul className="kit-tour-steps" aria-hidden="true">
        {matches.map((match) => <li key={match.id} className={stateOf(match)} />)}
        {knockout.length > 0 && <li className="is-gap" />}
        {knockout.map((match) => <li key={match.id} className={stateOf(match)} />)}
      </ul>
      <span className="kit-tour-count" aria-label={`${completed} of ${total} matches completed`}>
        <b>{completed}</b>/{total}
      </span>
    </div>
  );
}
TourProgress.propTypes = {
  matches: PropTypes.arrayOf(PropTypes.object).isRequired,
  knockoutMatches: PropTypes.arrayOf(PropTypes.object),
  completed: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
};

/** The hub's views (Matches, Standings, Knockout, Teams): History's segmented track, plain pressed buttons. */
export function TourTabs({ tabs, tab, onChange }) {
  return (
    <div className="kit-seg kit-tour-seg" role="group" aria-label="Tournament views" style={{ '--kit-seg-cols': tabs.length }}>
      {tabs.map((id) => (
        <button key={id} type="button" aria-pressed={tab === id ? 'true' : 'false'} onClick={() => onChange(id)}>
          {id.charAt(0).toUpperCase() + id.slice(1)}
        </button>
      ))}
    </div>
  );
}
TourTabs.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.string).isRequired,
  tab: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

/**
 * One fixture: a label row (match name, status chips, Clear), the two team rows, then whatever the
 * caller adds (set chips, the action). `live` rings the card in ink for the match being played.
 */
export function FixtureCard({ label, chips, end, live = false, children }) {
  return (
    <article className={cx('kit-card kit-fx', live && 'is-live')}>
      <div className="kit-fx-meta">
        <span className="kit-fx-label">{label}</span>
        <span className="kit-fx-end">{chips}{end}</span>
      </div>
      {children}
    </article>
  );
}
FixtureCard.propTypes = {
  label: PropTypes.string,
  chips: PropTypes.node,
  end: PropTypes.node,
  live: PropTypes.bool,
  children: PropTypes.node,
};

/** A team row inside a fixture: name left, score right. The winner is heavier, the loser quieter. */
export function FixtureTeam({ name, score, winner = false, loser = false, tbd = false }) {
  return (
    <div className={cx('kit-last-team', winner && 'is-winner', loser && 'is-loser', tbd && 'is-tbd')}>
      <span className="kit-last-name">{name}</span>
      {score !== undefined && score !== null && <span className="kit-last-score kit-fx-score">{score}</span>}
    </div>
  );
}
FixtureTeam.propTypes = {
  name: PropTypes.string.isRequired,
  score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  winner: PropTypes.bool,
  loser: PropTypes.bool,
  tbd: PropTypes.bool,
};

/**
 * Set scores for a sets match, as pills. `abandoned` gives neutral pills with no winner emphasis;
 * otherwise a set the match winner took is `is-won` and one they lost is `is-lost`, and the higher
 * score is bold.
 */
export function SetChips({ sets, abandoned, matchWinner }) {
  return (
    <ul className="kit-fx-sets" aria-label="Set scores">
      {sets.map((set, index) => {
        const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
        const tone = abandoned ? '' : setWinner === matchWinner ? 'is-won' : 'is-lost';
        return (
          <li key={`set-${set.score1}-${set.score2}-${index}`} className={cx('kit-fx-set', tone)}>
            {!abandoned && set.score1 > set.score2 ? <b>{set.score1}</b> : <span>{set.score1}</span>}
            <span className="kit-fx-dash" aria-hidden="true">-</span>
            {!abandoned && set.score2 > set.score1 ? <b>{set.score2}</b> : <span>{set.score2}</span>}
          </li>
        );
      })}
    </ul>
  );
}
SetChips.propTypes = {
  sets: PropTypes.arrayOf(PropTypes.shape({ score1: PropTypes.number, score2: PropTypes.number })).isRequired,
  abandoned: PropTypes.bool,
  matchWinner: PropTypes.oneOf(['team1', 'team2', null]),
};

/**
 * League table as the Stats team rows: rank and team on top, the last column (points) beside the
 * name, then the labelled numbers. ARIA table rows with a visually hidden header row, so every cell
 * has its column name and nothing scrolls sideways at 360px.
 * columns: [{ header, label, tone? }], the last one is shown beside the name; row.values lines up with it.
 */
export function StandingsTable({ label, columns, rows }) {
  const cells = columns.slice(0, -1);
  const points = columns[columns.length - 1];
  return (
    <div className="kit-team-table" role="table" aria-label={label} style={{ '--kit-team-cols': cells.length }}>
      <div className="kit-team-header" role="row">
        {['Rank', 'Team', ...columns.map((column) => column.header)].map((header) => (
          <span key={header} role="columnheader">{header}</span>
        ))}
      </div>
      {rows.map((row, index) => (
        <div key={row.key} className={cx('kit-team-row kit-st-row', index === 0 && 'is-lead')} role="row">
          <span className="kit-team-name" role="rowheader" aria-label={`${index + 1}. ${row.name}`}>
            <span className="kit-st-rank" aria-hidden="true">{index + 1}</span>
            {row.name}
          </span>
          {cells.map((column, at) => (
            <span key={column.header} className="kit-team-cell" role="cell" data-label={column.label}>
              <span className={cx('kit-num', column.tone && column.tone(row.values[at]))}>{column.format ? column.format(row.values[at]) : row.values[at]}</span>
            </span>
          ))}
          <span className="kit-team-win" role="cell" data-label={points.label}>
            <span className="kit-num">{row.values[columns.length - 1]}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
StandingsTable.propTypes = {
  label: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({
    header: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    tone: PropTypes.func,
    format: PropTypes.func,
  })).isRequired,
  rows: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    values: PropTypes.array.isRequired,
  })).isRequired,
};

/** Positive margins read live, negative read danger; the sign itself carries it. */
export const marginTone = (value) => {
  if (Number(value) > 0) return 'kit-pos';
  if (Number(value) < 0) return 'kit-neg';
  return '';
};
export const signedMargin = (value) => (Number(value) >= 0 ? `+${value}` : `${value}`);

/** The tournament winner, once the final is decided. */
export function ChampionCard({ name }) {
  return (
    <section className="kit-card kit-champ" aria-label="Champion">
      <span>Champion</span>
      <b>{name}</b>
    </section>
  );
}
ChampionCard.propTypes = { name: PropTypes.string.isRequired };
