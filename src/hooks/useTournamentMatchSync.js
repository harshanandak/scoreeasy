import { getSportById } from '../models/sportRegistry';
import { buildTournamentConvexPayload, getTournamentMatches } from '../utils/tournamentSync';
import { enqueueMatchSave } from '../utils/pendingMatchSaves';
import { usePendingMatchSaves } from './usePendingMatchSaves';

export function useTournamentMatchSync({ sport, matchId }) {
  const queue = usePendingMatchSaves();
  return (tournament) => {
    if (!queue.ownerId || !tournament) return;
    const match = getTournamentMatches(tournament).find((entry) => String(entry.id) === String(matchId));
    if (!match) return;
    const payload = buildTournamentConvexPayload({ sportId: sport, tournament, match });
    enqueueMatchSave(queue.ownerId, payload, undefined, {
      storageKey: getSportById(sport).storageKey, tournamentId: tournament.id, matchId: match.id,
    });
    void queue.send(payload.clientMatchId);
  };
}
