// Volleyball scoring calculations

export function validateSetScore(score1, score2, minPoints = 25, isDecider = false) {
  const target = isDecider ? 15 : minPoints;
  const winner = Math.max(score1, score2);
  const loser = Math.min(score1, score2);
  if (winner < target) return false;
  if (winner - loser < 2) return false;
  if (score1 === score2) return false;
  return true;
}

export function validateSingleSetScore(score1, score2, target = 10, winBy = 2, cap = null) {
  const maxScore = Math.max(score1, score2);
  const minScore = Math.min(score1, score2);
  if (score1 === score2) return false;
  if (maxScore < target) return false;
  // Hard cap (e.g. badminton 30): reaching the cap wins regardless of margin.
  if (cap != null && maxScore >= cap) return true;
  // Otherwise the winner must lead by `winBy` (default 2) — enforces win-by-2 at deuce.
  if (maxScore - minScore < winBy) return false;
  return true;
}

export function getMatchWinner(match) {
  if (match.score1 === null || match.score2 === null) return null;
  if (match.score1 > match.score2) return match.team1Id;
  if (match.score2 > match.score1) return match.team2Id;
  return null;
}

export function getMultiSetWinner(sets, setsToWin) {
  let t1Wins = 0;
  let t2Wins = 0;
  sets.forEach(set => {
    if (set.score1 > set.score2) t1Wins++;
    else if (set.score2 > set.score1) t2Wins++;
  });
  if (t1Wins >= setsToWin) return 'team1';
  if (t2Wins >= setsToWin) return 'team2';
  return null;
}

export function calculateVolleyballStandings(teams, matches) {
  const stats = teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    played: 0,
    won: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
    matchPoints: 0,
  }));

  matches.forEach(match => {
    if (match.score1 === null || match.score2 === null) return;

    const t1 = stats.find(s => s.teamId === match.team1Id);
    const t2 = stats.find(s => s.teamId === match.team2Id);
    if (!t1 || !t2) return;

    t1.played++;
    t2.played++;
    t1.pointsFor += match.score1;
    t1.pointsAgainst += match.score2;
    t2.pointsFor += match.score2;
    t2.pointsAgainst += match.score1;

    if (match.score1 > match.score2) {
      t1.won++;
      t1.matchPoints += 2;
      t2.lost++;
    } else {
      t2.won++;
      t2.matchPoints += 2;
      t1.lost++;
    }
  });

  stats.forEach(s => {
    s.diff = s.pointsFor - s.pointsAgainst;
  });

  return stats.sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.won !== a.won) return b.won - a.won;
    return b.diff - a.diff;
  });
}

export const POINTS_PRESETS = [
  { label: '10 pts', value: 10 },
  { label: '15 pts', value: 15 },
  { label: '21 pts', value: 21 },
  { label: '25 pts', value: 25 },
];

export const SET_FORMATS = [
  { label: 'Single Set', value: 'single', setsToWin: 1 },
  { label: 'Best of 3', value: 'bo3', setsToWin: 2, totalSets: 3 },
  { label: 'Best of 5', value: 'bo5', setsToWin: 3, totalSets: 5 },
];
