export const TENNIS_QUICK_DRAFT_PREFIX = 'se_tennis_quick_draft_';

export function getTennisQuickDraftKey(matchId) {
  return `${TENNIS_QUICK_DRAFT_PREFIX}${matchId}`;
}

export function mapTennisSetsForQuickHistory(sets) {
  if (!Array.isArray(sets)) return [];

  return sets.map((set, index) => ({
    id: set.id || `set-${index + 1}`,
    score1: Number(set.games1) || 0,
    score2: Number(set.games2) || 0,
    games1: Number(set.games1) || 0,
    games2: Number(set.games2) || 0,
    tiebreakPoints1: Number(set.tiebreakPoints1) || 0,
    tiebreakPoints2: Number(set.tiebreakPoints2) || 0,
    completed: Boolean(set.completed),
    isTiebreak: Boolean(set.isTiebreak),
  }));
}

export function countTennisQuickSetsWon(sets) {
  return mapTennisSetsForQuickHistory(sets)
    .filter((set) => set.completed)
    .reduce((totals, set) => {
      if (set.score1 > set.score2) totals.setsWon1 += 1;
      if (set.score2 > set.score1) totals.setsWon2 += 1;
      return totals;
    }, { setsWon1: 0, setsWon2: 0 });
}

export function buildTennisQuickDraft({ matchId, sport, team1Name, team2Name, format, sets, nowIso }) {
  return {
    id: matchId,
    sport,
    team1: team1Name,
    team2: team2Name,
    team1Name,
    team2Name,
    format,
    status: 'in-progress',
    sets,
    date: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function buildTennisQuickHistoryEntry({ match, sets, isComplete, completedAt }) {
  const setRows = mapTennisSetsForQuickHistory(sets);
  const { setsWon1, setsWon2 } = countTennisQuickSetsWon(sets);
  const winner = setsWon1 > setsWon2
    ? match.team1Name || match.team1
    : setsWon2 > setsWon1
      ? match.team2Name || match.team2
      : null;

  return {
    ...match,
    sets: setRows,
    setsWon1,
    setsWon2,
    score1: setsWon1,
    score2: setsWon2,
    winner: isComplete ? winner : null,
    status: isComplete ? 'completed' : 'in-progress',
    completedAt: isComplete ? completedAt : match.completedAt,
    updatedAt: completedAt,
  };
}
