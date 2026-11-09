import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const match = { id: 'unmarked', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, status: 'completed', completedAt: '2026-11-01' };
const payload = { ...match, clientMatchId: 'quick:football:unmarked', date: 1 };
const key = `se_pending_match:X:${encodeURIComponent(payload.clientMatchId)}`;
beforeEach(() => {
  vi.resetModules(); localStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory());
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  localStorage.setItem('se_quickmatches', JSON.stringify([match]));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])('never claims X unmarked result after its IndexedDB queue survives a failed marker write (ownerMismatch: %s)', async ownerMismatch => {
  const queue = await import('./pendingMatchSaves');
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  queue.enqueueMatchSave('X', payload, match.id);
  await queue.hydratePendingMatchSaves('X');
  blocked.mockRestore();
  const store = await import('./pendingMatchSaveStore');
  const [record] = await store.loadPendingSaveFallback('X');
  expect(record).toMatchObject({ ownerId: 'X', payload: { clientMatchId: payload.clientMatchId } });
  expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0].syncOwnerId).toBeUndefined();
  expect(localStorage.getItem(key)).toBeNull();
  if (ownerMismatch) await store.storePendingSaveFallback(key, { ...record, ownerMismatch: true });
  vi.resetModules();
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  const refreshed = await import('./pendingMatchSaves');
  expect(await claimGuestMatchSaves('Y')).toEqual([]);
  expect(refreshed.pendingMatchSaves('Y')).toEqual([]);
  expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0].syncOwnerId).toBeUndefined();
  await refreshed.hydratePendingMatchSaves('X');
  expect(refreshed.pendingMatchSaves('X')).toHaveLength(1);
});

it('also respects another owner localStorage record with ownerMismatch set', async () => {
  localStorage.setItem(key, JSON.stringify({ ownerId: 'X', payload, quickMatchId: match.id, ownerMismatch: true, state: 'pending' }));
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  const { pendingMatchSaves } = await import('./pendingMatchSaves');
  expect(await claimGuestMatchSaves('Y')).toEqual([]);
  expect(pendingMatchSaves('Y')).toEqual([]);
});

it('keeps distinct idless tournament results intact and never queues the shared unknown identity', async () => {
  localStorage.setItem('se_quickmatches', '[]');
  const fixtures = [{ status: 'completed', score1: 2, score2: 1 }, { status: 'completed', score1: 0, score2: 3 }];
  localStorage.setItem('se_football', JSON.stringify([{ id: 'legacy', name: 'Legacy cup', matches: fixtures }]));
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  const { pendingMatchSaves } = await import('./pendingMatchSaves');
  expect(await claimGuestMatchSaves('X')).toEqual([]);
  expect(pendingMatchSaves('X')).toEqual([]);
  expect(JSON.parse(localStorage.getItem('se_football'))[0].matches).toEqual(fixtures);
});

it.each([false, true])('interleaved X and Y claims queue exactly one account (Web Locks: %s)', async webLocks => {
  let tail = Promise.resolve();
  if (webLocks) Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: vi.fn((_name, run) => { const next = tail.then(run); tail = next.catch(() => {}); return next; }),
  } });
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  const { pendingMatchSaves } = await import('./pendingMatchSaves');
  const results = await Promise.all([claimGuestMatchSaves('X'), claimGuestMatchSaves('Y')]);
  expect(results.flat()).toEqual([payload.clientMatchId]);
  const records = [...pendingMatchSaves('X'), ...pendingMatchSaves('Y')];
  expect(records).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0].syncOwnerId).toBe(records[0].ownerId);
});

it('revalidates a guest claim immediately before draining its record', async () => {
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  const queue = await import('./pendingMatchSaves');
  await claimGuestMatchSaves('X');
  const record = queue.pendingMatchSaves('X')[0];
  const claimKey = `se_guest_match_claim:${encodeURIComponent(payload.clientMatchId)}`;
  localStorage.setItem(claimKey, JSON.stringify({ ownerId: 'Y', clientMatchId: payload.clientMatchId }));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  const save = vi.fn().mockResolvedValue('saved');
  await queue.attemptMatchSave(record, save);
  expect(save).not.toHaveBeenCalled();
  expect(queue.pendingMatchSaves('X')).toHaveLength(1);
});
