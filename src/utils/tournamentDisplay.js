export function isPureKnockoutTournament(tournament) {
  return tournament?.type === 'knockout' || tournament?.knockoutConfig?.mode === 'single-elimination';
}

export function shouldShowKnockoutStage({ isPureKnockout, hasKnockouts }) {
  return Boolean(isPureKnockout || hasKnockouts);
}

export function getTournamentTypeLabel({ isPureKnockout, hasKnockouts, type, totalMatches }) {
  if (isPureKnockout) return 'Single Elimination';
  if (type === 'series') return `${totalMatches}-match series`;
  return `Round Robin${hasKnockouts ? ' + Knockouts' : ''}`;
}

export function getTournamentMatchCountPreview({
  tournamentType,
  teamCount,
  seriesGames,
  winnerMode,
  teamsAdvancing,
  thirdPlaceMatch,
}) {
  if (tournamentType === 'series') return seriesGames;
  if (tournamentType === 'knockout') {
    return Math.max(0, teamCount - 1) + (thirdPlaceMatch && teamCount >= 4 ? 1 : 0);
  }

  const groupMatches = teamCount === 2 ? 1 : (teamCount * (teamCount - 1)) / 2;
  if (tournamentType !== 'round-robin' || teamCount < 3 || winnerMode !== 'knockouts') {
    return groupMatches;
  }

  const playoffTeams = teamCount >= 4 && teamsAdvancing === 4 ? 4 : 2;
  const playoffMatches = playoffTeams === 4 ? (thirdPlaceMatch ? 4 : 3) : 1;
  return groupMatches + playoffMatches;
}

export function getTournamentProgressCounts(tournament) {
  const allMatches = [
    ...(tournament?.matches || []),
    ...(tournament?.knockoutMatches || []),
  ];

  return {
    completedMatches: allMatches.filter((match) => match.status === 'completed').length,
    totalMatches: allMatches.length,
  };
}
