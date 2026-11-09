import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { IDBDatabase, IDBFactory } from 'fake-indexeddb';

const owner = 'retention-owner';
const payload = { clientMatchId: 'retained-result', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1 };
const keyFor = (account, id) => `se_pending_match:${encodeURIComponent(account)}:${encodeURIComponent(id)}`;
let queue;
let store;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  queue = await import('./pendingMatchSaves');
  store = await import('./pendingMatchSaveStore');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function refresh() {
  vi.resetModules();
  queue = await import('./pendingMatchSaves');
  await queue.hydratePendingMatchSaves(owner);
}

async function enqueue(result = payload) {
  const record = queue.enqueueMatchSave(owner, result, 'local-result');
  await queue.hydratePendingMatchSaves(owner);
  return record;
}

async function acknowledge() {
  const record = await enqueue();
  await queue.attemptMatchSave(record, vi.fn().mockResolvedValue('server-id'));
  queue.pruneSyncedMatchSaves(owner);
  await queue.hydratePendingMatchSaves(owner);
  return record;
}

function expectCompact(records, count) {
  expect(records).toHaveLength(count);
  for (const record of records) {
    expect(record).toMatchObject({ ownerId: owner, state: 'synced' });
    expect(record.payload).toBeUndefined();
    expect(JSON.stringify(record)).not.toContain('North');
    expect(JSON.stringify(record)).not.toContain('South');
  }
}

it('prunes every legacy synced IDB payload while preserving unacknowledged states and other owners', async () => {
  // Seed the pre-compaction format directly, including records from an older app version.
  await store.loadPendingSaveFallback(owner);
  const records = [
    ...Array.from({ length: 8 }, (_, index) => ({ ownerId: owner, payload: { ...payload, clientMatchId: `synced-${index}` }, state: 'synced' })),
    ...['pending', 'failed', 'terminal'].map(state => ({ ownerId: owner, payload: { ...payload, clientMatchId: state }, state: state === 'terminal' ? 'failed' : state, terminal: state === 'terminal' })),
    { ownerId: 'another-owner', payload, state: 'synced' },
  ].map(record => ({ ...record, storageBackend: 'indexedDB', storageFailed: false }));
  await new Promise((resolve, reject) => {
    const open = indexedDB.open('se-pending-match-saves', 1);
    open.onsuccess = () => {
      const database = open.result;
      const tx = database.transaction('records', 'readwrite');
      tx.oncomplete = () => { database.close(); resolve(); };
      tx.onabort = () => { database.close(); reject(tx.error); };
      for (const record of records) tx.objectStore('records').put(record, keyFor(record.ownerId, record.payload.clientMatchId));
    };
    open.onerror = () => reject(open.error);
  });
  await queue.hydratePendingMatchSaves(owner);
  queue.pruneSyncedMatchSaves(owner);
  await queue.hydratePendingMatchSaves(owner);
  const retained = await store.loadPendingSaveFallback(owner);
  expectCompact(retained.filter(record => record.state === 'synced'), 8);
  expect(retained.filter(record => record.state !== 'synced')).toEqual(records.slice(8, 11));
  expect(await store.loadPendingSaveFallback('another-owner')).toEqual([records[11]]);
});

it('compacts acknowledgement with localStorage blocked and refuses a stale replay before and after reload', async () => {
  const stale = await acknowledge();
  expectCompact(await store.loadPendingSaveFallback(owner), 1);
  const send = vi.fn();
  await queue.attemptMatchSave(stale, send);
  await store.storePendingSaveFallback(keyFor(owner, payload.clientMatchId), { ...stale, state: 'pending' });
  await refresh();
  expect(queue.pendingMatchSaves(owner)).toEqual([]);
  await queue.attemptMatchSave(stale, send);
  expect(send).not.toHaveBeenCalled();
  expectCompact(await store.loadPendingSaveFallback(owner), 1);
});

it('queues and sends a new completion with the same clientMatchId after compaction and reload', async () => {
  await acknowledge();
  expectCompact(await store.loadPendingSaveFallback(owner), 1);
  await refresh();
  const replacement = { ...payload, score1: 4, date: 2 };
  const record = await enqueue(replacement);
  expect(queue.pendingMatchSaves(owner)[0]).toMatchObject({ payload: replacement, state: 'pending', storageFailed: false });
  const send = vi.fn().mockResolvedValue('new-server-id');
  await queue.attemptMatchSave(record, send);
  expect(send).toHaveBeenCalledExactlyOnceWith(replacement);
  await refresh();
  expect(queue.pendingMatchSaves(owner)).toEqual([]);
  expectCompact(await store.loadPendingSaveFallback(owner), 1);
});

it.each([false, true])('hydrates a compact acknowledgement over only its matching dirty completion (replacement: %s)', async replacement => {
  const stale = await enqueue();
  const transaction = IDBDatabase.prototype.transaction;
  const blocked = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (stores, mode, ...options) {
    if (mode === 'readwrite') throw new DOMException('Full', 'QuotaExceededError');
    return transaction.call(this, stores, mode, ...options);
  });
  if (replacement) await enqueue({ ...payload, score1: 9, date: 2 });
  else await queue.attemptMatchSave(stale, () => Promise.reject(new Error('Rejected')));
  await waitFor(() => expect(queue.pendingMatchSaves(owner)[0]).toMatchObject({ storageFailed: true }));
  blocked.mockRestore();
  await store.storePendingSaveFallback(keyFor(owner, payload.clientMatchId), { ...stale, state: 'synced' });
  expectCompact(await store.loadPendingSaveFallback(owner), 1);
  await queue.hydratePendingMatchSaves(owner);
  if (replacement) expect(queue.pendingMatchSaves(owner)[0]).toMatchObject({ payload: { score1: 9 }, storageFailed: true, state: 'pending' });
  else expect(queue.pendingMatchSaves(owner)).toEqual([]);
});
