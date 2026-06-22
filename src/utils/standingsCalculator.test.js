import { calculateSetsStandings, calculateGoalsStandings } from './standingsCalculator';

// ─── Sets-Based Standings ──────────────────────────────────────────────────────

describe('calculateSetsStandings', () => {
  const teams = [
    { id: 't1', name: 'Team A' },
    { id: 't2', name: 'Team B' },
    { id: 't3', name: 'Team C' },
  ];

  it('returns all teams with zero stats when no matches played', () => {
    const standings = calculateSetsStandings(teams, [], {});
    expect(standings).toHaveLength(3);
    standings.forEach(s => {
      expect(s.played).toBe(0);
      expect(s.won).toBe(0);
      expect(s.lost).toBe(0);
      expect(s.setsWon).toBe(0);
      expect(s.setsLost).toBe(0);
      expect(s.pointsFor).toBe(0);
      expect(s.pointsAgainst).toBe(0);
      expect(s.diff).toBe(0);
      expect(s.matchPoints).toBe(0);
    });
  });

  it('counts a tennis match (mapped score1/score2 incl a 7-6 tiebreak set)', () => {
    // Shape the tennis tournament save emits after P0-4/P1-9: each set carries
    // score1/score2 (= games) and a tiebreak-won set reads 7-6, not 6-6.
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        sets: [
          { score1: 6, score2: 4, games1: 6, games2: 4 },
          { score1: 7, score2: 6, games1: 7, games2: 6, isTiebreak: true, tiebreakPoints1: 7, tiebreakPoints2: 5 },
        ],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});
    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    expect(t1.setsWon).toBe(2);
    expect(t1.setsLost).toBe(0);
    expect(t1.won).toBe(1);
    expect(t1.pointsFor).toBe(13);
    expect(t1.pointsAgainst).toBe(10);
    expect(t1.matchPoints).toBe(2);
    expect(t2.setsWon).toBe(0);
    expect(t2.lost).toBe(1);
  });

  it('correctly calculates a single completed match', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        sets: [
          { score1: 25, score2: 20 },
          { score1: 25, score2: 18 },
        ],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});

    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    expect(t1.played).toBe(1);
    expect(t1.won).toBe(1);
    expect(t1.lost).toBe(0);
    expect(t1.setsWon).toBe(2);
    expect(t1.setsLost).toBe(0);
    expect(t1.pointsFor).toBe(50);
    expect(t1.pointsAgainst).toBe(38);
    expect(t1.matchPoints).toBe(2);

    expect(t2.played).toBe(1);
    expect(t2.won).toBe(0);
    expect(t2.lost).toBe(1);
    expect(t2.setsWon).toBe(0);
    expect(t2.setsLost).toBe(2);
    expect(t2.matchPoints).toBe(0);
  });

  it('skips pending matches', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'pending',
        sets: [],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});
    standings.forEach(s => {
      expect(s.played).toBe(0);
    });
  });

  it('skips matches with no sets', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        sets: [],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});
    standings.forEach(s => {
      expect(s.played).toBe(0);
    });
  });

  it('sorts by matchPoints desc, then set diff desc, then point diff desc', () => {
    // A beats B 2-0, C beats B 2-1 (more sets lost for C)
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        sets: [
          { score1: 25, score2: 20 },
          { score1: 25, score2: 18 },
        ],
      },
      {
        team1Id: 't3',
        team2Id: 't2',
        status: 'completed',
        sets: [
          { score1: 25, score2: 23 },
          { score1: 20, score2: 25 },
          { score1: 15, score2: 10 },
        ],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});

    // A and C both won 1, matchPoints = 2 each
    // A: setsWon 2, setsLost 0, setDiff = +2
    // C: setsWon 2, setsLost 1, setDiff = +1
    // A should come first
    expect(standings[0].teamId).toBe('t1');
    expect(standings[1].teamId).toBe('t3');
    expect(standings[2].teamId).toBe('t2');
  });

  it('handles a split sets result', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        sets: [
          { score1: 25, score2: 20 },
          { score1: 18, score2: 25 },
          { score1: 15, score2: 12 },
        ],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});
    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    expect(t1.setsWon).toBe(2);
    expect(t1.setsLost).toBe(1);
    expect(t2.setsWon).toBe(1);
    expect(t2.setsLost).toBe(2);
    expect(t1.matchPoints).toBe(2);
    expect(t2.matchPoints).toBe(0);
  });

  it('calculates point differential correctly', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        sets: [
          { score1: 25, score2: 23 },
        ],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});
    const t1 = standings.find(s => s.teamId === 't1');
    expect(t1.diff).toBe(2); // 25 - 23
  });

  it('handles multiple matches accumulating stats', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        sets: [{ score1: 25, score2: 20 }],
      },
      {
        team1Id: 't1',
        team2Id: 't3',
        status: 'completed',
        sets: [{ score1: 25, score2: 18 }],
      },
    ];

    const standings = calculateSetsStandings(teams, matches, {});
    const t1 = standings.find(s => s.teamId === 't1');
    expect(t1.played).toBe(2);
    expect(t1.won).toBe(2);
    expect(t1.matchPoints).toBe(4);
    expect(t1.pointsFor).toBe(50);
  });
});

