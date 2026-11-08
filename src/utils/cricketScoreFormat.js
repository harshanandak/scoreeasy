/** A missing score is unknown/unplayed; a stored zero is still a recorded 0/0. */
export function formatCricketInnings(score, { test = false } = {}) {
  if (!score) return 'Yet to bat';
  const wickets = test && score.allOut ? 'all' : score.wickets ?? 0;
  return `${score.runs ?? 0}/${wickets}${test && score.declared ? 'd' : ''}`;
}

export function cricketScorePair(match, team1Id = match.team1Id ?? 'team1', team2Id = match.team2Id ?? 'team2') {
  if (Array.isArray(match.innings) && match.innings.length) {
    const teamScore = id => match.innings.filter(i => i.teamId === id
      && (i.balls > 0 || i.runs > 0 || i.wickets > 0 || i.allOut || i.declared))
      .map(i => formatCricketInnings(i, { test: true })).join(' & ') || 'Yet to bat';
    return [teamScore(team1Id), teamScore(team2Id)];
  }
  return [match.team1Score, match.team2Score].map((score, i) => {
    if (score) return formatCricketInnings(score);
    const runs = match[i === 0 ? 'score1' : 'score2'];
    return typeof runs === 'number' ? `${runs}/?` : 'Yet to bat';
  });
}

export function cricketScoreLine(match, names = [match.team1 ?? 'Team 1', match.team2 ?? 'Team 2'], ids) {
  const scores = cricketScorePair(match, ...(ids || []));
  return names.map((name, i) => `${name} ${scores[i]}`).join(' · ');
}
