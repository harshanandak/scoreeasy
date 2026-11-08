import { getSportById } from '../models/sportRegistry';
import { buildTournamentConvexPayload, getTournamentMatches } from '../utils/tournamentSync';
import { enqueueMatchSave } from '../utils/pendingMatchSaves';
import { useAuth } from './useAuth';
import { matchSaveOwner } from './usePendingMatchSaves';

export function useTournamentMatchSync({ sport, matchId }) {
  const ownerId = matchSaveOwner(useAuth());
  return (tournament) => {
    if (!ownerId || !tournament) return;
    const match = getTournamentMatches(tournament).find((entry) => String(entry.id) === String(matchId));
    if (!match) return;
    const payload = buildTournamentConvexPayload({ sportId: sport, tournament, match });
    enqueueMatchSave(ownerId, payload, undefined, {
      storageKey: getSportById(sport).storageKey, tournamentId: tournament.id, matchId: match.id,
    });
  };
}
