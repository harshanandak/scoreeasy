import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { attemptMatchSave, enqueueMatchSave, pendingMatchSaves } from './pendingMatchSaves';

const reference = { storageKey: 'se_football', tournamentId: 100, matchId: 'final' };
const first = { sport: 'football', team1: 'Alpha', team2: 'Beta', score1: 2, score2: 1, date: 1, clientMatchId: 'tournament:football:100:final' };
const replay = { ...first, score1: 0, score2: 3, winner: 'Beta', date: 2 };
let owner;
let sequence = 0;
function writeFixture(payload) {
  localStorage.setItem('se_football', JSON.stringify([{ id: 100, matches: [], knockoutMatches: [{
    id: 'final', status: 'completed', score1: payload.score1, score2: payload.score2, completedAt: payload.date,
  }] }]));
}
const localResult = () => JSON.parse(localStorage.getItem('se_football'))[0].knockoutMatches[0];
beforeEach(() => {
  localStorage.clear();
  owner = `replay-owner-${++sequence}`;
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  writeFixture(first);
});
afterEach(() => vi.restoreAllMocks());

it('replaces a rejected completion after Clear/replay, and Retry sends only the new result before confirming it', async () => {
  const original = enqueueMatchSave(owner, first, undefined, reference);
  await attemptMatchSave(original, vi.fn().mockRejectedValue(new ConvexError('Result rejected')));
  expect(pendingMatchSaves(owner)[0]).toMatchObject({ state: 'failed', terminal: true, payload: first });
  writeFixture(replay);
  const replacement = enqueueMatchSave(owner, replay, undefined, reference);
  expect(replacement).toMatchObject({ state: 'pending', terminal: false, attempts: 0, nextAttemptAt: 0, payload: replay });
  expect(localResult().sync.status).not.toBe('synced');
  let acknowledge;
  const save = vi.fn(() => new Promise(resolve => { acknowledge = resolve; }));
  const retry = attemptMatchSave(pendingMatchSaves(owner)[0], save, () => true, true);
  await Promise.resolve();
  expect(save).toHaveBeenCalledExactlyOnceWith(replay);
  expect(localResult().sync.status).not.toBe('synced');
  acknowledge('server-id');
  await retry;
  expect(localResult()).toMatchObject({ score1: 0, score2: 3, syncOwnerId: owner, sync: { status: 'synced' } });
  expect(pendingMatchSaves(owner)).toEqual([]);
});

it('an older in-flight acknowledgement never confirms or removes the replayed completion', async () => {
  const original = enqueueMatchSave(owner, first, undefined, reference);
  let acknowledge;
  const request = attemptMatchSave(original, () => new Promise(resolve => { acknowledge = resolve; }));
  await Promise.resolve();
  writeFixture(replay);
  enqueueMatchSave(owner, replay, undefined, reference);
  acknowledge('original-server-id');
  await request;
  expect(localResult()).toMatchObject({ score1: 0, score2: 3 });
  expect(localResult().sync.status).not.toBe('synced');
  expect(pendingMatchSaves(owner)[0]).toMatchObject({ payload: replay });
});
