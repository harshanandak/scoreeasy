import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.resetModules(); localStorage.clear(); });

it('reads the last durable score after reloading with full storage and never reports a memory-only save as durable', async () => {
  localStorage.clear();
  const key = 'se_winning_point_quota_test';
  localStorage.setItem(key, JSON.stringify({ score: 24 }));
  const originalWrite = Storage.prototype.setItem;
  const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
  vi.resetModules();
  const storage = await import('./storage');
  expect(storage.loadData(key)).toEqual({ score: 24 });
  expect(storage.saveData(key, { score: 25 })).toBe(false);
  expect(storage.loadData(key)).toEqual({ score: 24 });
  // Freeing space must let this tab retry without a reload or a new backend.
  full.mockImplementation(function (name, value) { return originalWrite.call(this, name, value); });
  expect(storage.saveData(key, { score: 25 })).toBe(true);
  vi.resetModules();
  const reloaded = await import('./storage');
  expect(reloaded.loadData(key)).toEqual({ score: 25 });
});
