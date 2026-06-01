// Cricket scoring calculations

// ==========================================
// CRICKET FORMAT PRESETS
// ==========================================

export const CRICKET_FORMATS = [
  {
    id: 'T20', name: 'T20', desc: '20 overs per side',
    overs: 20, players: 11, solo: false,
    powerplay: [{ start: 1, end: 6, label: 'Powerplay' }],
    freeHit: true, totalInnings: 2,
    trackOvers: true, declaration: false, followOn: false,
  },
  {
    id: 'T10', name: 'T10', desc: '10 overs per side',
    overs: 10, players: 11, solo: false,
    powerplay: [{ start: 1, end: 3, label: 'Powerplay' }],
    freeHit: true, totalInnings: 2,
    trackOvers: true, declaration: false, followOn: false,
  },
  {
    id: 'ODI', name: 'ODI', desc: '50 overs per side',
    overs: 50, players: 11, solo: false,
    powerplay: [
      { start: 1, end: 10, label: 'PP1' },
      { start: 11, end: 40, label: 'PP2' },
      { start: 41, end: 50, label: 'PP3' },
    ],
    freeHit: true, totalInnings: 2,
    trackOvers: true, declaration: false, followOn: false,
  },
  {
    id: 'test', name: 'Test Match', desc: 'Unlimited · 2 innings each',
    overs: null, players: 11, solo: false,
    powerplay: [], freeHit: false, totalInnings: 4,
    trackOvers: true, declaration: true, followOn: true,
  },
  {
    id: 'gully', name: 'Gully Cricket', desc: 'Street cricket · Custom rules',
    overs: 5, players: 6, solo: true,
    powerplay: [], freeHit: false, totalInnings: 2,
    trackOvers: true, declaration: false, followOn: false,
    customizable: true, gullyRules: true,
  },
  {
    id: 'custom', name: 'Custom', desc: 'Build your own format',
    overs: 5, players: 6, solo: true,
    powerplay: [], freeHit: false, totalInnings: 2,
    trackOvers: true, declaration: false, followOn: false,
    customizable: true,
  },
];

export const OVERS_PRESETS = [
  { label: '2 ov', value: 2 },
  { label: '5 ov', value: 5 },
  { label: '10 ov', value: 10 },
  { label: '20 ov', value: 20 },
  { label: '50 ov', value: 50 },
];

/**
 * Get a format preset by ID
 */
export function getCricketFormat(presetId) {
  return CRICKET_FORMATS.find(f => f.id === presetId) || null;
}

/**
 * Build a full format object from a preset, with optional overrides
 */
export function buildCricketFormat(presetId, overrides = {}) {
  const preset = getCricketFormat(presetId);
  if (!preset) return overrides;

  return {
    ...preset,
    ...overrides,
    preset: presetId,
  };
}

// ==========================================
// CORE CALCULATIONS
// ==========================================

export function ballsToOvers(balls) {
  const overs = Math.floor(balls / 6);
  const remaining = balls % 6;
  return remaining === 0 ? `${overs}` : `${overs}.${remaining}`;
}

export function oversToDecimal(balls) {
  const overs = Math.floor(balls / 6);
  const remaining = balls % 6;
  return overs + remaining / 6;
}

export function calculateRunRate(runs, balls) {
  if (balls === 0) return 0;
  return (runs * 6) / balls;
}

export function calculateNRR(runsScored, ballsFaced, runsConceded, ballsBowled) {
  if (ballsFaced === 0 || ballsBowled === 0) return 0;
  const runRate = (runsScored * 6) / ballsFaced;
  const runRateAgainst = (runsConceded * 6) / ballsBowled;
  return runRate - runRateAgainst;
}

// ==========================================
// FORMAT HELPERS
// ==========================================

/**
 * Get the current powerplay phase for the given over number
 * @param {object} format - Format with powerplay array
 * @param {number} currentOver - Current over (1-indexed)
 * @returns {{ label: string, active: boolean } | null}
 */
export function getPowerplayPhase(format, currentOver) {
  if (!format?.powerplay || format.powerplay.length === 0) return null;

  for (const pp of format.powerplay) {
    if (currentOver >= pp.start && currentOver <= pp.end) {
      return { label: pp.label, active: true, start: pp.start, end: pp.end };
    }
  }
  return null;
}

/**
 * Compute max wickets based on format rules
 * @param {object} format - Format object
 * @returns {number} Max wickets before all-out
 */
