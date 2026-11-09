import { getSportById } from '../models/sportRegistry';
import { normalizeNonTeamWinner } from './tournamentSync';

export function cloudHistoryEntry(match) {
  return {
    id: `cloud-${match._id}`, clientMatchId: match.clientMatchId, cloudOnly: true,
    source: match.clientMatchId?.startsWith('quick:') ? 'quick'
      : match.clientMatchId?.startsWith('tournament:') ? 'tournament' : 'account',
    sport: match.sport, sportName: getSportById(match.sport)?.name || match.sport,
    team1: match.team1, team2: match.team2,
    // The account stores a result summary, not a resumable scoring board.
    score: `${match.score1} - ${match.score2}`,
    winner: match.resultType === 'abandoned' ? null : normalizeNonTeamWinner(match.winner),
    resultType: match.resultType, elapsedSeconds: match.duration,
    date: new Date(match.date).toISOString(),
  };
}

export function mergeAccountHistory(local, cloud, ownerId, userId, ownership = null) {
  const entries = new Map();
  for (const match of local) {
    const owners = ownership?.get(match.clientMatchId);
    if (owners && [...owners].some(owner => owner !== ownerId && owner !== userId)) continue;
    if (match.syncOwnerId && match.syncOwnerId !== ownerId && match.syncOwnerId !== userId) continue;
    if (!match.syncOwnerId && !owners?.size && !ownership && !match.isLegacy) continue;
    entries.set(match.clientMatchId || match.id, match);
  }
  for (const match of cloud) {
    if (!ownerId || !userId || match.accountOwnerId !== ownerId || match.operatedBy !== userId) continue;
    const key = match.clientMatchId || `cloud-${match._id}`;
    const existing = entries.get(key);
    if (!existing || existing.sync?.status === 'synced') entries.set(key, cloudHistoryEntry(match));
  }
  return [...entries.values()].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
