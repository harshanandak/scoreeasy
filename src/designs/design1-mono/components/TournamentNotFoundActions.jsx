import PropTypes from 'prop-types';

export default function TournamentNotFoundActions({ navigate, sport }) {
  return (
    <div className="mono-card text-center" style={{ padding: '24px', maxWidth: 360 }}>
      <p className="text-base font-semibold mb-2" style={{ color: '#111' }}>Tournament not found</p>
      <p className="text-sm mb-5" style={{ color: '#666' }}>
        It may have been deleted or opened from an old link.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="mono-btn-primary flex-1"
          style={{ minHeight: 44, padding: '10px' }}
          onClick={() => navigate(`/${sport}/tournament`)}
        >
          Tournaments
        </button>
        <button
          type="button"
          className="mono-btn flex-1"
          style={{ minHeight: 44, padding: '10px' }}
          onClick={() => navigate(`/${sport}/tournament/new`)}
        >
          Create
        </button>
      </div>
    </div>
  );
}

TournamentNotFoundActions.propTypes = {
  navigate: PropTypes.func.isRequired,
  sport: PropTypes.string.isRequired,
};
