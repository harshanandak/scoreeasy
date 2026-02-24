import {
  ballsToOvers,
  oversToDecimal,
  calculateRunRate,
  calculateNRR,
  getMatchWinner,
  calculateCricketPointsTable,
  OVERS_PRESETS,
} from './cricketCalculations';

describe('ballsToOvers', () => {
  it('converts exact overs (no remaining balls)', () => {
    expect(ballsToOvers(6)).toBe('1');
    expect(ballsToOvers(12)).toBe('2');
    expect(ballsToOvers(120)).toBe('20');
  });

  it('converts partial overs', () => {
    expect(ballsToOvers(1)).toBe('0.1');
    expect(ballsToOvers(3)).toBe('0.3');
    expect(ballsToOvers(7)).toBe('1.1');
    expect(ballsToOvers(10)).toBe('1.4');
    expect(ballsToOvers(11)).toBe('1.5');
  });

  it('handles 0 balls', () => {
    expect(ballsToOvers(0)).toBe('0');
  });
});

describe('oversToDecimal', () => {
  it('converts exact overs', () => {
    expect(oversToDecimal(6)).toBe(1);
    expect(oversToDecimal(12)).toBe(2);
    expect(oversToDecimal(120)).toBe(20);
  });

  it('converts partial overs to decimal', () => {
    expect(oversToDecimal(7)).toBeCloseTo(1 + 1 / 6, 5);
    expect(oversToDecimal(10)).toBeCloseTo(1 + 4 / 6, 5);
  });

  it('handles 0 balls', () => {
    expect(oversToDecimal(0)).toBe(0);
  });
});

describe('calculateRunRate', () => {
  it('returns 0 when balls is 0', () => {
    expect(calculateRunRate(100, 0)).toBe(0);
  });

  it('returns 0 when runs is 0', () => {
    expect(calculateRunRate(0, 30)).toBe(0);
  });

  it('calculates run rate correctly', () => {
    // 60 runs in 60 balls (10 overs) = 6.0 rpo
    expect(calculateRunRate(60, 60)).toBe(6);
  });

  it('calculates fractional run rates', () => {
    // 50 runs in 30 balls (5 overs) = 10.0 rpo
    expect(calculateRunRate(50, 30)).toBe(10);
  });

  it('handles single ball', () => {
    // 4 runs in 1 ball => (4*6)/1 = 24 rpo
    expect(calculateRunRate(4, 1)).toBe(24);
  });
});

describe('calculateNRR', () => {
  it('returns 0 when ballsFaced is 0', () => {
    expect(calculateNRR(100, 0, 50, 30)).toBe(0);
  });

  it('returns 0 when ballsBowled is 0', () => {
    expect(calculateNRR(100, 30, 50, 0)).toBe(0);
  });

  it('returns 0 when both are 0', () => {
    expect(calculateNRR(0, 0, 0, 0)).toBe(0);
  });

  it('calculates positive NRR (scoring faster than conceding)', () => {
    // Scored 120 in 120 balls (RR = 6), conceded 100 in 120 balls (RR = 5)
    // NRR = 6 - 5 = 1
    const nrr = calculateNRR(120, 120, 100, 120);
    expect(nrr).toBeCloseTo(1, 5);
  });

  it('calculates negative NRR', () => {
    // Scored 100 in 120 balls (RR = 5), conceded 120 in 120 balls (RR = 6)
    // NRR = 5 - 6 = -1
    const nrr = calculateNRR(100, 120, 120, 120);
    expect(nrr).toBeCloseTo(-1, 5);
  });

  it('returns 0 NRR when rates are equal', () => {
    const nrr = calculateNRR(60, 60, 60, 60);
    expect(nrr).toBeCloseTo(0, 5);
  });
});

describe('getMatchWinner', () => {
  it('returns team1Id when team1 scores more', () => {
    const match = {
      team1Id: 'a',
      team2Id: 'b',
      team1Score: { runs: 150 },
      team2Score: { runs: 120 },
    };
    expect(getMatchWinner(match)).toBe('a');
  });

  it('returns team2Id when team2 scores more', () => {
    const match = {
      team1Id: 'a',
      team2Id: 'b',
      team1Score: { runs: 100 },
      team2Score: { runs: 150 },
    };
    expect(getMatchWinner(match)).toBe('b');
  });

  it('returns "tie" when scores are equal', () => {
    const match = {
      team1Id: 'a',
      team2Id: 'b',
      team1Score: { runs: 120 },
      team2Score: { runs: 120 },
    };
    expect(getMatchWinner(match)).toBe('tie');
  });

  it('returns null when team1Score is missing', () => {
    const match = { team1Id: 'a', team2Id: 'b', team1Score: null, team2Score: { runs: 100 } };
    expect(getMatchWinner(match)).toBeNull();
  });

  it('returns null when team2Score is missing', () => {
    const match = { team1Id: 'a', team2Id: 'b', team1Score: { runs: 100 }, team2Score: null };
    expect(getMatchWinner(match)).toBeNull();
  });
});

