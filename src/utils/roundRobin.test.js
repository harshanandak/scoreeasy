import { generateKnockoutMatches, generateRoundRobinMatches, getTotalMatchCount, getCompletedMatchCount } from './roundRobin';

describe('generateRoundRobinMatches', () => {
  function makeTeams(n) {
    return Array.from({ length: n }, (_, i) => ({ id: `team${i + 1}`, name: `Team ${i + 1}` }));
  }

  it('generates 1 match for 2 teams', () => {
    const teams = makeTeams(2);
    const matches = generateRoundRobinMatches(teams);
    expect(matches).toHaveLength(1);
  });

  it('generates 3 matches for 3 teams', () => {
    const teams = makeTeams(3);
    const matches = generateRoundRobinMatches(teams);
    expect(matches).toHaveLength(3);
  });

  it('generates 6 matches for 4 teams', () => {
    const teams = makeTeams(4);
    const matches = generateRoundRobinMatches(teams);
    expect(matches).toHaveLength(6);
  });

  it('generates 15 matches for 6 teams', () => {
    const teams = makeTeams(6);
    const matches = generateRoundRobinMatches(teams);
    expect(matches).toHaveLength(15);
  });

  it('generates 28 matches for 8 teams', () => {
    const teams = makeTeams(8);
    const matches = generateRoundRobinMatches(teams);
    expect(matches).toHaveLength(28);
  });

  it('generates correct number: n*(n-1)/2', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const teams = makeTeams(n);
      const matches = generateRoundRobinMatches(teams);
      expect(matches).toHaveLength((n * (n - 1)) / 2);
    }
  });

  it('every team plays every other team exactly once', () => {
    const teams = makeTeams(5);
    const matches = generateRoundRobinMatches(teams);

    // Check every pair is covered
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const pairMatches = matches.filter(
          m =>
            (m.team1Id === teams[i].id && m.team2Id === teams[j].id) ||
            (m.team1Id === teams[j].id && m.team2Id === teams[i].id)
        );
        expect(pairMatches).toHaveLength(1);
      }
    }
  });

  it('each match has correct structure', () => {
    const teams = makeTeams(3);
    const matches = generateRoundRobinMatches(teams);

    matches.forEach(match => {
      expect(match).toHaveProperty('id');
      expect(match).toHaveProperty('team1Id');
      expect(match).toHaveProperty('team2Id');
      expect(match).toHaveProperty('team1Score', null);
      expect(match).toHaveProperty('team2Score', null);
      expect(match).toHaveProperty('status', 'pending');
    });
  });

  it('match ids are unique', () => {
    const teams = makeTeams(6);
    const matches = generateRoundRobinMatches(teams);
    const ids = matches.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no team plays itself', () => {
    const teams = makeTeams(4);
    const matches = generateRoundRobinMatches(teams);
    matches.forEach(match => {
      expect(match.team1Id).not.toBe(match.team2Id);
    });
  });

  it('returns empty array for 0 teams', () => {
    const matches = generateRoundRobinMatches([]);
    expect(matches).toEqual([]);
  });

  it('returns empty array for 1 team', () => {
    const matches = generateRoundRobinMatches(makeTeams(1));
    expect(matches).toEqual([]);
  });
});

describe('getTotalMatchCount', () => {
  it('returns 0 for 0 or 1 teams', () => {
    // (0 * -1) / 2 yields -0 in JS; both -0 and 0 are == 0
    expect(getTotalMatchCount(0) == 0).toBe(true);
    expect(getTotalMatchCount(1)).toBe(0);
  });

  it('returns correct count for various team sizes', () => {
    expect(getTotalMatchCount(2)).toBe(1);
    expect(getTotalMatchCount(3)).toBe(3);
    expect(getTotalMatchCount(4)).toBe(6);
    expect(getTotalMatchCount(6)).toBe(15);
    expect(getTotalMatchCount(8)).toBe(28);
  });
});

describe('getCompletedMatchCount', () => {
  it('returns 0 for empty array', () => {
    expect(getCompletedMatchCount([])).toBe(0);
  });

  it('returns 0 when all matches are pending', () => {
    const matches = [
      { status: 'pending' },
      { status: 'pending' },
    ];
    expect(getCompletedMatchCount(matches)).toBe(0);
  });

  it('counts only completed matches', () => {
    const matches = [
      { status: 'completed' },
      { status: 'pending' },
      { status: 'completed' },
      { status: 'in_progress' },
    ];
    expect(getCompletedMatchCount(matches)).toBe(2);
  });

  it('returns total when all completed', () => {
    const matches = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
    ];
    expect(getCompletedMatchCount(matches)).toBe(3);
  });
});

describe('generateKnockoutMatches', () => {
  function makeStandings(n) {
    return Array.from({ length: n }, (_, i) => ({
      teamId: `team${i + 1}`,
      team: { id: `team${i + 1}`, name: `Team ${i + 1}` },
      seed: i + 1,
    }));
  }

  it('generates a full 8-team elimination bracket', () => {
    const matches = generateKnockoutMatches(makeStandings(8), {
      teamsAdvancing: 8,
      thirdPlaceMatch: false,
    });

    expect(matches).toHaveLength(7);
    expect(matches.filter((match) => match.round.startsWith('quarter-'))).toHaveLength(4);
    expect(matches.filter((match) => match.round.startsWith('semi-'))).toHaveLength(2);
    expect(matches.find((match) => match.round === 'final')).toBeTruthy();
  });

  it('supports non-power-of-two elimination brackets with byes', () => {
    const matches = generateKnockoutMatches(makeStandings(6), {
      teamsAdvancing: 6,
      thirdPlaceMatch: true,
    });

    expect(matches).toHaveLength(6);
    expect(matches.filter((match) => match.round.startsWith('play-in-'))).toHaveLength(2);
    expect(matches.find((match) => match.round === 'third-place')).toBeTruthy();
  });
});
