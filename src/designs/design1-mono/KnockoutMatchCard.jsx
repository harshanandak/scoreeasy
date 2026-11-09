import TournamentMatchSyncStatus from './components/TournamentMatchSyncStatus';
import { isAbandoned, ABANDONED_LABEL } from '../../utils/matchOutcome';
import PropTypes from 'prop-types';
import { FixtureCard, FixtureResult, FixtureTeam, SetChips } from './kit/TournamentParts';
import { cricketFixtureView } from './kit/cricketFixture';

function getScoreInfo(match, engine) {
  let hasScore = false;
  let t1SetsWon = 0;
  let t2SetsWon = 0;

  if (engine === 'sets') {
    hasScore = match.sets && match.sets.length > 0;
    if (hasScore) {
      match.sets.forEach(set => {
        if (!set.completed) return;
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

function getButtonLabel(matchStatus, hasScore) {
  if (matchStatus === 'in-progress') return 'Resume Match';
  if (hasScore) return 'Edit Score';
  return 'Enter Score';
}

function getTeamScore(engine, hasScore, setsWon, goals) {
  if (!hasScore) return undefined;
  if (engine === 'sets') return setsWon;
  if (engine === 'goals') return goals;
  return undefined;
}

function getStatusChip(match) {
  if (match.status === 'completed') {
    const abandoned = isAbandoned(match);
    return <span className={abandoned ? 'kit-chip is-warn' : 'kit-chip is-done'}>{abandoned ? ABANDONED_LABEL : 'Completed'}</span>;
  }
  if (match.status === 'in-progress') return <span className="kit-chip is-live">In Progress</span>;
  return null;
}

export default function KnockoutMatchCard({ match, tournament, sport, id, navigate, getTeamName, engine }) {
  const team1Ready = match.team1Id !== null;
  const team2Ready = match.team2Id !== null;
  const bothReady = team1Ready && team2Ready;

  const { hasScore, t1SetsWon, t2SetsWon } = getScoreInfo(match, engine);

  const abandoned = isAbandoned(match);
  const decided = match.status === 'completed' && !abandoned;
  const isTeam1Winner = decided && match.winner === match.team1Id;
  const isTeam2Winner = decided && match.winner === match.team2Id;
  const isTeam1Loser = decided && team1Ready && !isTeam1Winner;
  const isTeam2Loser = decided && team2Ready && !isTeam2Winner;

  let matchWinner = null;
  if (!abandoned) matchWinner = t1SetsWon > t2SetsWon ? 'team1' : 'team2';

  // Cricket knockouts show the innings line and overs like a group fixture (sets and goals are unchanged).
  const cricket = engine === 'custom-cricket' && hasScore ? cricketFixtureView(match, tournament?.format) : null;

  return (
    <FixtureCard label={match.label} chips={getStatusChip(match)} live={match.status === 'in-progress'}>
      <TournamentMatchSyncStatus compact sport={sport} tournament={tournament} match={match} />

      <div className="kit-last-teams">
        <FixtureTeam
          name={team1Ready ? getTeamName(match.team1Id) : 'TBD'}
          score={cricket ? cricket.scores[0] : getTeamScore(engine, hasScore, t1SetsWon, match.score1)}
          detail={cricket?.details[0]}
          wide={cricket?.wide}
          winner={isTeam1Winner}
          loser={isTeam1Loser}
          tbd={!team1Ready}
        />
        <FixtureTeam
          name={team2Ready ? getTeamName(match.team2Id) : 'TBD'}
          score={cricket ? cricket.scores[1] : getTeamScore(engine, hasScore, t2SetsWon, match.score2)}
          detail={cricket?.details[1]}
          wide={cricket?.wide}
          winner={isTeam2Winner}
          loser={isTeam2Loser}
          tbd={!team2Ready}
        />
      </div>

      {hasScore && engine === 'sets' && match.sets.length > 0 && (
        <SetChips sets={match.sets} abandoned={abandoned} matchWinner={matchWinner} />
      )}

      {cricket?.result && <FixtureResult tone={cricket.abandoned ? 'warn' : undefined}>{cricket.result}</FixtureResult>}

      {bothReady && (
        <button type="button" onClick={() => navigate(`/${sport}/tournament/${id}/match/${match.id}/score`)} className="se-ctl">
          {getButtonLabel(match.status, hasScore)}
        </button>
      )}

      {!bothReady && (
        <p className="kit-fx-wait">Waiting for semi-final results</p>
      )}
    </FixtureCard>
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
