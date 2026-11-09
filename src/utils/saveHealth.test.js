import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearData, saveData } from './storage';
import { hasOutstandingSaveFailure, markSaveFailed, markSaveOk, resetSaveHealth } from './saveHealth';

const KEY = 'se_quickmatch_draft_volleyball_1';

function failWrites() {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
  });
}

describe('save health', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    resetSaveHealth();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSaveHealth();
  });

  it('tracks failures per key', () => {
    expect(hasOutstandingSaveFailure()).toBe(false);
    markSaveFailed('a');
    markSaveFailed('b');
    markSaveOk('a');
    expect(hasOutstandingSaveFailure()).toBe(true);
    markSaveOk('b');
    expect(hasOutstandingSaveFailure()).toBe(false);
  });

  it('a failed draft write sets the flag and the next successful write of that key clears it', () => {
    const spy = failWrites();
    expect(saveData(KEY, { vScore1: 1 })).toBe(false);
    expect(hasOutstandingSaveFailure()).toBe(true);

    spy.mockRestore();
    expect(saveData('some_other_key', { ok: true })).toBe(true);
    expect(hasOutstandingSaveFailure()).toBe(true);

    expect(saveData(KEY, { vScore1: 2 })).toBe(true);
    expect(hasOutstandingSaveFailure()).toBe(false);
  });

  it('discarding the draft clears its failure', () => {
    failWrites();
    saveData(KEY, { vScore1: 1 });
    expect(hasOutstandingSaveFailure()).toBe(true);

    vi.restoreAllMocks();
    clearData(KEY);
    expect(hasOutstandingSaveFailure()).toBe(false);
  });
});
