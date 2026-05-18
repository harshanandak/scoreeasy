import { useEffect, useState } from 'react';

export function useTournamentScoreClear({
  clearMatchScore,
  getTeamName,
  setTournament,
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
      label: `${getTeamName(match.team1Id)} vs ${getTeamName(match.team2Id)}`,
    });
  };

  const confirmScoreClear = () => {
    if (!pendingScoreClear || pendingScoreClear.tournamentScopeKey !== tournamentScopeKey) return;
    const updatedMatches = tournament.matches.map((match) =>
      match.id === pendingScoreClear.matchId ? clearMatchScore(match) : match
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
