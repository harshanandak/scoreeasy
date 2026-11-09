import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const match = { id: 'owned', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, status: 'completed', completedAt: '2026-11-01' };
const id = 'quick:football:owned';
const payload = { ...match, clientMatchId: id, date: 1 };
const key = `se_pending_match:X:${encodeURIComponent(id)}`;
let queue;
beforeEach(async () => {
  vi.resetModules(); localStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory());
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  queue = await import('./pendingMatchSaves');
  localStorage.setItem('se_quickmatches', JSON.stringify([match]));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function history(owners, account = null) {
  const { mergeAccountHistory } = await import('./accountHistory');
  return mergeAccountHistory([{ ...match, clientMatchId: id }], [], account, account && `db-${account}`, owners);
}

it('hides X from guests and Y when quota prevents the owner marker, while X retains History', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  queue.enqueueMatchSave('X', payload, match.id);
  await queue.hydratePendingMatchSaves('X');
  expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0].syncOwnerId).toBeUndefined();
  vi.resetModules(); queue = await import('./pendingMatchSaves');
  const owners = await queue.matchOwners();
  expect(await history(owners)).toEqual([]);
  expect(await history(owners, 'Y')).toEqual([]);
  expect(await history(owners, 'X')).toHaveLength(1);
});

it('retains ownership after acknowledgement and queue pruning even when the marker never writes', async () => {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === 'se_quickmatches') throw new DOMException('Full', 'QuotaExceededError');
    return original.call(this, name, value);
  });
  const record = queue.enqueueMatchSave('X', payload, match.id);
  const save = vi.fn().mockResolvedValue('server-id');
  await queue.attemptMatchSave(record, save);
  queue.pruneSyncedMatchSaves('X');
  expect(save).toHaveBeenCalledOnce();
  expect(localStorage.getItem(key)).toBeNull();
  // Remove even the compact acknowledgement: ownership must have its own lifetime.
  await new Promise((resolve, reject) => {
    const open = indexedDB.open('se-pending-match-saves');
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('records', 'readwrite');
      tx.objectStore('records').clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
    open.onerror = () => reject(open.error);
  });
  vi.resetModules(); queue = await import('./pendingMatchSaves');
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  expect(await claimGuestMatchSaves('Y')).toEqual([]);
  expect(queue.pendingMatchSaves('Y')).toEqual([]);
  expect(await history(await queue.matchOwners(), 'Y')).toEqual([]);
});

it('upgrades version 1 without changing any queue record and backfills every owner', async () => {
  const records = ['pending', 'failed', 'synced'].map((state, index) => ({ ownerId: `owner-${index}`, payload: { ...payload, clientMatchId: `old-${index}` }, state }));
  await new Promise((resolve, reject) => {
    const open = indexedDB.open('se-pending-match-saves', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('records').createIndex('ownerId', 'ownerId');
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('records', 'readwrite');
      records.forEach((record, index) => tx.objectStore('records').put(record, `key-${index}`));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
    open.onerror = () => reject(open.error);
  });
  const owners = await queue.matchOwners();
  const { loadPendingSaveFallback } = await import('./pendingMatchSaveStore');
  expect(await loadPendingSaveFallback()).toEqual(records);
  records.forEach((record, index) => expect(owners.get(`old-${index}`)).toEqual(new Set([record.ownerId])));
});

it('backfills existing local queue records and quick/tournament owner markers', async () => {
  localStorage.setItem(key, JSON.stringify({ ownerId: 'X', payload, state: 'pending' }));
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...match, id: 'marked', syncOwnerId: 'M' }]));
  localStorage.setItem('se_football', JSON.stringify([{ id: 'cup', matches: [{ id: 'final', syncOwnerId: 'T' }] }]));
  const owners = await queue.matchOwners();
  expect(owners.get(id)).toEqual(new Set(['X']));
  expect(owners.get('quick:football:marked')).toEqual(new Set(['M']));
  expect(owners.get('tournament:football:cup:final')).toEqual(new Set(['T']));
  localStorage.clear(); vi.resetModules(); queue = await import('./pendingMatchSaves');
  expect(await queue.matchOwners()).toEqual(owners);
});

it.each(['missing', 'blocked'])('fails closed when IndexedDB is %s, then recovers genuine guest claiming', async failure => {
  const database = indexedDB;
  if (failure === 'missing') vi.stubGlobal('indexedDB', undefined);
  else vi.spyOn(database, 'open').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  await expect(queue.matchOwners()).rejects.toThrow();
  expect(await history(null)).toEqual([]);
  expect(await history(null, 'Y')).toEqual([]);
  const { mergeAccountHistory } = await import('./accountHistory');
  expect(mergeAccountHistory([{ ...match, syncOwnerId: 'X' }], [], 'X', 'db-X', null)).toHaveLength(1);
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  expect(await claimGuestMatchSaves('Y')).toEqual([]);
  expect(queue.pendingMatchSaves('Y')).toEqual([]);
  vi.restoreAllMocks(); vi.stubGlobal('indexedDB', database);
  expect(await claimGuestMatchSaves('Y')).toEqual([id]);
  expect(await claimGuestMatchSaves('Y')).toEqual([]);
  expect(await claimGuestMatchSaves('X')).toEqual([]);
  expect(queue.pendingMatchSaves('Y')).toHaveLength(1);
});
