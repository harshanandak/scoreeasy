// Round-robin tournament match generation (circle method)
// and knockout bracket generation

/**
 * Generate round-robin matches using the circle method (Berger tables).
 * Produces a schedule where no team plays in consecutive matches (for 4+ teams).
 * For odd team counts, a BYE placeholder is used and BYE matches are excluded.
 */
export function generateRoundRobinMatches(teams) {
  if (teams.length < 2) return [];

  const teamsCopy = [...teams];

  // Add BYE placeholder for odd number of teams
  if (teamsCopy.length % 2 !== 0) {
    teamsCopy.push({ id: '__BYE__', name: 'BYE' });
  }

  const n = teamsCopy.length;
  const rounds = n - 1;
  const halfSize = n / 2;

  // rotating = all teams except the first (which stays fixed)
  const rotating = teamsCopy.slice(1);

  const matches = [];
  const ts = Date.now();

  for (let round = 0; round < rounds; round++) {
    // Fixed team vs first in rotating array
    const roundPairs = [[teamsCopy[0], rotating[0]]];

    // Pair remaining from both ends
    for (let i = 1; i < halfSize; i++) {
      roundPairs.push([rotating[i], rotating[n - 1 - i]]);
    }

    // Add non-BYE matches
    for (const [t1, t2] of roundPairs) {
      if (t1.id !== '__BYE__' && t2.id !== '__BYE__') {
        matches.push({
          id: `${ts}-${round}-${matches.length}`,
          team1Id: t1.id,
          team2Id: t2.id,
          team1Score: null,
          team2Score: null,
          status: 'pending',
        });
      }
    }

    // Rotate: move last element to front
    rotating.unshift(rotating.pop());
  }

  return matches;
}

/**
 * Generate knockout matches from standings.
 * @param {Array} standings - Sorted standings array (index 0 = 1st place)
 * @param {object} knockoutConfig - { teamsAdvancing: 2|4, thirdPlaceMatch: boolean }
 * @returns {Array} Knockout match objects with round/label fields
 */
export function generateKnockoutMatches(standings, knockoutConfig) {
  const { teamsAdvancing, thirdPlaceMatch } = knockoutConfig;
  const ts = Date.now();
  const matches = [];

  if (teamsAdvancing > 4) {
    const seeds = standings.slice(0, teamsAdvancing);
    const addMatch = ({ id, round, label, team1Id = null, team2Id = null, sourceMatchIds = [] }) => {
      matches.push({
        id: `${ts}-${id}`,
        round,
        label,
        team1Id,
        team2Id,
        status: 'pending',
        winner: null,
        sourceMatchIds,
      });
    };

    if (teamsAdvancing === 8) {
      [[1, 8], [4, 5], [2, 7], [3, 6]].forEach(([a, b], index) => {
        addMatch({
          id: `quarter-${index + 1}`,
          round: `quarter-${index + 1}`,
          label: `Quarter-final ${index + 1}`,
          team1Id: seeds[a - 1]?.teamId || null,
          team2Id: seeds[b - 1]?.teamId || null,
        });
      });
      addMatch({ id: 'semi-1', round: 'semi-1', label: 'Semi-final 1', sourceMatchIds: [`${ts}-quarter-1`, `${ts}-quarter-2`] });
      addMatch({ id: 'semi-2', round: 'semi-2', label: 'Semi-final 2', sourceMatchIds: [`${ts}-quarter-3`, `${ts}-quarter-4`] });
    } else {
      const playInCount = teamsAdvancing - 4;
      const byeCount = 8 - teamsAdvancing;
      for (let i = 0; i < playInCount; i++) {
        addMatch({
          id: `play-in-${i + 1}`,
          round: `play-in-${i + 1}`,
          label: `Play-in ${i + 1}`,
          team1Id: seeds[byeCount + i]?.teamId || null,
          team2Id: seeds[teamsAdvancing - 1 - i]?.teamId || null,
        });
      }
      addMatch({
        id: 'semi-1',
        round: 'semi-1',
        label: 'Semi-final 1',
        team1Id: seeds[0]?.teamId || null,
        team2Id: playInCount >= 1 ? null : (seeds[3]?.teamId || null),
        sourceMatchIds: playInCount >= 1 ? [`${ts}-play-in-1`] : [],
      });
      addMatch({
        id: 'semi-2',
        round: 'semi-2',
        label: 'Semi-final 2',
        team1Id: seeds[1]?.teamId || null,
        team2Id: playInCount >= 2 ? null : (seeds[2]?.teamId || null),
        sourceMatchIds: playInCount >= 2 ? [`${ts}-play-in-2`] : [],
      });
    }

    addMatch({ id: 'final', round: 'final', label: 'Final', sourceMatchIds: [`${ts}-semi-1`, `${ts}-semi-2`] });
    if (thirdPlaceMatch) {
      addMatch({ id: 'third', round: 'third-place', label: '3rd Place', sourceMatchIds: [`${ts}-semi-1`, `${ts}-semi-2`] });
    }
    return matches;
  }

  if (teamsAdvancing === 2) {
    matches.push({
      id: `${ts}-final`,
      round: 'final',
      label: 'Final',
      team1Id: standings[0]?.teamId || null,
      team2Id: standings[1]?.teamId || null,
      status: 'pending',
      winner: null,
    });
  } else if (teamsAdvancing === 4) {
    // Semi-finals: 1st vs 4th, 2nd vs 3rd
    matches.push({
      id: `${ts}-semi-1`,
      round: 'semi-1',
      label: 'Semi-final 1',
      team1Id: standings[0]?.teamId || null,
      team2Id: standings[3]?.teamId || null,
      status: 'pending',
      winner: null,
    });
    matches.push({
      id: `${ts}-semi-2`,
      round: 'semi-2',
      label: 'Semi-final 2',
      team1Id: standings[1]?.teamId || null,
      team2Id: standings[2]?.teamId || null,
      status: 'pending',
      winner: null,
    });

    // Final (teams TBD until semis complete)
    matches.push({
      id: `${ts}-final`,
      round: 'final',
      label: 'Final',
      team1Id: null,
      team2Id: null,
      status: 'pending',
      winner: null,
    });

    // Optional 3rd place match
    if (thirdPlaceMatch) {
      matches.push({
        id: `${ts}-third`,
        round: 'third-place',
        label: '3rd Place',
        team1Id: null,
        team2Id: null,
        status: 'pending',
        winner: null,
      });
    }
  }

  return matches;
}

export function getTotalMatchCount(teamCount) {
  return (teamCount * (teamCount - 1)) / 2;
}

export function getCompletedMatchCount(matches) {
  return matches.filter(m => m.status === 'completed').length;
}
