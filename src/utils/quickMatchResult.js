import { ballsToOvers } from './cricketCalculations';

export function getResultOutcome(winner) {
  if (winner === 'Tie') return 'Match Tied';
  if (winner === 'Draw') return 'Match Drawn';
  return `${winner} won`;
}

export function getShareStatusText(response) {
  if (!response || typeof response.shared !== 'boolean') return 'Could not share result.';
  if (!response.shared) return 'Share is not available on this device.';
  if (response.method === 'clipboard') return 'Result copied.';
  return 'Share sheet opened.';
}

export function buildResultShareText(result, { isCricket = false } = {}) {
  if (!result) return '';
  const outcome = getResultOutcome(result.winner);

  if (isCricket && result.team1Score && result.team2Score) {
    const team1Score = `${result.team1Score.runs}/${result.team1Score.wickets} (${ballsToOvers(result.team1Score.balls)} ov)`;
    const team2Score = `${result.team2Score.runs}/${result.team2Score.wickets} (${ballsToOvers(result.team2Score.balls)} ov)`;
    return `${result.team1} ${team1Score} vs ${result.team2} ${team2Score} - ${outcome}`;
  }

  return `${result.team1} ${result.score1} - ${result.score2} ${result.team2} - ${outcome}`;
}

export function getResultSetRows(result) {
  if (!Array.isArray(result?.sets)) return [];

  return result.sets
    .map((set, index) => {
      const score1 = Number(set?.score1) || 0;
      const score2 = Number(set?.score2) || 0;
      const completed = Boolean(set?.completed);

      return {
        id: set?.id || `set-${index + 1}`,
        label: `Set ${index + 1}`,
        score1,
        score2,
        completed,
        winner: score1 === score2 ? null : score1 > score2 ? result.team1 : result.team2,
      };
    })
    .filter((row) => row.completed || row.score1 > 0 || row.score2 > 0);
}

export function getResultSetSummary(result) {
  const rows = getResultSetRows(result);
  if (rows.length === 0) return null;

  const setsWon1 = Number.isFinite(result?.setsWon1)
    ? result.setsWon1
    : rows.filter((row) => row.winner === result.team1).length;
  const setsWon2 = Number.isFinite(result?.setsWon2)
    ? result.setsWon2
    : rows.filter((row) => row.winner === result.team2).length;

  return {
    rows,
    text: `${setsWon1}-${setsWon2} sets`,
  };
}
