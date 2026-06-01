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
 * @param {object} knockoutConfig - { teamsAdvancing: 2..8, thirdPlaceMatch: boolean }
 * @returns {Array} Knockout match objects with round/label fields
 */
export function generateKnockoutMatches(standings, knockoutConfig) {
  const { teamsAdvancing, thirdPlaceMatch } = knockoutConfig;
  const ts = Date.now();
  const matches = [];

  if (teamsAdvancing === 3) {
    const playInId = `${ts}-play-in-1`;
    const playInMatch = {
      id: playInId,
      round: 'play-in-1',
      label: 'Play-in 1',
      team1Id: standings[1]?.teamId || null,
      team2Id: standings[2]?.teamId || null,
      status: 'pending',
      winner: null,
    };
    const finalMatch = {
      id: `${ts}-final`,
      round: 'final',
      label: 'Final',
      team1Id: standings[0]?.teamId || null,
      team2Id: null,
      status: 'pending',
      winner: null,
      sourceMatchIds: [playInId],
      sourceSlots: ['team2Id'],
    };
    const thirdPlaceMatchConfig = {
      id: `${ts}-third`,
      round: 'third-place',
      label: '3rd Place',
      team1Id: null,
      team2Id: null,
      status: 'pending',
      winner: null,
      sourceMatchIds: [playInId, `${ts}-final`],
      sourceSlots: ['team1Id', 'team2Id'],
    };

    return thirdPlaceMatch && teamsAdvancing >= 4
      ? [playInMatch, finalMatch, thirdPlaceMatchConfig]
      : [playInMatch, finalMatch];
  } else if (teamsAdvancing > 4) {
    const seeds = standings.slice(0, teamsAdvancing);
    const addMatch = ({ id, round, label, team1Id = null, team2Id = null, sourceMatchIds = [], sourceSlots = [] }) => {
      matches.push({
        id: `${ts}-${id}`,
        round,
        label,
        team1Id,
        team2Id,
        status: 'pending',
        winner: null,
        sourceMatchIds,
        sourceSlots,
      });
    };

    const sourcePrefix = teamsAdvancing === 8 ? 'quarter' : 'play-in';
    const sourceLabel = teamsAdvancing === 8 ? 'Quarter-final' : 'Play-in';
    const firstRoundPairs = [[1, 8], [4, 5], [2, 7], [3, 6]];
    const semiSlots = [[], []];
    let sourceIndex = 0;

    firstRoundPairs.forEach(([a, b], index) => {
      const teamA = seeds[a - 1]?.teamId || null;
      const teamB = seeds[b - 1]?.teamId || null;
      const semiIndex = index < 2 ? 0 : 1;

      if (teamA && teamB) {
        sourceIndex += 1;
        const sourceId = `${sourcePrefix}-${sourceIndex}`;
        addMatch({
          id: sourceId,
          round: sourceId,
          label: `${sourceLabel} ${sourceIndex}`,
          team1Id: teamA,
          team2Id: teamB,
        });
        semiSlots[semiIndex].push({ sourceId: `${ts}-${sourceId}` });
      } else {
        semiSlots[semiIndex].push({ teamId: teamA || teamB });
      }
    });

    const addSemi = (semiNumber, slots) => {
      const sourceMatchIds = [];
      const sourceSlots = [];
      const slotToTeamId = (slot, slotName) => {
        if (slot?.sourceId) {
          sourceMatchIds.push(slot.sourceId);
          sourceSlots.push(slotName);
          return null;
        }
        return slot?.teamId || null;
      };

      addMatch({
        id: `semi-${semiNumber}`,
        round: `semi-${semiNumber}`,
        label: `Semi-final ${semiNumber}`,
        team1Id: slotToTeamId(slots[0], 'team1Id'),
        team2Id: slotToTeamId(slots[1], 'team2Id'),
        sourceMatchIds,
        sourceSlots,
      });
    };

    addSemi(1, semiSlots[0]);
    addSemi(2, semiSlots[1]);

    addMatch({
      id: 'final',
      round: 'final',
      label: 'Final',
      sourceMatchIds: [`${ts}-semi-1`, `${ts}-semi-2`],
      sourceSlots: ['team1Id', 'team2Id'],
    });
    if (thirdPlaceMatch) {
      addMatch({
        id: 'third',
        round: 'third-place',
        label: '3rd Place',
        sourceMatchIds: [`${ts}-semi-1`, `${ts}-semi-2`],
        sourceSlots: ['team1Id', 'team2Id'],
      });
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
