/**
 * Normalizes match results from different sport engines into a common shape
 * for the Convex matches table: { score1, score2, detail, ... }
 *
 * Sport engines produce different result shapes:
 * - Cricket: team1Score/team2Score objects with runs/balls/wickets
 * - Sets (volleyball, badminton, tennis): sets array + setsWon1/setsWon2, or score1/score2
 * - Goals (football, hockey, basketball): score1/score2 directly
 */
export function normalizeMatchForConvex(result, sport) {
  let score1 = 0;
  let score2 = 0;
  let detail = null;

  // Cricket engine — scores are in team1Score/team2Score objects
  if (result.team1Score && result.team2Score) {
    score1 = result.team1Score.runs ?? 0;
    score2 = result.team2Score.runs ?? 0;
    detail = {
      team1Score: result.team1Score,
      team2Score: result.team2Score,
    };
  }
  // Test cricket — scores are in innings array
  else if (result.innings && Array.isArray(result.innings)) {
    const team1Innings = result.innings.filter(
      (inn) => inn.teamId === result.team1 || inn.teamId === "team1"
    );
    const team2Innings = result.innings.filter(
      (inn) => inn.teamId === result.team2 || inn.teamId === "team2"
    );
    score1 = team1Innings.reduce((sum, inn) => sum + (inn.runs ?? 0), 0);
    score2 = team2Innings.reduce((sum, inn) => sum + (inn.runs ?? 0), 0);
    detail = {
      innings: result.innings,
      winDesc: result.winDesc,
    };
  }
  // Sets-based with best-of format — has sets array and setsWon
  else if (result.sets && Array.isArray(result.sets)) {
    score1 = result.setsWon1 ?? 0;
    score2 = result.setsWon2 ?? 0;
    detail = {
      sets: result.sets,
      setsWon1: result.setsWon1,
      setsWon2: result.setsWon2,
    };
  }
  // Goals or single-set — has score1/score2 directly
  else if (typeof result.score1 === "number") {
    score1 = result.score1;
    score2 = result.score2;
  }

  return {
    sport,
    team1: result.team1,
    team2: result.team2,
    score1,
    score2,
    detail: detail ?? undefined,
    winner: result.winner || undefined,
    format: result.format || undefined,
    date: Date.now(),
    duration: result.elapsedSeconds || undefined,
  };
}