export function getMaxWickets(format) {
  const players = format?.players || 11;
  if (format?.lastManStands) return players;
  return players - 1;
}

/**
 * Check if follow-on can be enforced (lead >= 200 runs)
 */
export function canEnforceFollowOn(innings1Runs, innings2Runs) {
  return (innings1Runs - innings2Runs) >= 200;
}

/**
 * Compute total balls for an innings based on format
 * Returns Infinity for unlimited overs
 */
export function getTotalBalls(format) {
  if (!format) return Infinity;
  if (format.trackOvers === false) {
    return format.maxBalls || Infinity;
  }
  return format.overs ? format.overs * 6 : Infinity;
}

// ==========================================
// MATCH WINNER & RESULT
// ==========================================

/**
 * Get match winner — handles both limited overs and test match data shapes
 */
export function getMatchWinner(match) {
  if (match.status && match.status !== 'completed') return null;

  // If winner is explicitly set (by test scorer or super over), use it
  if (match.winner) return match.winner;

  // Test match with innings array
  if (match.innings && match.innings.length > 0) {
    const result = getTestMatchResult(match.innings, match.team1Id, match.team2Id, 10);
    return result.winner;
  }

  // Limited overs with team1Score/team2Score
  if (!match.team1Score || !match.team2Score) return null;
  const t1 = match.team1Score.runs;
  const t2 = match.team2Score.runs;
  if (t1 > t2) return match.team1Id;
  if (t2 > t1) return match.team2Id;
  return 'tie';
}

/** Helper: count innings actually played by a team */
function countPlayedInnings(teamInnings) {
  return teamInnings.filter(i => i.allOut || i.declared || i.runs > 0).length;
}

/** Helper: build result for the winning team in a test match */
function buildTestWinResult({ winnerId, winTotal, loseTotal, winPlayed, losePlayed, innings, maxWickets }) {
  const margin = winTotal - loseTotal;
  // Innings victory: winner batted once, loser batted twice
  if (winPlayed === 1 && losePlayed === 2) {
    return { winner: winnerId, desc: `Won by an innings and ${margin} runs` };
  }
  // Won by wickets if winner was batting last
  const lastInnings = innings[innings.length - 1];
  if (lastInnings.teamId === winnerId) {
    const wicketsLeft = maxWickets - (lastInnings.wickets || 0);
    const plural = wicketsLeft === 1 ? '' : 's';
    return { winner: winnerId, desc: `Won by ${wicketsLeft} wicket${plural}` };
  }
  return { winner: winnerId, desc: `Won by ${margin} runs` };
}

/**
 * Get test match result from innings array
 * Handles: won by runs, won by wickets, won by an innings, match tied
 */
export function getTestMatchResult(innings, team1Id, team2Id, maxWickets) {
  if (!innings || innings.length === 0) return { winner: null, desc: '' };

  const t1Innings = innings.filter(i => i.teamId === team1Id);
  const t2Innings = innings.filter(i => i.teamId === team2Id);

  const t1Total = t1Innings.reduce((s, i) => s + (i.runs || 0), 0);
  const t2Total = t2Innings.reduce((s, i) => s + (i.runs || 0), 0);

  const t1Played = countPlayedInnings(t1Innings);
  const t2Played = countPlayedInnings(t2Innings);

  if (t1Total === t2Total && t1Played >= 2 && t2Played >= 2) {
    return { winner: 'tie', desc: 'Match Tied' };
  }
  if (t1Total > t2Total) {
    return buildTestWinResult({ winnerId: team1Id, winTotal: t1Total, loseTotal: t2Total, winPlayed: t1Played, losePlayed: t2Played, innings, maxWickets });
  }
  if (t2Total > t1Total) {
    return buildTestWinResult({ winnerId: team2Id, winTotal: t2Total, loseTotal: t1Total, winPlayed: t2Played, losePlayed: t1Played, innings, maxWickets });
  }
  return { winner: null, desc: '' };
}

/**
 * Get limited overs match result description
 */
