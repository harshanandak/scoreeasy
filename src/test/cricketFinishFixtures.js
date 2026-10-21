// One scoring stroke from completion, for finish-navigation tests and the route sweep.
export function cricketFinishSeed(kind) {
  const format = { preset: 'custom', overs: 1, players: 11, totalInnings: 2, trackOvers: true };
  const match = {
    id: 'm1', team1Id: 'A', team2Id: 'B', status: 'in-progress', format,
    draftState: {
      innings: 2, battingTeam: 2, history: [],
      scores: {
        team1: { runs: 1, balls: 6, wickets: 0, allOut: false },
        team2: { runs: 2, balls: 1, wickets: 0, allOut: false },
      },
    },
  };
  if (kind.startsWith('test')) {
    match.format = { ...format, preset: 'test', overs: null, totalInnings: 4, declaration: true, followOn: true };
    match.draftState = {
      currentInningsIndex: 3, followOnEnforced: false, history: [],
      innings: [
        { teamId: 'A', runs: 1, balls: 6, wickets: 10, allOut: true },
        { teamId: 'B', runs: 0, balls: 6, wickets: 10, allOut: true },
        { teamId: 'A', runs: 0, balls: 6, wickets: 10, allOut: true },
        { teamId: 'B', runs: 0, balls: 0, wickets: 0, allOut: false },
      ],
    };
  }
  if (kind === 'guided') {
    match.format = { ...format, guided: true };
    match.team1Score = { runs: 1, balls: 6, wickets: 0, allOut: false };
    match.draftState = {
      phase: 'innings2', target: 2,
      openers2: { striker: 'Batter 1', nonStriker: 'Batter 2', bowler: 'Bowler' },
    };
  }
  if (kind === 'test-quick') {
    return { se_quickmatches: [{ ...match, id: 300, sport: 'cricket', team1: 'Alpha', team2: 'Beta', team1Name: 'Alpha', team2Name: 'Beta' }] };
  }
  return {
    se_cricket: [{
      id: 100, name: 'Cricket Cup', type: 'round-robin', mode: 'tournament', phase: 'group',
      format: match.format, winnerMode: 'table-topper', knockoutMatches: [],
      teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }], matches: [match],
    }],
  };
}
