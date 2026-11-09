import PropTypes from 'prop-types';
import '../kit/kit.css';
import '../kit/history.css';
import '../kit/tournament.css';

export default function TournamentNotFoundActions({ navigate, sport }) {
  return (
    <section className="kit-card kit-empty kit-tour-lost" aria-labelledby="tournament-not-found-title">
      <h2 id="tournament-not-found-title">Tournament not found</h2>
      <p>It may have been deleted or opened from an old link.</p>
      <div className="kit-btnrow" style={{ width: '100%' }}>
        <button type="button" className="se-go" onClick={() => navigate(`/${sport}/tournament`)}>
          Tournaments
        </button>
        <button type="button" className="se-ctl" onClick={() => navigate(`/${sport}/tournament/new`)}>
          Create
        </button>
      </div>
    </section>
  );
}

TournamentNotFoundActions.propTypes = {
  navigate: PropTypes.func.isRequired,
  sport: PropTypes.string.isRequired,
};
