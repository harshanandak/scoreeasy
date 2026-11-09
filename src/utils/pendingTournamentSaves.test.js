import { matchStorageKey, setMatchStorageScope } from './accountStorage';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attemptMatchSave, enqueueMatchSave, pendingMatchSaves, pruneSyncedMatchSaves } from './pendingMatchSaves';
import { loadSportTournaments, saveSportTournament } from './storage';

const reference = { storageKey: 'se_football', tournamentId: 100, matchId: 'final' };
const payload = { sport: 'football', team1: 'Alpha', team2: 'Beta', score1: 2, score2: 1, date: 1, clientMatchId: 'tournament:football:100:final' };
let owner;
let sequence = 0;
beforeEach(() => {
  localStorage.clear();
  owner = `knockout-owner-${++sequence}`;
  setMatchStorageScope(owner);
  localStorage.setItem(matchStorageKey('se_football'), JSON.stringify([{ id: 100, matches: [{ id: 'group', score1: 3 }], knockoutMatches: [{ id: 'final', status: 'completed', score1: 2, score2: 1 }] }]));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => vi.restoreAllMocks());

it('updates only the queued knockout fixture, preserving scores and new local edits', async () => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  const tournament = JSON.parse(localStorage.getItem(matchStorageKey('se_football')))[0];
  tournament.name = 'Renamed while pending';
  localStorage.setItem(matchStorageKey('se_football'), JSON.stringify([tournament]));
  await attemptMatchSave(record, vi.fn().mockResolvedValue('server-id'));
  expect(JSON.parse(localStorage.getItem(matchStorageKey('se_football')))[0]).toMatchObject({ name: 'Renamed while pending', matches: [{ id: 'group', score1: 3 }], knockoutMatches: [{ id: 'final', score1: 2, score2: 1, syncOwnerId: owner, sync: { status: 'synced' } }] });
  expect(localStorage.getItem(matchStorageKey('se_quickmatches'))).toBeNull();
  expect(pendingMatchSaves(owner)).toEqual([]);
});

it('persisted owner-scoped confirmation wins over a stale queue record and prunes it', () => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  const tournament = JSON.parse(localStorage.getItem(matchStorageKey('se_football')))[0];
  tournament.knockoutMatches[0] = { ...tournament.knockoutMatches[0], clientMatchId: payload.clientMatchId, syncOwnerId: owner, sync: { status: 'synced', completionId: record.completionId } };
  localStorage.setItem(matchStorageKey('se_football'), JSON.stringify([tournament]));
  const key = `se_pending_match:${encodeURIComponent(owner)}:${encodeURIComponent(payload.clientMatchId)}`;
  localStorage.setItem(matchStorageKey(key), JSON.stringify({ ...record, state: 'failed' }));
  expect(pendingMatchSaves(owner)).toEqual([]);
  pruneSyncedMatchSaves(owner);
  expect(localStorage.getItem(matchStorageKey(key))).toBeNull();
  const other = enqueueMatchSave('other-account', payload, undefined, reference);
  expect(other).toBeUndefined();
  expect(pendingMatchSaves('other-account')).toEqual([]);
});

it('keeps a failed result and its durable record when transport fails', async () => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  await attemptMatchSave(record, vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  expect(pendingMatchSaves(owner)[0]).toMatchObject({ state: 'failed', terminal: false, tournamentMatch: reference });
  expect(JSON.parse(localStorage.getItem(matchStorageKey('se_football')))[0].knockoutMatches[0]).toMatchObject({ status: 'completed', score1: 2, score2: 1, sync: { status: 'failed' } });
  expect(pendingMatchSaves('another-account')).toEqual([]);
});

it.each(['matches', 'knockoutMatches'])('preserves reconnect confirmation when a stale fixture screen saves %s after acknowledgement', async (collection) => {
  localStorage.setItem(matchStorageKey('se_football'), JSON.stringify([{ id: 100, [collection]: [{ id: 'final', status: 'completed', score1: 2, score2: 1 }] }]));
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  await attemptMatchSave(record, vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  // The fixture screen captures the failed result before its passive save effect runs.
  const snapshot = loadSportTournaments('se_football')[0];
  expect(snapshot[collection][0].sync.status).toBe('failed');
  let acknowledge;
  const save = vi.fn(() => new Promise(resolve => { acknowledge = resolve; }));
  const retry = attemptMatchSave(pendingMatchSaves(owner)[0], save, () => true, true);
  await Promise.resolve();
  expect(save).toHaveBeenCalledExactlyOnceWith({ ...payload, expectedOwnerId: owner });
  acknowledge('server-id');
  expect(await retry).toMatchObject({ status: 'synced' });
  expect(loadSportTournaments('se_football')[0][collection][0].sync.status).toBe('synced');

  expect(saveSportTournament('se_football', { ...snapshot, name: 'Cup' })).toBe(true);
  expect(pendingMatchSaves(owner)).toEqual([]);
  expect(loadSportTournaments('se_football')[0]).toMatchObject({
    name: 'Cup', [collection]: [{ score1: 2, score2: 1, clientMatchId: payload.clientMatchId,
      syncOwnerId: owner, sync: { status: 'synced', completionId: record.completionId } }],
  });
});

it('preserves confirmation when the fixture snapshot predates enqueueing', async () => {
  const snapshot = loadSportTournaments('se_football')[0];
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  await attemptMatchSave(record, vi.fn().mockResolvedValue('server-id'));
  saveSportTournament('se_football', snapshot);
  expect(loadSportTournaments('se_football')[0].knockoutMatches[0]).toMatchObject({
    clientMatchId: payload.clientMatchId, syncOwnerId: owner,
    sync: { status: 'synced', completionId: record.completionId },
  });
});

it.each([
  ['Clear', { status: 'scheduled', score1: null, score2: null, sync: undefined }],
  ['replay', { score1: 0, score2: 3, completedAt: 2, sync: undefined }],
  ['another account', { syncOwnerId: 'another-account', sync: { status: 'pending' } }],
  ['another result identity', { clientMatchId: 'another-result', sync: { status: 'pending' } }],
])('does not transfer confirmation to %s', async (_label, changes) => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  await attemptMatchSave(record, vi.fn().mockResolvedValue('server-id'));
  const tournament = loadSportTournaments('se_football')[0];
  const replacement = { ...tournament.knockoutMatches[0], ...changes };
  saveSportTournament('se_football', { ...tournament, knockoutMatches: [replacement] });
  expect(loadSportTournaments('se_football')[0].knockoutMatches[0]).toEqual(JSON.parse(JSON.stringify(replacement)));
});

it.each([undefined, 'different-completion'])('does not preserve an unproven stored confirmation (%s)', async (completionId) => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  await attemptMatchSave(record, vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  const snapshot = loadSportTournaments('se_football')[0];
  const match = snapshot.knockoutMatches[0];
  localStorage.setItem(matchStorageKey('se_football'), JSON.stringify([{ ...snapshot, knockoutMatches: [{ ...match, sync: { status: 'synced', completionId } }] }]));
  saveSportTournament('se_football', snapshot);
  expect(loadSportTournaments('se_football')[0].knockoutMatches[0]).toEqual(match);
});
