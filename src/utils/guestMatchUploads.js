import { getSportsList } from '../models/sportRegistry';
import { loadCompletedQuickMatches, loadSportTournaments } from './storage';
import { normalizeMatchForConvex } from './normalizeMatch';
import { buildTournamentConvexPayload, getTournamentMatches, isTournamentMatchCompleted, tournamentCompletionId } from './tournamentSync';
import { enqueueMatchSave, isMatchSaveConfirmed, loadMatchSaveLocal, pendingMatchSaveOwnership, pendingMatchSaves } from './pendingMatchSaves';
import { acquireGuestClaim, guestClaimKey, guestClaims, readGuestClaim, writeGuestClaim } from './guestMatchOwnership';
import { claimGuestStorage, withMatchStorageScope } from './accountStorage';

export async function claimGuestMatchSaves(ownerId) {
  if (!ownerId) return [];
  const run = async () => {
    const ownership = await pendingMatchSaveOwnership();
    await claimGuestStorage(ownerId, claim => {
      if ([...(ownership.get(claim.clientMatchId) || [])].some(owner => owner !== ownerId)) return false;
      const prior = readGuestClaim(claim.clientMatchId);
      return prior && prior.ownerId !== ownerId ? false : acquireGuestClaim(prior || claim);
    });
    return claimAvailableMatches(ownerId);
  };
  try { return await (navigator.locks?.request ? navigator.locks.request('se-guest-match-claims', run) : run()); }
  catch { return []; } // Unknown queue ownership or unavailable durable claim storage must fail closed.
}

const stableId = id => (typeof id === 'string' && id.trim() !== '') || (typeof id === 'number' && Number.isFinite(id));
const uniqueFixture = (tournament, match, fixtures) => stableId(tournament.id) && stableId(match.id)
  && fixtures.filter(entry => String(entry.id) === String(match.id)).length === 1;

export function unuploadedGuestTournamentResults() {
  const skipped = [];
  for (const sport of getSportsList()) for (const tournament of loadSportTournaments(sport.storageKey)) {
    const fixtures = getTournamentMatches(tournament);
    fixtures.forEach((match, index) => {
      if (!match.syncOwnerId && isTournamentMatchCompleted(match, sport.engine, match.format || tournament.format)
        && !uniqueFixture(tournament, match, fixtures)) skipped.push(`${tournament.name || sport.name} result ${index + 1}`);
    });
  }
  return skipped;
}

async function claimAvailableMatches(ownerId) {
  const ownership = await pendingMatchSaveOwnership();
  const claimed = [];
  const claim = async (match, payload, quickMatchId, tournamentMatch) => {
    if (match.sync?.status === 'synced' || (match.syncOwnerId && match.syncOwnerId !== ownerId)) return;
    const clientMatchId = payload.clientMatchId;
    if ([...(ownership.get(clientMatchId) || [])].some(owner => owner !== ownerId)) return;
    // An unreadable or damaged existing claim cannot be treated as an unclaimed match.
    let exists;
    try { exists = localStorage.getItem(guestClaimKey(clientMatchId)) !== null; } catch { return; }
    const prior = readGuestClaim(clientMatchId);
    if (exists && prior?.ownerId !== ownerId) return;
    if (prior && !await acquireGuestClaim(prior)) return;
    const alreadyQueued = pendingMatchSaves(ownerId).some(record => record.payload.clientMatchId === clientMatchId);
    const record = enqueueMatchSave(ownerId, payload, quickMatchId, tournamentMatch, tournamentMatch ? undefined : match);
    if (record && prior && !alreadyQueued) claimed.push(clientMatchId);
  };
  for (const match of withMatchStorageScope(ownerId, loadCompletedQuickMatches)) {
    const clientMatchId = match.clientMatchId || `quick:${match.sport}:${match.id}`;
    const parsedDate = Date.parse(match.completedAt || match.date || match.createdAt);
    const payload = { ...normalizeMatchForConvex(match, match.sport), clientMatchId };
    if (Number.isFinite(parsedDate)) payload.date = parsedDate;
    await claim(match, payload, match.id);
  }
  for (const sport of getSportsList()) {
    for (const tournament of withMatchStorageScope(ownerId, () => loadSportTournaments(sport.storageKey))) {
      const fixtures = getTournamentMatches(tournament);
      for (const match of fixtures) {
        if (!isTournamentMatchCompleted(match, sport.engine, match.format || tournament.format)) continue;
        if (!uniqueFixture(tournament, match, fixtures)) continue;
        const payload = buildTournamentConvexPayload({ sportId: sport.id, tournament, match });
        const tournamentMatch = { storageKey: sport.storageKey, tournamentId: tournament.id, matchId: match.id };
        const moved = readGuestClaim(`local:${sport.storageKey}:${tournament.id}`);
        if (moved?.ownerId === ownerId && !readGuestClaim(payload.clientMatchId)) {
          if (!await acquireGuestClaim({ ownerId, clientMatchId: payload.clientMatchId, tournamentMatch, noticePending: true })) continue;
        }
        await claim(match, payload, undefined, tournamentMatch);
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
