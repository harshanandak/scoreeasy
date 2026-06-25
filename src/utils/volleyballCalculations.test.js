import {
  validateSetScore,
  validateSingleSetScore,
  getMatchWinner,
  getMultiSetWinner,
  calculateVolleyballStandings,
  POINTS_PRESETS,
  SET_FORMATS,
} from './volleyballCalculations';

// ─── validateSetScore ──────────────────────────────────────────────────────────

describe('validateSetScore', () => {
  it('valid score: 25-20 (standard set)', () => {
    expect(validateSetScore(25, 20)).toBe(true);
  });

  it('valid score: 25-23 (close set)', () => {
    expect(validateSetScore(25, 23)).toBe(true);
  });

  it('invalid: winner below target (20-15)', () => {
    expect(validateSetScore(20, 15)).toBe(false);
  });

  it('invalid: tied score (25-25)', () => {
    expect(validateSetScore(25, 25)).toBe(false);
  });

  it('invalid: win by only 1 (25-24)', () => {
    expect(validateSetScore(25, 24)).toBe(false);
  });

  it('valid deuce: 26-24', () => {
    expect(validateSetScore(26, 24)).toBe(true);
  });

  it('valid deuce: 30-28', () => {
    expect(validateSetScore(30, 28)).toBe(true);
  });

  it('invalid deuce: 27-26 (only 1 apart)', () => {
    expect(validateSetScore(27, 26)).toBe(false);
  });

  it('reversed scores still valid: 20-25', () => {
    expect(validateSetScore(20, 25)).toBe(true);
  });

  it('decider set: target is 15', () => {
    expect(validateSetScore(15, 10, 25, true)).toBe(true);
  });

  it('decider set: 15-13 valid', () => {
    expect(validateSetScore(15, 13, 25, true)).toBe(true);
  });

  it('decider set: 16-14 valid (deuce)', () => {
    expect(validateSetScore(16, 14, 25, true)).toBe(true);
  });

  it('decider set: 14-12 invalid (below 15)', () => {
    expect(validateSetScore(14, 12, 25, true)).toBe(false);
  });

  it('custom minPoints: 21-19 valid', () => {
    expect(validateSetScore(21, 19, 21)).toBe(true);
  });

  it('custom minPoints: 20-18 invalid', () => {
    expect(validateSetScore(20, 18, 21)).toBe(false);
  });
});

// ─── validateSingleSetScore ────────────────────────────────────────────────────

describe('validateSingleSetScore', () => {
  it('valid: 10-5 (default target 10)', () => {
    expect(validateSingleSetScore(10, 5)).toBe(true);
  });

  it('invalid: 9-5 (below target)', () => {
    expect(validateSingleSetScore(9, 5)).toBe(false);
  });

  it('invalid: tied at target (10-10)', () => {
    expect(validateSingleSetScore(10, 10)).toBe(false);
  });

  it('invalid: 11-10 (only a 1-point lead — win-by-2 not met)', () => {
    expect(validateSingleSetScore(11, 10)).toBe(false);
  });

  it('valid: 12-10 (deuce resolved by a clear 2-point lead)', () => {
    expect(validateSingleSetScore(12, 10)).toBe(true);
  });

  it('invalid: 25-24 (reached target but only a 1-point lead)', () => {
    expect(validateSingleSetScore(25, 24, 25)).toBe(false);
  });

  it('valid: 30-29 honours a hard cap (badminton) regardless of margin', () => {
    expect(validateSingleSetScore(30, 29, 21, 2, 30)).toBe(true);
  });

  it('invalid: both at or above target but max < target+1 (10-10)', () => {
    expect(validateSingleSetScore(10, 10, 10)).toBe(false);
  });

  it('valid with custom target: 15-12', () => {
    expect(validateSingleSetScore(15, 12, 15)).toBe(true);
  });
});

// ─── getMatchWinner ────────────────────────────────────────────────────────────

describe('getMatchWinner', () => {
  it('returns team1Id when team1 wins', () => {
    const match = { team1Id: 'a', team2Id: 'b', score1: 3, score2: 1 };
    expect(getMatchWinner(match)).toBe('a');
  });

  it('returns team2Id when team2 wins', () => {
    const match = { team1Id: 'a', team2Id: 'b', score1: 1, score2: 3 };
    expect(getMatchWinner(match)).toBe('b');
  });

  it('returns null when scores are null', () => {
    const match = { team1Id: 'a', team2Id: 'b', score1: null, score2: null };
    expect(getMatchWinner(match)).toBeNull();
  });

  it('returns null when scores are tied', () => {
    const match = { team1Id: 'a', team2Id: 'b', score1: 2, score2: 2 };
    expect(getMatchWinner(match)).toBeNull();
  });
});

// ─── getMultiSetWinner ─────────────────────────────────────────────────────────