// ─── Goals-Based Standings ─────────────────────────────────────────────────────

describe('calculateGoalsStandings', () => {
  const teams = [
    { id: 't1', name: 'Team A' },
    { id: 't2', name: 'Team B' },
    { id: 't3', name: 'Team C' },
  ];

  const footballConfig = {
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    drawAllowed: true,
  };

  const basketballConfig = {
    winPoints: 2,
    lossPoints: 0,
    drawAllowed: false,
  };

  it('returns all teams with zero stats when no matches played', () => {
    const standings = calculateGoalsStandings(teams, [], footballConfig);
    expect(standings).toHaveLength(3);
    standings.forEach(s => {
      expect(s.played).toBe(0);
      expect(s.won).toBe(0);
      expect(s.drawn).toBe(0);
      expect(s.lost).toBe(0);
      expect(s.goalsFor).toBe(0);
      expect(s.goalsAgainst).toBe(0);
      expect(s.goalDiff).toBe(0);
      expect(s.points).toBe(0);
    });
  });

  it('correctly calculates a win (football: 3 pts)', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 3, score2: 1, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(teams, matches, footballConfig);
    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    expect(t1.won).toBe(1);
    expect(t1.points).toBe(3);
    expect(t1.goalsFor).toBe(3);
    expect(t1.goalsAgainst).toBe(1);
    expect(t1.goalDiff).toBe(2);

    expect(t2.lost).toBe(1);
    expect(t2.points).toBe(0);
    expect(t2.goalDiff).toBe(-2);
  });

  it('correctly calculates a draw (football: 1 pt each)', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 2, score2: 2, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(teams, matches, footballConfig);
    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    expect(t1.drawn).toBe(1);
    expect(t1.points).toBe(1);
    expect(t2.drawn).toBe(1);
    expect(t2.points).toBe(1);
  });

  it('does not count draws when drawAllowed is false', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 50, score2: 50, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(teams, matches, basketballConfig);
    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    // With drawAllowed false, a tie score doesn't award draw points
    expect(t1.drawn).toBe(0);
    expect(t2.drawn).toBe(0);
    expect(t1.points).toBe(0);
    expect(t2.points).toBe(0);
  });

  it('uses basketball config (2 pts for win)', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 100, score2: 90, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(teams, matches, basketballConfig);
    const t1 = standings.find(s => s.teamId === 't1');
    expect(t1.points).toBe(2);
  });

  it('skips pending matches', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 3, score2: 1, status: 'pending' },
    ];

    const standings = calculateGoalsStandings(teams, matches, footballConfig);
    standings.forEach(s => expect(s.played).toBe(0));
  });

  it('skips matches with null scores', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: null, score2: null, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(teams, matches, footballConfig);
    standings.forEach(s => expect(s.played).toBe(0));
  });

  it('sorts by points desc, then goalDiff desc, then goalsFor desc', () => {
    // A beats B 3-1, C beats B 1-0
    // A: 3 pts, GD +2, GF 3
    // C: 3 pts, GD +1, GF 1
    // B: 0 pts
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 3, score2: 1, status: 'completed' },
      { team1Id: 't3', team2Id: 't2', score1: 1, score2: 0, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(teams, matches, footballConfig);
    expect(standings[0].teamId).toBe('t1'); // 3 pts, GD +2
    expect(standings[1].teamId).toBe('t3'); // 3 pts, GD +1
    expect(standings[2].teamId).toBe('t2'); // 0 pts
  });

  it('tiebreaks by goalsFor when points and GD are equal', () => {
    // A beats B 2-0, C beats B 4-2 => same GD (+2) same pts (3), but C has more GF
    // Wait -- A and C don't play each other here, so A has 1 match (3pts, GD+2, GF 2)
    // and C has 1 match (3pts, GD+2, GF 4). C should be above A.
    const fourTeams = [
      { id: 't1', name: 'Team A' },
      { id: 't2', name: 'Team B' },
      { id: 't3', name: 'Team C' },
      { id: 't4', name: 'Team D' },
    ];

    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 2, score2: 0, status: 'completed' },
      { team1Id: 't3', team2Id: 't4', score1: 4, score2: 2, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(fourTeams, matches, footballConfig);
    // Both t1 and t3 have 3 pts, GD +2
    // t3 has GF 4, t1 has GF 2 => t3 first
    expect(standings[0].teamId).toBe('t3');
    expect(standings[1].teamId).toBe('t1');
  });

  it('uses default config values when not provided', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 1, score2: 0, status: 'completed' },
    ];

    // Config with no explicit values -- defaults: winPoints=2, drawPoints=1, lossPoints=0, drawAllowed=false
    const standings = calculateGoalsStandings(teams, matches, {});
    const t1 = standings.find(s => s.teamId === 't1');
    expect(t1.points).toBe(2); // default winPoints is 2
  });

  it('handles 0-0 draw correctly', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 0, score2: 0, status: 'completed' },
    ];

    const standings = calculateGoalsStandings(teams, matches, footballConfig);
    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    expect(t1.drawn).toBe(1);
    expect(t2.drawn).toBe(1);
    expect(t1.goalDiff).toBe(0);
    expect(t2.goalDiff).toBe(0);
    expect(t1.points).toBe(1);
    expect(t2.points).toBe(1);
  });
});
