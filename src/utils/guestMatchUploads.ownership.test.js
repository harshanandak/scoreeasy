import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const match = { id: 'unmarked', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, status: 'completed', completedAt: '2026-11-01' };
const payload = { sport: match.sport, team1: match.team1, team2: match.team2, score1: match.score1, score2: match.score2, clientMatchId: 'quick:football:unmarked', date: 1 };
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
  const scope = await import('./accountStorage');
  localStorage.removeItem('se_quickmatches');
  scope.setMatchStorageScope('X');
  const { saveQuickMatch } = await import('./storage');
  saveQuickMatch(match);
  const queue = await import('./pendingMatchSaves');
  const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  queue.enqueueMatchSave('X', payload, match.id);
  await queue.hydratePendingMatchSaves('X');
  blocked.mockRestore();
  const store = await import('./pendingMatchSaveStore');
  const [record] = await store.loadPendingSaveFallback('X');
  expect(record).toMatchObject({ ownerId: 'X', payload: { clientMatchId: payload.clientMatchId } });
  expect(JSON.parse(localStorage.getItem(scope.matchStorageKey('se_quickmatches', 'X')))[0].syncOwnerId).toBeUndefined();
  expect(localStorage.getItem(key)).toBeNull();
  if (ownerMismatch) await store.storePendingSaveFallback(key, { ...record, ownerMismatch: true });
  vi.resetModules();
  const nextScope = await import('./accountStorage');
  nextScope.setMatchStorageScope('Y');
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  const refreshed = await import('./pendingMatchSaves');
  expect(await claimGuestMatchSaves('Y')).toEqual([]);
  expect(refreshed.pendingMatchSaves('Y')).toEqual([]);
  expect(localStorage.getItem(nextScope.matchStorageKey('se_quickmatches'))).toBeNull();
  nextScope.setMatchStorageScope(null);
  expect((await import('./storage')).loadQuickMatches()).toEqual([]);
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
  const { claimGuestMatchSaves, unuploadedGuestTournamentResults } = await import('./guestMatchUploads');
  const { pendingMatchSaves } = await import('./pendingMatchSaves');
  expect(await claimGuestMatchSaves('X')).toEqual([]);
  expect(pendingMatchSaves('X')).toEqual([]);
  const { setMatchStorageScope, matchStorageKey } = await import('./accountStorage');
  setMatchStorageScope('X');
  expect(JSON.parse(localStorage.getItem(matchStorageKey('se_football')))[0].matches).toEqual(fixtures);
  expect(unuploadedGuestTournamentResults()).toEqual(['Legacy cup result 1', 'Legacy cup result 2']);
});

it.each([false, true])('interleaved X and Y claims queue exactly one account (Web Locks: %s)', async webLocks => {
  let tail = Promise.resolve();
  if (webLocks) Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: vi.fn((_name, run) => { const next = tail.then(run); tail = next.catch(() => {}); return next; }),
  } });
  const { claimGuestMatchSaves } = await import('./guestMatchUploads');
  const { pendingMatchSaves } = await import('./pendingMatchSaves');
  const original = Storage.prototype.setItem;
  let second;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (storageKey, value) {
    
    if (storageKey === `se_guest_match_claim:${encodeURIComponent(payload.clientMatchId)}` && JSON.parse(value).ownerId === 'X' && !second) {
      second = Promise.resolve(claimGuestMatchSaves('Y'));
    }
    return original.call(this, storageKey, value);
  });
  const first = await claimGuestMatchSaves('X');
  expect(second).toBeDefined();
  expect([...first, ...await second]).toEqual([payload.clientMatchId]);
  const records = [...pendingMatchSaves('X'), ...pendingMatchSaves('Y')];
  expect(records).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(`se_guest_match_claim:${encodeURIComponent(payload.clientMatchId)}`)).ownerId).toBe(records[0].ownerId);
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
