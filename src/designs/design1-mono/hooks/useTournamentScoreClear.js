import { useEffect, useState } from 'react';

export function useTournamentScoreClear({
  scoreKind,
  setTournament,
  teams,
  tournament,
  tournamentScopeKey,
}) {
  const [pendingScoreClear, setPendingScoreClear] = useState(null);
  const [clearedScore, setClearedScore] = useState(null);

  useEffect(() => {
    setPendingScoreClear(null);
    setClearedScore(null);
  }, [tournamentScopeKey]);

  const requestScoreClear = (match) => {
    setClearedScore(null);
    setPendingScoreClear({
      tournamentScopeKey,
      matchId: match.id,
      snapshot: match,
      label: `${getTeamName(teams, match.team1Id)} vs ${getTeamName(teams, match.team2Id)}`,
    });
  };

  const confirmScoreClear = () => {
    if (!pendingScoreClear || pendingScoreClear.tournamentScopeKey !== tournamentScopeKey) return;
    const updatedMatches = tournament.matches.map((match) =>
      match.id === pendingScoreClear.matchId ? clearMatchScore(match, scoreKind) : match
    );
    setTournament({ ...tournament, matches: updatedMatches });
    setClearedScore(pendingScoreClear);
    setPendingScoreClear(null);
  };

  const undoScoreClear = () => {
    if (!clearedScore || clearedScore.tournamentScopeKey !== tournamentScopeKey) return;
    const updatedMatches = tournament.matches.map((match) =>
      match.id === clearedScore.matchId ? clearedScore.snapshot : match
    );
    setTournament({ ...tournament, matches: updatedMatches });
    setClearedScore(null);
  };

  return {
    clearedScore,
    confirmScoreClear,
    pendingScoreClear,
    requestScoreClear,
    undoScoreClear,
    cancelScoreClear: () => setPendingScoreClear(null),
  };
}

function getTeamName(teams, teamId) {
  const team = teams?.find((candidate) => candidate.id === teamId);
  return team?.name || 'Unknown';
}

function clearMatchScore(match, scoreKind) {
  return scoreKind === 'sets'
    ? { ...match, sets: [], status: 'pending', winner: null }
    : { ...match, score1: null, score2: null, status: 'pending', winner: null };
}
