import { beforeEach, expect, it, vi } from 'vitest';
import { enqueue, load } from './outbox';
import { liveClientMatchId, loadSession, resetLiveGeneration, saveSession } from './liveSession';
import { flushLiveSession } from './recovery';

beforeEach(() => localStorage.clear());
const mutations = () => ({ scorePoint: vi.fn().mockResolvedValue({}), undo: vi.fn().mockResolvedValue({}), finalize: vi.fn().mockResolvedValue({}) });
function seed(id) {
  enqueue({ kind: 'point', team: 'A', value: 1, at: 1, clientMatchId: id, clientEventId: `${id}:1` });
  saveSession(id, { matchId: `live-${id}`, seq: 1, isShared: true, finalizeIntent: { resultType: 'abandoned', shared: true } });
}

it('recovers each session under its stored live id without consuming another session\'s failed tail', async () => {
  seed('old');
  seed('other');
  const api = mutations();
  api.scorePoint.mockImplementation(async ({ matchId }) => {
    if (matchId === 'live-old') throw new Error('offline');
  });
  await Promise.all([flushLiveSession('old', api), flushLiveSession('other', api)]);
  expect(api.finalize).toHaveBeenCalledExactlyOnceWith({ matchId: 'live-other', resultType: 'abandoned' });
  expect(load().map(item => item.clientMatchId)).toEqual(['old']);
  expect(loadSession('old')).toHaveProperty('finalizeIntent');
});

it('coalesces root and scorer drains and waits for the last score before finalizing once', async () => {
  seed('old');
  const api = mutations();
  let release;
  api.scorePoint.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const first = flushLiveSession('old', api);
  await vi.waitFor(() => expect(api.scorePoint).toHaveBeenCalledTimes(1));
  enqueue({ kind: 'point', team: 'A', value: 0, snapshot: { pointsA: 5 }, at: 2, clientMatchId: 'old', clientEventId: 'old:2' });
  const second = flushLiveSession('old', api);
  expect(second).toBe(first);
  expect(api.finalize).not.toHaveBeenCalled();
  release({});
  await Promise.all([first, second]);
  expect(api.scorePoint).toHaveBeenCalledTimes(2);
  expect(api.finalize).toHaveBeenCalledTimes(1);
  expect(api.scorePoint.mock.invocationCallOrder.at(-1)).toBeLessThan(api.finalize.mock.invocationCallOrder[0]);
});

it('cancels an in-flight retired generation without acknowledging or finalizing the reset fixture', async () => {
  seed('fixture');
  const api = mutations();
  let release;
  api.scorePoint.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const old = flushLiveSession('fixture', api);
  await vi.waitFor(() => expect(api.scorePoint).toHaveBeenCalledTimes(1));
  resetLiveGeneration('fixture');
  const nextId = liveClientMatchId('fixture');
  expect(nextId).not.toBe('fixture');
  seed(nextId);
  release({});
  await old;
  expect(load().map(item => item.clientMatchId)).toEqual([nextId]);
  expect(api.finalize).not.toHaveBeenCalled();
  await flushLiveSession(nextId, api);
  expect(api.finalize).toHaveBeenCalledExactlyOnceWith({ matchId: `live-${nextId}`, resultType: 'abandoned' });
});
