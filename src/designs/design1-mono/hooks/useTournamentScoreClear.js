import { useEffect, useState } from 'react';
import { resetMatchOutcome } from '../../../utils/matchOutcome';
import { resetLiveGeneration } from '../../../lib/live/liveSession';
import { clearCricketMatchScore } from '../../../utils/cricketCalculations';
import { updateMatchInTournament } from '../../../utils/knockoutManager';

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
    resetLiveGeneration(`${tournamentScopeKey}:${pendingScoreClear.matchId}`);
    setTournament(updateMatchInTournament(tournament, pendingScoreClear.matchId,
      (match) => clearMatchScore(match, scoreKind)));
    setClearedScore(pendingScoreClear);
    setPendingScoreClear(null);
  };

  const undoScoreClear = () => {
    if (!clearedScore || clearedScore.tournamentScopeKey !== tournamentScopeKey) return;
    setTournament(updateMatchInTournament(tournament, clearedScore.matchId,
      () => clearedScore.snapshot));
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
  if (scoreKind === 'cricket') return clearCricketMatchScore(match);
  return scoreKind === 'sets'
    ? { ...resetMatchOutcome(match), sets: [], score1: null, score2: null }
    : { ...resetMatchOutcome(match), score1: null, score2: null };
}
