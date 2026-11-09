import { isAbandoned } from './matchOutcome';
// Generic standings calculators for sets-based and goals-based sports

/**
 * Calculate standings for sets-based sports (volleyball, badminton, TT, tennis, etc.)
 * @param {Array} teams - Array of team objects with id, name
 * @param {Array} matches - Array of match objects with scores per set
 * @param {Object} config - Sport config from sportRegistry
 * @returns {Array} Standings sorted by match points, then set diff, then point diff
 */
export function calculateSetsStandings(teams, matches, config) {
  const stats = teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    noResult: 0,
    played: 0,
    won: 0,
    lost: 0,
    setsWon: 0,
    setsLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    diff: 0,
    matchPoints: 0,
  }));

  matches.forEach(match => {
    if ((!match.sets || match.sets.length === 0) && !isAbandoned(match)) return;
    if (match.status !== 'completed' && match.status !== 'abandoned') return;

    const t1 = stats.find(s => s.teamId === match.team1Id);
    const t2 = stats.find(s => s.teamId === match.team2Id);
    if (!t1 || !t2) return;

    t1.played++;
    t2.played++;
    if (isAbandoned(match)) { t1.noResult++; t2.noResult++; return; }

    let t1SetsWon = 0;
    let t2SetsWon = 0;

    // Count sets won and total points
    match.sets.forEach(set => {
      if (set.score1 > set.score2) {
        t1SetsWon++;
      } else if (set.score2 > set.score1) {
        t2SetsWon++;
      }
      t1.pointsFor += set.score1 || 0;
      t1.pointsAgainst += set.score2 || 0;
      t2.pointsFor += set.score2 || 0;
      t2.pointsAgainst += set.score1 || 0;
    });

    t1.setsWon += t1SetsWon;
    t1.setsLost += t2SetsWon;
    t2.setsWon += t2SetsWon;
    t2.setsLost += t1SetsWon;

    // Determine match winner
    if (t1SetsWon > t2SetsWon) {
      t1.won++;
      t2.lost++;
      t1.matchPoints += 2; // Win = 2 points
    } else if (t2SetsWon > t1SetsWon) {
      t2.won++;
      t1.lost++;
      t2.matchPoints += 2;
    }
    // Note: sets-based sports don't have draws
  });

  // Calculate point differential
  stats.forEach(s => {
    s.diff = s.pointsFor - s.pointsAgainst;
  });

  // Sort: match points desc, set diff desc, point diff desc
  stats.sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    const aSetDiff = a.setsWon - a.setsLost;
    const bSetDiff = b.setsWon - b.setsLost;
    if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
    return b.diff - a.diff;
  });

  return stats;
}

/**
 * Calculate standings for goals-based sports (football, basketball, hockey, etc.)
 * @param {Array} teams - Array of team objects with id, name
 * @param {Array} matches - Array of match objects with total scores
 * @param {Object} config - Sport config from sportRegistry with win/draw/loss points
 * @returns {Array} Standings sorted by match points, then GD, then GF
 */
export function calculateGoalsStandings(teams, matches, config) {
  const { winPoints = 2, drawPoints = 1, lossPoints = 0, drawAllowed = false } = config;

  const stats = teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    noResult: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  }));

  matches.forEach(match => {
    const s1 = match.score1;
    const s2 = match.score2;
    if (s1 === null || s1 === undefined || s2 === null || s2 === undefined) return;
    if (match.status !== 'completed' && match.status !== 'abandoned') return;

    const t1 = stats.find(s => s.teamId === match.team1Id);
    const t2 = stats.find(s => s.teamId === match.team2Id);
    if (!t1 || !t2) return;

    t1.played++;
    t2.played++;
    if (isAbandoned(match)) { t1.noResult++; t2.noResult++; return; }
    t1.goalsFor += s1;
    t1.goalsAgainst += s2;
    t2.goalsFor += s2;
    t2.goalsAgainst += s1;

    if (s1 > s2) {
      t1.won++;
      t2.lost++;
      t1.points += winPoints;
      t2.points += lossPoints;
    } else if (s2 > s1) {
      t2.won++;
      t1.lost++;
      t2.points += winPoints;
      t1.points += lossPoints;
    } else if (s1 === s2) {
      // Draw
      if (drawAllowed) {
        t1.drawn++;
        t2.drawn++;
        t1.points += drawPoints;
        t2.points += drawPoints;
      }
      // If draws not allowed, this shouldn't happen (OT/shootout resolves it)
    }
  });

  // Calculate goal difference
  stats.forEach(s => {
    s.goalDiff = s.goalsFor - s.goalsAgainst;
  });

  // Sort: points desc, GD desc, GF desc
  stats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });

  return stats;
}
