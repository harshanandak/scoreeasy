import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const payload = { sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1, clientMatchId: 'cross-tab-result' };
const key = 'se_pending_match:tab-owner:cross-tab-result';
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...payload, id: 'tab-match', status: 'completed' }]));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => vi.restoreAllMocks());

it.each([false, true])('drops a second tab late rejection after acknowledgement (metadata write blocked: %s)', async (blockMetadata) => {
  vi.resetModules();
  const tabA = await import('./pendingMatchSaves');
  vi.resetModules();
  const tabB = await import('./pendingMatchSaves');
  const recordA = tabA.enqueueMatchSave('tab-owner', payload, 'tab-match');
  const recordB = tabB.pendingMatchSaves('tab-owner')[0];
  let acknowledge;
  let reject;
  const requestA = tabA.attemptMatchSave(recordA, () => new Promise((resolve) => { acknowledge = resolve; }));
  const requestB = tabB.attemptMatchSave(recordB, () => new Promise((resolve, rejectSave) => { reject = rejectSave; }));
  await Promise.resolve();
  if (blockMetadata) {
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
      if (name === 'se_quickmatches') throw new DOMException('Full', 'QuotaExceededError');
      return write.call(this, name, value);
    });
  }
  acknowledge('server-id');
  await requestA;
  reject(new TypeError('Failed to fetch'));
  expect(await requestB).toMatchObject({ status: 'synced' });
  expect(localStorage.getItem(key)).toBeNull();
  expect(tabB.pendingMatchSaves('tab-owner')).toEqual([]);
  expect(tabB.isMatchSaveConfirmed('tab-owner', payload.clientMatchId)).toBe(true);
  if (!blockMetadata) expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0].sync.status).toBe('synced');
});