export function getLimitedOversResult(match) {
  if (!match.team1Score || !match.team2Score) return '';

  const winner = getMatchWinner(match);
  if (!winner) return '';
  if (winner === 'tie') return 'Match Tied';
  if (match.superOver && match.team1Score.runs === match.team2Score.runs) {
    return 'Won in Super Over';
  }

  const scoresByTeam = {
    [match.team1Id]: match.team1Score,
    [match.team2Id]: match.team2Score,
  };
  const battingOrder = Array.isArray(match.battingOrder) && match.battingOrder.length >= 2
    ? match.battingOrder
    : [match.team1Id, match.team2Id];
  const chasingTeam = battingOrder[1];
  const winnerScore = scoresByTeam[winner];
  const loserId = winner === match.team1Id ? match.team2Id : match.team1Id;
  const loserScore = scoresByTeam[loserId];

  // Team 2 won — won by wickets
  if (winner === chasingTeam) {
    const maxWickets = (match.format?.players || 11) - 1;
    const wicketsLeft = maxWickets - (winnerScore.wickets || 0);
    const plural = wicketsLeft === 1 ? '' : 's';
    return `Won by ${wicketsLeft} wicket${plural}`;
  }

  return `Won by ${(winnerScore?.runs || 0) - (loserScore?.runs || 0)} runs`;
}

// ==========================================
// POINTS TABLE
// ==========================================

/** Helper: get effective balls (allOut uses full overs if available) */
function effectiveBalls(inn, totalBallsPerInnings) {
  if (inn.allOut && totalBallsPerInnings) return totalBallsPerInnings;
  return inn.balls || 0;
}

/** Helper: accumulate NRR stats from test match innings */
function accumulateTestStats(row, teamInnings, opponentInnings, totalBallsPerInnings) {
  teamInnings.forEach(inn => {
    row.runsScored += inn.runs || 0;
    row.ballsFaced += effectiveBalls(inn, totalBallsPerInnings);
  });
  opponentInnings.forEach(inn => {
    row.runsConceded += inn.runs || 0;
    row.ballsBowled += effectiveBalls(inn, totalBallsPerInnings);
  });
}

/** Helper: accumulate NRR stats from limited overs match */
function accumulateLimitedOversStats(row, teamScore, opponentScore, totalBalls) {
  row.runsScored += teamScore.runs;
  row.ballsFaced += teamScore.allOut ? totalBalls : teamScore.balls;
  row.runsConceded += opponentScore.runs;
  row.ballsBowled += opponentScore.allOut ? totalBalls : opponentScore.balls;
}

/** Helper: apply win/loss/tie/draw to table rows */
function applyMatchResult(winner, match, t1, t2) {
  if (winner === 'draw') {
    t1.drawn++;
    t2.drawn++;
  } else if (winner === match.team1Id) {
    t1.won++;
    t1.points += 2;
    t2.lost++;
  } else if (winner === match.team2Id) {
    t2.won++;
    t2.points += 2;
    t1.lost++;
  } else if (winner === 'tie') {
    t1.tied++;
    t1.points += 1;
    t2.tied++;
    t2.points += 1;
  }
}

export function calculateCricketPointsTable(teams, matches) {
  const table = teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    played: 0, won: 0, lost: 0, tied: 0, drawn: 0, noResult: 0, points: 0,
    runsScored: 0, ballsFaced: 0, runsConceded: 0, ballsBowled: 0, nrr: 0,
  }));

  matches.forEach(match => {
    if (match.status !== 'completed') return;

    const t1 = table.find(t => t.teamId === match.team1Id);
    const t2 = table.find(t => t.teamId === match.team2Id);
    if (!t1 || !t2) return;

    t1.played++;
    t2.played++;

    if (match.innings && match.innings.length > 0) {
      const totalBallsPerInnings = match.format?.overs ? match.format.overs * 6 : null;
      const t1Inn = match.innings.filter(i => i.teamId === match.team1Id);
      const t2Inn = match.innings.filter(i => i.teamId === match.team2Id);
      accumulateTestStats(t1, t1Inn, t2Inn, totalBallsPerInnings);
      accumulateTestStats(t2, t2Inn, t1Inn, totalBallsPerInnings);
    } else if (match.team1Score && match.team2Score) {
      const totalBalls = match.format?.overs ? match.format.overs * 6 : (match.team1Score.balls || 0);
      accumulateLimitedOversStats(t1, match.team1Score, match.team2Score, totalBalls);
      accumulateLimitedOversStats(t2, match.team2Score, match.team1Score, totalBalls);
    } else {
      return;
    }

    applyMatchResult(getMatchWinner(match), match, t1, t2);
  });

  table.forEach(team => {
    team.nrr = calculateNRR(team.runsScored, team.ballsFaced, team.runsConceded, team.ballsBowled);
  });

  return table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
}
