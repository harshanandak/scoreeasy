import PropTypes from 'prop-types';

function getScoreInfo(match, engine) {
  let hasScore = false;
  let t1SetsWon = 0;
  let t2SetsWon = 0;

  if (engine === 'sets') {
    hasScore = match.sets && match.sets.length > 0;
    if (hasScore) {
      match.sets.forEach(set => {
        if (set.score1 > set.score2) t1SetsWon++;
        else if (set.score2 > set.score1) t2SetsWon++;
      });
    }
  } else if (engine === 'goals') {
    hasScore = match.score1 !== null && match.score1 !== undefined;
  } else if (engine === 'custom-cricket') {
    hasScore = match.team1Score !== null;
  }

  return { hasScore, t1SetsWon, t2SetsWon };
}

function getTeamColor(isReady, isWinner, hasScore) {
  if (!isReady) return '#ccc';
  return (isWinner || !hasScore) ? '#111' : '#888';
}

function getButtonLabel(matchStatus, hasScore) {
  if (matchStatus === 'in-progress') return 'Resume Match';
  if (hasScore) return 'Edit Score';
  return 'Enter Score';
}

export default function KnockoutMatchCard({ match, tournament, sport, id, navigate, getTeamName, engine }) {
  const team1Ready = match.team1Id !== null;
  const team2Ready = match.team2Id !== null;
  const bothReady = team1Ready && team2Ready;

  const { hasScore, t1SetsWon, t2SetsWon } = getScoreInfo(match, engine);

  const isTeam1Winner = match.status === 'completed' && match.winner === match.team1Id;
  const isTeam2Winner = match.status === 'completed' && match.winner === match.team2Id;

  const team1Color = getTeamColor(team1Ready, isTeam1Winner, hasScore);
  const team2Color = getTeamColor(team2Ready, isTeam2Winner, hasScore);

  return (
    <div className="mono-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#aaa' }}>
          {match.label}
        </span>
        <div className="flex items-center gap-2">
          {match.status === 'completed' && (
            <span className="mono-badge mono-badge-final">Completed</span>
          )}
          {match.status === 'in-progress' && (
            <span className="mono-badge mono-badge-live">In Progress</span>
          )}
        </div>
      </div>

      {/* Teams and scores */}
      <div className="grid grid-cols-3 gap-6 items-center mb-5">
        <div className="text-right">
          <div className="text-base font-medium mb-1" style={{ color: team1Color }}>
            {team1Ready ? getTeamName(match.team1Id) : 'TBD'}
          </div>
          {hasScore && engine === 'sets' && (
            <div className="text-3xl font-mono font-bold" style={{ color: isTeam1Winner ? '#111' : '#888' }}>
              {t1SetsWon}
            </div>
          )}
          {hasScore && engine === 'goals' && (
            <div className="text-3xl font-mono font-bold" style={{ color: isTeam1Winner ? '#111' : '#888' }}>
              {match.score1}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs font-medium" style={{ color: '#bbb' }}>vs</div>
        </div>
        <div className="text-left">
          <div className="text-base font-medium mb-1" style={{ color: team2Color }}>
            {team2Ready ? getTeamName(match.team2Id) : 'TBD'}
          </div>
          {hasScore && engine === 'sets' && (
            <div className="text-3xl font-mono font-bold" style={{ color: isTeam2Winner ? '#111' : '#888' }}>
              {t2SetsWon}
            </div>
          )}
          {hasScore && engine === 'goals' && (
            <div className="text-3xl font-mono font-bold" style={{ color: isTeam2Winner ? '#111' : '#888' }}>
              {match.score2}
            </div>
          )}
        </div>
      </div>

      {/* Set scores detail */}
      {hasScore && engine === 'sets' && match.sets.length > 0 && (
        <div className="flex justify-center gap-2 flex-wrap mb-5 py-3" style={{ borderTop: '1px solid #f5f5f5', borderBottom: '1px solid #f5f5f5' }}>
          {match.sets.map((set, i) => {
            const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
            const matchWinner = t1SetsWon > t2SetsWon ? 'team1' : 'team2';
            const isMatchWinnerSet = setWinner === matchWinner;
            return (
              <span
                key={`set-${set.score1}-${set.score2}-${i}`}
                className="px-3 py-1.5 rounded font-mono"
                style={{
                  background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                  color: '#111',
                  fontSize: '0.875rem'
                }}
              >
                <span style={{ fontWeight: set.score1 > set.score2 ? '600' : 'normal' }}>{set.score1}</span>
                <span style={{ color: '#ccc', margin: '0 4px', fontWeight: '300' }}>-</span>
                <span style={{ fontWeight: set.score2 > set.score1 ? '600' : 'normal' }}>{set.score2}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Action button */}
      {bothReady && (
        <button
          onClick={() => navigate(`/${sport}/tournament/${id}/match/${match.id}/score`)}
          className={match.status === 'in-progress' ? 'mono-btn-primary w-full' : 'mono-btn w-full'}
        >
          {getButtonLabel(match.status, hasScore)}
        </button>
      )}

      {!bothReady && (
        <p className="text-xs text-center py-2" style={{ color: '#bbb' }}>
          Waiting for semi-final results
        </p>
      )}
    </div>
  );
}

KnockoutMatchCard.propTypes = {
  match: PropTypes.object,
  tournament: PropTypes.object,
  sport: PropTypes.string,
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  navigate: PropTypes.func,
  getTeamName: PropTypes.func,
  engine: PropTypes.string,
};
