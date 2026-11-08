import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadQuickMatches, saveQuickMatch, saveQuickMatches } from './storage';
import { loadQuickStatsRecovery, removeQuickStats, restoreQuickStats } from './quickStatsRecovery';

const completed = id => ({ id, status: 'completed', sport: 'football', score1: 2, score2: 1, winner: 'Home' });
const originals = [completed('first'), completed('middle'), completed('last')];
const ids = () => loadQuickMatches().map(match => match.id);

describe('durable quick stats recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    saveQuickMatches(originals);
  });
  afterEach(() => vi.restoreAllMocks());

  it('can load the recovery after a module reload and preserves active drafts', async () => {
    saveQuickMatch({ id: 'draft', sport: 'football', status: 'in-progress', score1: 1 });
    removeQuickStats(originals, 'clear');
    vi.resetModules();
    const reloaded = await import('./quickStatsRecovery');
    expect(reloaded.loadQuickStatsRecovery().removed.map(({ match }) => match.id)).toEqual(['first', 'middle', 'last']);
    expect(reloaded.restoreQuickStats()).toBe(true);
    expect(ids()).toEqual(['first', 'middle', 'last', 'draft']);
    expect(loadQuickMatches().at(-1).status).toBe('in-progress');
  });

  it('does not resurrect unrelated matches removed while Undo was pending', () => {
    removeQuickStats([originals[1]], 'delete');
    saveQuickMatches([originals[2], completed('later')]);
    expect(restoreQuickStats()).toBe(true);
    expect(ids()).toEqual(['middle', 'last', 'later']);
    expect(loadQuickStatsRecovery()).toBeNull();
  });

  it('replaces recovery only when the next removal succeeds', () => {
    removeQuickStats([originals[1]], 'delete');
    const firstRecovery = loadQuickStatsRecovery();
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'se_quickmatches') throw new DOMException('quota', 'QuotaExceededError');
      return setItem.call(this, key, value);
    });
    expect(removeQuickStats([originals[0]], 'delete')).toBeNull();
    expect(ids()).toEqual(['first', 'last']);
    expect(loadQuickStatsRecovery()).toEqual(firstRecovery);
  });

  it('leaves matches untouched if the recovery cannot be persisted', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(removeQuickStats(originals, 'clear')).toBeNull();
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(loadQuickStatsRecovery()).toBeNull();
  });

  it('keeps recovery retryable when restoring matches cannot be persisted', () => {
    removeQuickStats([originals[1]], 'delete');
    const recovery = loadQuickStatsRecovery();
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(restoreQuickStats()).toBe(false);
    expect(ids()).toEqual(['first', 'last']);
    expect(loadQuickStatsRecovery()).toEqual(recovery);
    failure.mockRestore();
    expect(restoreQuickStats()).toBe(true);
    expect(ids()).toEqual(['first', 'middle', 'last']);
  });

  it('keeps the earlier operation restorable when a second removal and its rollback both fail', () => {
    const first = removeQuickStats([originals[1]], 'delete');
    const setItem = Storage.prototype.setItem;
    let matchWriteFailed = false;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'se_quickmatches') {
        matchWriteFailed = true;
        throw new Error('match write failed');
      }
      if (key === 'se_stats_pending_undo' && matchWriteFailed) throw new Error('rollback failed');
      return setItem.call(this, key, value);
    });
    expect(removeQuickStats([originals[0]], 'delete')).toBeNull();
    failure.mockRestore();
    expect(restoreQuickStats(first.id)).toBe(true);
    expect(ids(), 'failed second removal must not strand the earlier removed match').toEqual(['first', 'middle', 'last']);
  });
});
