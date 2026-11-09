import { getSportsList } from '../models/sportRegistry';
import { loadCompletedQuickMatches, loadSportTournaments } from './storage';
import { normalizeMatchForConvex } from './normalizeMatch';
import { buildTournamentConvexPayload, getTournamentMatches, isTournamentMatchCompleted, tournamentCompletionId } from './tournamentSync';
import { enqueueMatchSave, isMatchSaveConfirmed, loadMatchSaveLocal } from './pendingMatchSaves';
import { guestClaimKey, guestClaims, readGuestClaim, writeGuestClaim } from './guestMatchOwnership';

export function claimGuestMatchSaves(ownerId) {
  if (!ownerId) return [];
  const claimed = [];
  const claim = (match, payload, quickMatchId, tournamentMatch) => {
    if (match.syncOwnerId) return;
    const clientMatchId = payload.clientMatchId;
    // An unreadable or damaged existing claim cannot be treated as an unclaimed match.
    let exists;
    try { exists = localStorage.getItem(guestClaimKey(clientMatchId)) !== null; } catch { return; }
    const prior = readGuestClaim(clientMatchId);
    if (exists && prior?.ownerId !== ownerId) return;
    if (!prior && !writeGuestClaim({ ownerId, clientMatchId, quickMatchId, tournamentMatch, noticePending: true })) return;
    const record = enqueueMatchSave(ownerId, payload, quickMatchId, tournamentMatch, tournamentMatch ? undefined : match);
    if (record && !prior) claimed.push(clientMatchId);
  };
  for (const match of loadCompletedQuickMatches()) {
    const clientMatchId = match.clientMatchId || `quick:${match.sport}:${match.id}`;
    const parsedDate = Date.parse(match.completedAt || match.date || match.createdAt);
    const payload = { ...normalizeMatchForConvex(match, match.sport), clientMatchId };
    if (Number.isFinite(parsedDate)) payload.date = parsedDate;
    claim(match, payload, match.id);
  }
  for (const sport of getSportsList()) {
    for (const tournament of loadSportTournaments(sport.storageKey)) {
      for (const match of getTournamentMatches(tournament)) {
        if (!isTournamentMatchCompleted(match, sport.engine, match.format || tournament.format)) continue;
        claim(match, buildTournamentConvexPayload({ sportId: sport.id, tournament, match }), undefined,
          { storageKey: sport.storageKey, tournamentId: tournament.id, matchId: match.id });
      }
    }
  }
  return claimed;
}

export function consumeGuestUploadNotice(ownerId) {
  let count = 0;
  for (const claim of guestClaims(ownerId)) {
    if (!claim.noticePending) continue;
    const local = loadMatchSaveLocal(claim);
    const confirmed = isMatchSaveConfirmed(ownerId, claim.clientMatchId, claim.tournamentMatch ? local?.sync?.completionId : undefined)
      || (local?.syncOwnerId === ownerId && local.sync?.status === 'synced'
        && (!claim.tournamentMatch || local.sync.completionId === tournamentCompletionId(local)));
    if (confirmed && writeGuestClaim({ ...claim, noticePending: false })) count += 1;
  }
  return count;
}