describe('calculateCricketPointsTable', () => {
  const teams = [
    { id: 't1', name: 'Team A' },
    { id: 't2', name: 'Team B' },
  ];

  it('returns empty stats for no matches', () => {
    const table = calculateCricketPointsTable(teams, []);
    expect(table).toHaveLength(2);
    table.forEach(t => {
      expect(t.played).toBe(0);
      expect(t.won).toBe(0);
      expect(t.lost).toBe(0);
      expect(t.points).toBe(0);
      expect(t.nrr).toBe(0);
    });
  });

  it('awards 2 points for a win', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        team1Score: { runs: 150, balls: 120, allOut: false },
        team2Score: { runs: 120, balls: 120, allOut: false },
        format: { overs: 20 },
      },
    ];

    const table = calculateCricketPointsTable(teams, matches);
    const t1 = table.find(t => t.teamId === 't1');
    const t2 = table.find(t => t.teamId === 't2');

    expect(t1.won).toBe(1);
    expect(t1.points).toBe(2);
    expect(t2.lost).toBe(1);
    expect(t2.points).toBe(0);
  });

  it('awards 1 point each for a tie', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        team1Score: { runs: 100, balls: 60, allOut: false },
        team2Score: { runs: 100, balls: 60, allOut: false },
        format: { overs: 10 },
      },
    ];

    const table = calculateCricketPointsTable(teams, matches);
    const t1 = table.find(t => t.teamId === 't1');
    const t2 = table.find(t => t.teamId === 't2');

    expect(t1.tied).toBe(1);
    expect(t1.points).toBe(1);
    expect(t2.tied).toBe(1);
    expect(t2.points).toBe(1);
  });

  it('skips non-completed matches', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'in_progress',
        team1Score: { runs: 50, balls: 30, allOut: false },
        team2Score: { runs: 40, balls: 30, allOut: false },
      },
    ];

    const table = calculateCricketPointsTable(teams, matches);
    table.forEach(t => expect(t.played).toBe(0));
  });

  it('calculates NRR for each team', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        team1Score: { runs: 180, balls: 120, allOut: false },
        team2Score: { runs: 120, balls: 120, allOut: false },
        format: { overs: 20 },
      },
    ];

    const table = calculateCricketPointsTable(teams, matches);
    const t1 = table.find(t => t.teamId === 't1');
    expect(t1.nrr).toBeGreaterThan(0);
  });

  it('sorts by points desc, then NRR desc', () => {
    const threeTeams = [
      { id: 't1', name: 'Team A' },
      { id: 't2', name: 'Team B' },
      { id: 't3', name: 'Team C' },
    ];

    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        team1Score: { runs: 200, balls: 120, allOut: false },
        team2Score: { runs: 100, balls: 120, allOut: false },
        format: { overs: 20 },
      },
      {
        team1Id: 't3',
        team2Id: 't2',
        status: 'completed',
        team1Score: { runs: 150, balls: 120, allOut: false },
        team2Score: { runs: 100, balls: 120, allOut: false },
        format: { overs: 20 },
      },
    ];

    const table = calculateCricketPointsTable(threeTeams, matches);
    // t1 and t3 both have 2 pts, t1 has better NRR
    expect(table[0].teamId).toBe('t1');
    expect(table[1].teamId).toBe('t3');
    expect(table[2].teamId).toBe('t2');
  });

  it('uses totalBalls from format.overs for allOut teams', () => {
    const matches = [
      {
        team1Id: 't1',
        team2Id: 't2',
        status: 'completed',
        team1Score: { runs: 100, balls: 50, allOut: true },
        team2Score: { runs: 80, balls: 60, allOut: false },
        format: { overs: 10 },
      },
    ];

    const table = calculateCricketPointsTable(teams, matches);
    const t1 = table.find(t => t.teamId === 't1');
    // allOut team: ballsFaced should be format.overs * 6 = 60 (not 50)
    expect(t1.ballsFaced).toBe(60);
  });
});

describe('OVERS_PRESETS', () => {
  it('has correct presets', () => {
    expect(OVERS_PRESETS).toHaveLength(5);
    expect(OVERS_PRESETS[0]).toEqual({ label: '2 ov', value: 2 });
    expect(OVERS_PRESETS[3]).toEqual({ label: '20 ov', value: 20 });
    expect(OVERS_PRESETS[4]).toEqual({ label: '50 ov', value: 50 });
  });
});
