import { useState } from 'react';
import { normalizeMatchForConvex } from '../utils/normalizeMatch';
import { enqueueMatchSave } from '../utils/pendingMatchSaves';
import { matchSaveOwner, usePendingMatchSaves } from './usePendingMatchSaves';

export function buildQuickMatchClientId(sport, matchId) {
  return `quick:${sport}:${matchId}`;
}

export function enqueueQuickMatchSave({ sport, isAuthenticated, user, clerkUser, team1Players = [], team2Players = [], isRefereeing }, match) {
  const id = match.clientMatchId || buildQuickMatchClientId(sport, match.id);
  const ownerId = matchSaveOwner({ isAuthenticated, user, clerkUser });
  if (!ownerId) return { status: 'idle', clientMatchId: id };
  const tagged = (players) => players.filter((player) => player?.type === 'user' && player?.userId).map((player) => player.userId);
  const payload = {
    ...normalizeMatchForConvex(match, sport), clientMatchId: id,
    team1Players: tagged(team1Players), team2Players: tagged(team2Players),
    matchRole: isRefereeing ? 'refereeing' : 'playing',
  };
  enqueueMatchSave(ownerId, payload, match.id);
  return { status: 'pending', clientMatchId: id };
}

export function useMatchSync({ sport, isAuthenticated, user, clerkUser, team1Players = [], team2Players = [], isRefereeing }) {
  const queue = usePendingMatchSaves({ isAuthenticated, user, clerkUser });
  const [current, setCurrent] = useState(null);
  const pending = queue.records.find((entry) => entry.payload.clientMatchId === current?.id);
  const syncState = !isAuthenticated || !current || current.ownerId !== queue.ownerId ? 'idle'
    : pending ? (navigator.onLine === false && !pending.terminal ? 'pending' : pending.state) : 'synced';

  const syncMatch = async (match) => {
    const result = enqueueQuickMatchSave({ sport, isAuthenticated, user, clerkUser, team1Players, team2Players, isRefereeing }, match);
    const id = result.clientMatchId;
    if (result.status === 'idle') return result;
    setCurrent({ id, ownerId: queue.ownerId });
    return queue.send(id);
  };

  return {
    syncState,
    syncError: syncState === 'failed' ? "Couldn't save" : '',
    syncMatch,
    retrySync: () => queue.retry(current?.id),
    resetSync: () => setCurrent(null),
  };
}