describe('getMultiSetWinner', () => {
  it('returns "team1" when team1 wins required sets (best of 3)', () => {
    const sets = [
      { score1: 25, score2: 20 },
      { score1: 25, score2: 18 },
    ];
    expect(getMultiSetWinner(sets, 2)).toBe('team1');
  });

  it('returns "team2" when team2 wins required sets (best of 3)', () => {
    const sets = [
      { score1: 20, score2: 25 },
      { score1: 18, score2: 25 },
    ];
    expect(getMultiSetWinner(sets, 2)).toBe('team2');
  });

  it('returns null when no winner yet', () => {
    const sets = [
      { score1: 25, score2: 20 },
      { score1: 18, score2: 25 },
    ];
    // 1-1 in best of 3 (need 2 to win)
    expect(getMultiSetWinner(sets, 2)).toBeNull();
  });

  it('best of 5: team1 wins 3-2', () => {
    const sets = [
      { score1: 25, score2: 20 },
      { score1: 18, score2: 25 },
      { score1: 25, score2: 23 },
      { score1: 20, score2: 25 },
      { score1: 15, score2: 12 },
    ];
    expect(getMultiSetWinner(sets, 3)).toBe('team1');
  });

  it('best of 5: team2 wins 3-0', () => {
    const sets = [
      { score1: 20, score2: 25 },
      { score1: 18, score2: 25 },
      { score1: 22, score2: 25 },
    ];
    expect(getMultiSetWinner(sets, 3)).toBe('team2');
  });

  it('returns null for empty sets', () => {
    expect(getMultiSetWinner([], 2)).toBeNull();
  });
});

// ─── calculateVolleyballStandings ──────────────────────────────────────────────

describe('calculateVolleyballStandings', () => {
  const teams = [
    { id: 't1', name: 'Team A' },
    { id: 't2', name: 'Team B' },
    { id: 't3', name: 'Team C' },
  ];

  it('returns zeroed stats for no matches', () => {
    const standings = calculateVolleyballStandings(teams, []);
    expect(standings).toHaveLength(3);
    standings.forEach(s => {
      expect(s.played).toBe(0);
      expect(s.won).toBe(0);
      expect(s.lost).toBe(0);
      expect(s.matchPoints).toBe(0);
    });
  });

  it('skips matches with null scores', () => {
    const matches = [{ team1Id: 't1', team2Id: 't2', score1: null, score2: null }];
    const standings = calculateVolleyballStandings(teams, matches);
    standings.forEach(s => expect(s.played).toBe(0));
  });

  it('awards 2 match points for a win', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 3, score2: 1 },
    ];

    const standings = calculateVolleyballStandings(teams, matches);
    const t1 = standings.find(s => s.teamId === 't1');
    const t2 = standings.find(s => s.teamId === 't2');

    expect(t1.won).toBe(1);
    expect(t1.matchPoints).toBe(2);
    expect(t2.lost).toBe(1);
    expect(t2.matchPoints).toBe(0);
  });

  it('calculates point differential', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 3, score2: 1 },
    ];

    const standings = calculateVolleyballStandings(teams, matches);
    const t1 = standings.find(s => s.teamId === 't1');
    expect(t1.diff).toBe(2); // 3 - 1
    const t2 = standings.find(s => s.teamId === 't2');
    expect(t2.diff).toBe(-2); // 1 - 3
  });

  it('sorts by matchPoints desc, then won desc, then diff desc', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 3, score2: 0 },
      { team1Id: 't3', team2Id: 't2', score1: 3, score2: 2 },
    ];

    const standings = calculateVolleyballStandings(teams, matches);
    // t1: 2pts, won=1, diff=+3
    // t3: 2pts, won=1, diff=+1
    // t2: 0pts
    expect(standings[0].teamId).toBe('t1');
    expect(standings[1].teamId).toBe('t3');
    expect(standings[2].teamId).toBe('t2');
  });

  it('accumulates stats across multiple matches', () => {
    const matches = [
      { team1Id: 't1', team2Id: 't2', score1: 3, score2: 1 },
      { team1Id: 't1', team2Id: 't3', score1: 3, score2: 0 },
    ];

    const standings = calculateVolleyballStandings(teams, matches);
    const t1 = standings.find(s => s.teamId === 't1');
    expect(t1.played).toBe(2);
    expect(t1.won).toBe(2);
    expect(t1.matchPoints).toBe(4);
    expect(t1.pointsFor).toBe(6);
    expect(t1.pointsAgainst).toBe(1);
  });
});

// ─── Constants ─────────────────────────────────────────────────────────────────

describe('POINTS_PRESETS', () => {
  it('has 4 presets', () => {
    expect(POINTS_PRESETS).toHaveLength(4);
  });

  it('includes 25 pts option', () => {
    expect(POINTS_PRESETS.some(p => p.value === 25)).toBe(true);
  });
});

describe('SET_FORMATS', () => {
  it('has 3 formats', () => {
    expect(SET_FORMATS).toHaveLength(3);
  });

  it('includes single set, bo3, bo5', () => {
    expect(SET_FORMATS[0].value).toBe('single');
    expect(SET_FORMATS[1].value).toBe('bo3');
    expect(SET_FORMATS[2].value).toBe('bo5');
  });

  it('bo3 requires 2 sets to win', () => {
    const bo3 = SET_FORMATS.find(f => f.value === 'bo3');
    expect(bo3.setsToWin).toBe(2);
  });

  it('bo5 requires 3 sets to win', () => {
    const bo5 = SET_FORMATS.find(f => f.value === 'bo5');
    expect(bo5.setsToWin).toBe(3);
  });
});
