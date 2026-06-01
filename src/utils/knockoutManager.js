// Knockout stage management utilities
// Shared logic for phase transitions, bracket seeding, and match discovery

import { generateKnockoutMatches } from './roundRobin';

/**
 * Check if all group stage matches are completed.
 */
export function isGroupStageComplete(matches) {
  return matches.length > 0 && matches.every(m => m.status === 'completed');
}

/**
 * Initialize the knockout stage from standings.
 * Generates knockout matches and transitions tournament phase.
 * Returns the tournament unchanged if knockouts are not configured or already initialized.
 */
export function initializeKnockoutStage(tournament, standings) {
  if (!tournament.knockoutConfig) return tournament;
  if (tournament.knockoutMatches && tournament.knockoutMatches.length > 0) return tournament;

  const knockoutMatches = generateKnockoutMatches(standings, tournament.knockoutConfig);

  return {
    ...tournament,
    phase: 'knockout',
    knockoutMatches,
  };
}

/**
 * After semi-finals complete, seed the final and 3rd-place matches
 * with the winners and losers.
 * Returns a new array if changes were made, or the same array if not.
 */
export function updateKnockoutBracket(knockoutMatches) {
  if (!knockoutMatches || knockoutMatches.length === 0) return knockoutMatches;

  const getSourceSlots = (match) => {
    if (Array.isArray(match.sourceSlots) && match.sourceSlots.length > 0) {
      return match.sourceSlots;
    }
    if (match.sourceMatchIds.length === 2) {
      return ['team1Id', 'team2Id'];
    }
    return [match.team1Id ? 'team2Id' : 'team1Id'];
  };

  const sourceLinkedMatches = knockoutMatches.filter(m => Array.isArray(m.sourceMatchIds) && m.sourceMatchIds.length > 0);
  if (sourceLinkedMatches.length > 0) {
    let changed = false;
    const updated = knockoutMatches.map((match) => {
      if (!Array.isArray(match.sourceMatchIds) || match.sourceMatchIds.length === 0 || match.status !== 'pending') {
        return match;
      }

      const sources = match.sourceMatchIds.map((sourceId) => knockoutMatches.find((candidate) => candidate.id === sourceId));
      if (sources.some((source) => source?.status !== 'completed' || !source?.winner || source?.winner === 'draw' || source?.winner === 'tie')) {
        const sourceSlots = getSourceSlots(match);
        const cleared = sourceSlots.reduce((next, slot) => ({ ...next, [slot]: null }), match);
        if (sourceSlots.every((slot) => cleared[slot] === match[slot])) return match;
        changed = true;
        return cleared;
      }

      const teamIds = match.round === 'third-place'
        ? sources.map((source) => source.winner === source.team1Id ? source.team2Id : source.team1Id)
        : sources.map((source) => source.winner);
      const sourceSlots = getSourceSlots(match);
      const nextMatch = sourceSlots.reduce((next, slot, index) => ({
        ...next,
        [slot]: teamIds[index] || null,
      }), match);
      if (nextMatch.team1Id === match.team1Id && nextMatch.team2Id === match.team2Id) return match;

      changed = true;
      return nextMatch;
    });

    if (changed) return updated;
  }

  const semi1 = knockoutMatches.find(m => m.round === 'semi-1');
  const semi2 = knockoutMatches.find(m => m.round === 'semi-2');

  // No semis = nothing to update (top-2 format)
  if (!semi1 || !semi2) return knockoutMatches;

  const bothSemisComplete = semi1.status === 'completed' && semi2.status === 'completed';

  if (!bothSemisComplete) {
    // If a semi was reset, clear the final/3rd-place team assignments
    const final_ = knockoutMatches.find(m => m.round === 'final');
    const third = knockoutMatches.find(m => m.round === 'third-place');
    const needsClear = (final_?.team1Id && final_.status === 'pending') ||
                       (third?.team1Id && third.status === 'pending');

    if (needsClear) {
      return knockoutMatches.map(m => {
        if ((m.round === 'final' || m.round === 'third-place') && m.status === 'pending') {
          return { ...m, team1Id: null, team2Id: null };
        }
        return m;
      });
    }
    return knockoutMatches;
  }

  const semi1Winner = semi1.winner;
  const semi2Winner = semi2.winner;
  const semi1Loser = semi1.winner === semi1.team1Id ? semi1.team2Id : semi1.team1Id;
  const semi2Loser = semi2.winner === semi2.team1Id ? semi2.team2Id : semi2.team1Id;

  let changed = false;

  const updated = knockoutMatches.map(m => {
    if (m.round === 'final' && m.status === 'pending' && (!m.team1Id || !m.team2Id)) {
      changed = true;
      return { ...m, team1Id: semi1Winner, team2Id: semi2Winner };
    }
    if (m.round === 'third-place' && m.status === 'pending' && (!m.team1Id || !m.team2Id)) {
      changed = true;
      return { ...m, team1Id: semi1Loser, team2Id: semi2Loser };
    }
    return m;
  });

  return changed ? updated : knockoutMatches;
}

