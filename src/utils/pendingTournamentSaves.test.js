import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attemptMatchSave, enqueueMatchSave, pendingMatchSaves, pruneSyncedMatchSaves } from './pendingMatchSaves';

const reference = { storageKey: 'se_football', tournamentId: 100, matchId: 'final' };
const payload = { sport: 'football', team1: 'Alpha', team2: 'Beta', score1: 2, score2: 1, date: 1, clientMatchId: 'tournament:football:100:final' };
let owner;
let sequence = 0;
beforeEach(() => {
  localStorage.clear();
  owner = `knockout-owner-${++sequence}`;
  localStorage.setItem('se_football', JSON.stringify([{ id: 100, matches: [{ id: 'group', score1: 3 }], knockoutMatches: [{ id: 'final', status: 'completed', score1: 2, score2: 1 }] }]));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => vi.restoreAllMocks());

it('updates only the queued knockout fixture, preserving scores and new local edits', async () => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  const tournament = JSON.parse(localStorage.getItem('se_football'))[0];
  tournament.name = 'Renamed while pending';
  localStorage.setItem('se_football', JSON.stringify([tournament]));
  await attemptMatchSave(record, vi.fn().mockResolvedValue('server-id'));
  expect(JSON.parse(localStorage.getItem('se_football'))[0]).toMatchObject({ name: 'Renamed while pending', matches: [{ id: 'group', score1: 3 }], knockoutMatches: [{ id: 'final', score1: 2, score2: 1, syncOwnerId: owner, sync: { status: 'synced' } }] });
  expect(localStorage.getItem('se_quickmatches')).toBeNull();
  expect(pendingMatchSaves(owner)).toEqual([]);
});

it('persisted owner-scoped confirmation wins over a stale queue record and prunes it', () => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  const tournament = JSON.parse(localStorage.getItem('se_football'))[0];
  tournament.knockoutMatches[0] = { ...tournament.knockoutMatches[0], clientMatchId: payload.clientMatchId, syncOwnerId: owner, sync: { status: 'synced' } };
  localStorage.setItem('se_football', JSON.stringify([tournament]));
  const key = `se_pending_match:${encodeURIComponent(owner)}:${encodeURIComponent(payload.clientMatchId)}`;
  localStorage.setItem(key, JSON.stringify({ ...record, state: 'failed' }));
  expect(pendingMatchSaves(owner)).toEqual([]);
  pruneSyncedMatchSaves(owner);
  expect(localStorage.getItem(key)).toBeNull();
  const other = enqueueMatchSave('other-account', payload, undefined, reference);
  expect(pendingMatchSaves('other-account')).toEqual([other]);
});

it('keeps a failed result and its durable record when transport fails', async () => {
  const record = enqueueMatchSave(owner, payload, undefined, reference);
  await attemptMatchSave(record, vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  expect(pendingMatchSaves(owner)[0]).toMatchObject({ state: 'failed', terminal: false, tournamentMatch: reference });
  expect(JSON.parse(localStorage.getItem('se_football'))[0].knockoutMatches[0]).toMatchObject({ status: 'completed', score1: 2, score2: 1, sync: { status: 'failed' } });
  expect(pendingMatchSaves('another-account')).toEqual([]);
});
