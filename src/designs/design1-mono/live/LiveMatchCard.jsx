import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

// A single live match in the public discovery feed (scoreeasy-3ws). Links to the
// token-gated spectator page. Purely presentational over one listLiveFeed item;
// all values are the server-whitelisted public fields (team names + score).

const SPORT_LABEL = {
  volleyball: 'Volleyball',
  tennis: 'Tennis',
  cricket: 'Cricket',
  cricket_test: 'Test cricket',
  football: 'Football',
  goals: 'Goals',
};

function sportLabel(item) {
  return SPORT_LABEL[item.sport] || SPORT_LABEL[item.scorecardKind] || item.sport || 'Match';
}

/** Whether to surface a set tally line (set-based sports with a real tally). */
function hasSets(item) {
  return (item.scorecardKind === 'volleyball' || item.scorecardKind === 'tennis')
    && (item.setsA > 0 || item.setsB > 0);
}

export default function LiveMatchCard({ item }) {
  const rows = [
    { side: 'A', name: item.teamA?.name || 'Team A', score: item.pointsA, sets: item.setsA, serving: item.servingTeam === 'A' },
    { side: 'B', name: item.teamB?.name || 'Team B', score: item.pointsB, sets: item.setsB, serving: item.servingTeam === 'B' },
  ];
  const showSets = hasSets(item);

  return (
    <Link
      to={`/live/${item.token}`}
      className="live-card"
      aria-label={`Watch live: ${rows[0].name} versus ${rows[1].name}`}
    >
      <div className="live-card-head">
        <span className="live-card-badge" aria-label="Live">
          <span aria-hidden="true">●</span> LIVE
        </span>
        <span className="live-card-sport">{sportLabel(item)}</span>
      </div>

      {rows.map((r) => (
        <div key={r.side} className="live-card-row">
          <span className="live-card-name">
            {r.serving ? <span className="live-card-serve" aria-label="Serving" /> : null}
            {r.name}
          </span>
          <span className="live-card-scores">
            {showSets ? <span className="live-card-sets">{r.sets}</span> : null}
            <span className="live-card-points">{r.score}</span>
          </span>
        </div>
      ))}

      {item.periodLabel ? <p className="live-card-period">{item.periodLabel}</p> : null}
    </Link>
  );
}

LiveMatchCard.propTypes = {
  item: PropTypes.shape({
    token: PropTypes.string.isRequired,
    sport: PropTypes.string,
    scorecardKind: PropTypes.string,
    pointsA: PropTypes.number,
    pointsB: PropTypes.number,
    setsA: PropTypes.number,
    setsB: PropTypes.number,
    servingTeam: PropTypes.oneOf(['A', 'B']),
    periodLabel: PropTypes.string,
    teamA: PropTypes.shape({ name: PropTypes.string }),
    teamB: PropTypes.shape({ name: PropTypes.string }),
  }).isRequired,
};