/**
 * Check if the entire tournament is complete.
 */
export function isTournamentComplete(tournament) {
  if (!tournament.winnerMode || tournament.winnerMode === 'table-topper') {
    return tournament.matches.every(m => m.status === 'completed');
  }

  if (tournament.winnerMode === 'knockouts') {
    if (!tournament.knockoutMatches || tournament.knockoutMatches.length === 0) return false;

    const final_ = tournament.knockoutMatches.find(m => m.round === 'final');
    if (!final_ || final_.status !== 'completed') return false;

    // Check 3rd place match if required
    if (tournament.knockoutConfig?.thirdPlaceMatch) {
      const third = tournament.knockoutMatches.find(m => m.round === 'third-place');
      if (!third || third.status !== 'completed') return false;
    }

    return true;
  }

  return false;
}

/**
 * Get the tournament winner.
 * For knockouts: the final match winner.
 * For table-topper: returns null (caller should use standings[0]).
 */
export function getTournamentWinner(tournament) {
  if (tournament.winnerMode === 'knockouts') {
    const final_ = tournament.knockoutMatches?.find(m => m.round === 'final');
    if (final_?.status === 'completed' && final_.winner) {
      return tournament.teams.find(t => t.id === final_.winner) || null;
    }
  }
  return null;
}

/**
 * Find a match in either the group matches or knockout matches array.
 * Returns { match, isKnockout }.
 */
export function findMatchInTournament(tournament, matchId) {
  const groupMatch = tournament.matches.find(
    m => m.id === matchId || m.id === Number(matchId)
  );
  if (groupMatch) return { match: groupMatch, isKnockout: false };

  const koMatch = (tournament.knockoutMatches || []).find(
    m => m.id === matchId || m.id === Number(matchId)
  );
  if (koMatch) return { match: koMatch, isKnockout: true };

  return { match: null, isKnockout: false };
}

/**
 * Update a match in the correct array (group or knockout).
 * Returns the updated tournament object.
 */
export function updateMatchInTournament(tournament, matchId, updater) {
  const groupIdx = tournament.matches.findIndex(
    m => m.id === matchId || m.id === Number(matchId)
  );
  if (groupIdx >= 0) {
    const updatedMatches = tournament.matches.map((m, i) =>
      i === groupIdx ? updater(m) : m
    );
    return { ...tournament, matches: updatedMatches };
  }

  const koIdx = (tournament.knockoutMatches || []).findIndex(
    m => m.id === matchId || m.id === Number(matchId)
  );
  if (koIdx >= 0) {
    const updatedKO = tournament.knockoutMatches.map((m, i) =>
      i === koIdx ? updater(m) : m
    );
    return { ...tournament, knockoutMatches: updatedKO };
  }

  return tournament;
}
