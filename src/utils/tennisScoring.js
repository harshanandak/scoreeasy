export function formatTennisPointScore(score, opponentScore) {
  if (score >= 3 && opponentScore >= 3) {
    if (score === opponentScore) return '40';
    if (Math.abs(score - opponentScore) > 1) return String(score);
    if (score > opponentScore) return 'AD';
    return '40';
  }

  const labels = ['0', '15', '30', '40'];
  return labels[score] || String(score);
}
