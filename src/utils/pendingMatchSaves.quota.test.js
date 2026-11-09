import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { IDBFactory } from 'fake-indexeddb';
import { ConvexError } from 'convex/values';

const owner = 'quota-owner';
const payload = { clientMatchId: 'quota-result', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1 };
let queue;
let block;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...payload, id: 'quota-match', status: 'completed' }]));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  queue = await import('./pendingMatchSaves');
  block = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function durable() {
  await waitFor(() => expect(queue.pendingMatchSaves(owner)[0]).toMatchObject({ storageFailed: false }));
}
async function refresh(account = owner) {
  vi.resetModules();
  queue = await import('./pendingMatchSaves');
  await queue.hydratePendingMatchSaves?.(account);
}

it.each(['quota', 'unavailable'])('retains a finished save through refresh when localStorage is %s', async (failure) => {
  if (failure === 'unavailable') {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  }
  queue.enqueueMatchSave(owner, payload, 'quota-match');
  await durable();
  await refresh();
  expect(queue.pendingMatchSaves(owner)).toEqual([expect.objectContaining({ ownerId: owner, payload, storageFailed: false })]);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  const save = vi.fn().mockResolvedValue('server-id');
  await queue.attemptMatchSave(queue.pendingMatchSaves(owner)[0], save);
  expect(save).toHaveBeenCalledExactlyOnceWith(payload);
  await refresh();
  expect(queue.pendingMatchSaves(owner)).toEqual([]);
});

it('never exposes or sends owner A fallback records to owner B after refresh', async () => {
  queue.enqueueMatchSave(owner, payload, 'quota-match');
  await durable();
  await refresh('other-owner');
  expect(queue.pendingMatchSaves('other-owner')).toEqual([]);
  await queue.hydratePendingMatchSaves?.(owner);
  expect(queue.pendingMatchSaves(owner)).toHaveLength(1);
  const send = vi.fn();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await queue.attemptMatchSave(queue.pendingMatchSaves(owner)[0], send, () => false);
  expect(send).not.toHaveBeenCalled();
  await refresh(owner);
  expect(queue.pendingMatchSaves(owner)).toHaveLength(1);
});

it('keeps fallback durable after space is freed and acknowledges without a duplicate on refresh', async () => {
  queue.enqueueMatchSave(owner, payload, 'quota-match');
  await durable();
  block.mockRestore();
  await refresh();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  const save = vi.fn().mockResolvedValue('server-id');
  const record = queue.pendingMatchSaves(owner)[0];
  await Promise.all([queue.attemptMatchSave(record, save), queue.attemptMatchSave(record, save)]);
  expect(save).toHaveBeenCalledExactlyOnceWith(payload);
  await refresh();
  expect(queue.pendingMatchSaves(owner)).toEqual([]);
  expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0]).toMatchObject({ score1: 2, score2: 1, sync: { status: 'synced' } });
});

it('preserves permanent rejection across fallback refresh and only retries manually', async () => {
  queue.enqueueMatchSave(owner, payload, 'quota-match');
  await durable();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await queue.attemptMatchSave(queue.pendingMatchSaves(owner)[0], () => Promise.reject(new ConvexError('Rejected')));
  await refresh();
  expect(queue.pendingMatchSaves(owner)[0]).toMatchObject({ state: 'failed', terminal: true, payload });
  const save = vi.fn().mockResolvedValue('server-id');
  await queue.attemptMatchSave(queue.pendingMatchSaves(owner)[0], save);
  expect(save).not.toHaveBeenCalled();
  await queue.attemptMatchSave(queue.pendingMatchSaves(owner)[0], save, () => true, true);
  await refresh();
  expect(queue.pendingMatchSaves(owner)).toEqual([]);
  expect(queue.isMatchSaveConfirmed(owner, payload.clientMatchId)).toBe(true);
});

it('lets a local synced marker suppress a stale fallback record without sending', async () => {
  queue.enqueueMatchSave(owner, payload, 'quota-match');
  await durable();
  block.mockRestore();
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...payload, id: 'quota-match', syncOwnerId: owner, sync: { status: 'synced' } }]));
  await refresh();
  queue.pruneSyncedMatchSaves(owner);
  expect(queue.pendingMatchSaves(owner)).toEqual([]);
  await refresh();
  expect(queue.pendingMatchSaves(owner)).toEqual([]);
});
