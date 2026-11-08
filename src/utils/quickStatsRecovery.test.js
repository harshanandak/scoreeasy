import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadData, loadQuickMatches, saveQuickMatch, saveQuickMatches } from './storage';
import { loadQuickStatsRecoveries, loadQuickStatsRecovery, removeQuickStats, restoreQuickStats } from './quickStatsRecovery';

const completed = id => ({ id, status: 'completed', sport: 'football', score1: 2, score2: 1, winner: 'Home' });
const originals = [completed('first'), completed('middle'), completed('last')];
const ids = () => loadQuickMatches().map(match => match.id);

describe('durable quick stats recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    saveQuickMatches(originals);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('can load the recovery after a module reload and preserves active drafts', async () => {
    saveQuickMatch({ id: 'draft', sport: 'football', status: 'in-progress', score1: 1 });
    removeQuickStats(originals, 'clear');
    vi.resetModules();
    const reloaded = await import('./quickStatsRecovery');
    expect(reloaded.loadQuickStatsRecovery().items.map(({ match }) => match.id)).toEqual(['first', 'middle', 'last']);
    expect(reloaded.restoreQuickStats(reloaded.loadQuickStatsRecovery().id)).toBe(true);
    expect(ids()).toEqual(['first', 'middle', 'last', 'draft']);
    expect(loadQuickMatches().at(-1).status).toBe('in-progress');
  });

  it('does not resurrect unrelated matches removed while Undo was pending', () => {
    const operation = removeQuickStats([originals[1]], 'delete');
    saveQuickMatches([originals[2], completed('later')]);
    expect(restoreQuickStats(operation.id)).toBe(true);
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
    expect(restoreQuickStats(recovery.id)).toBe(false);
    expect(ids()).toEqual(['first', 'last']);
    expect(loadQuickStatsRecovery()).toEqual(recovery);
    failure.mockRestore();
    expect(restoreQuickStats(recovery.id)).toBe(true);
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
    const extraOperation = loadQuickStatsRecovery();
    expect(restoreQuickStats(first.id)).toBe(true);
    expect(ids(), 'failed second removal must not strand the earlier removed match').toEqual(['first', 'middle', 'last']);
    expect(loadQuickStatsRecoveries().map(operation => operation.id)).toEqual([extraOperation.id]);
    expect(restoreQuickStats(extraOperation.id)).toBe(true);
    expect(ids()).toEqual(['first', 'middle', 'last']);
  });

  it('keeps only the last five operations and refuses an evicted id', () => {
    const operations = Array.from({ length: 6 }, (_, index) => {
      const match = completed(`extra-${index}`);
      saveQuickMatch(match);
      return removeQuickStats([match], 'delete');
    });
    expect(loadQuickStatsRecoveries().map(operation => operation.id)).toEqual(operations.slice(1).map(operation => operation.id));
    expect(loadData('se_stats_pending_undo')).toHaveLength(5);
    expect(new Set(operations.map(operation => operation.id)).size).toBe(6);
    expect(restoreQuickStats(operations[0].id)).toBe('unavailable');
    expect(ids()).toEqual(['first', 'middle', 'last']);
  });

  it('keeps all five original operations restorable when a sixth removal fails', () => {
    const matches = Array.from({ length: 5 }, (_, index) => completed(`capacity-${index}`));
    const operations = matches.map(match => {
      saveQuickMatch(match);
      return removeQuickStats([match], 'delete');
    });
    const snapshot = loadQuickStatsRecoveries();
    saveQuickMatch(completed('sixth'));
    const setItem = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'se_quickmatches') throw new Error('sixth match write failed');
      return setItem.call(this, key, value);
    });
    expect(removeQuickStats([completed('sixth')], 'delete')).toBeNull();
    failure.mockRestore();
    expect(loadQuickStatsRecoveries(), 'failed sixth removal must preserve all five recovery operations').toHaveLength(5);
    expect(loadQuickStatsRecoveries()).toEqual(snapshot);
    expect(operations.map(operation => restoreQuickStats(operation.id))).toEqual([true, true, true, true, true]);
    const expectedIds = ['first', 'middle', 'last', ...matches.map(match => match.id), 'sixth'];
    expect(new Set(ids())).toEqual(new Set(expectedIds));
    expect(ids()).toHaveLength(expectedIds.length);
  });

  it('prunes operations at 24 hours on reads and before appending another operation', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    const expired = removeQuickStats([originals[1]], 'delete');
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    expect(loadQuickStatsRecovery()).toBeNull();
    expect(loadData('se_stats_pending_undo')).toEqual([]);
    const current = removeQuickStats([originals[0]], 'delete');
    expect(loadQuickStatsRecoveries().map(operation => operation.id)).toEqual([current.id]);
    expect(restoreQuickStats(expired.id)).toBe('unavailable');
  });

  it('never restores expired items even when persisting expiry pruning fails', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    const expired = removeQuickStats([originals[1]], 'delete');
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    expect(loadQuickStatsRecovery()).toBeNull();
    expect(restoreQuickStats(expired.id)).toBe('unavailable');
    expect(ids()).toEqual(['first', 'last']);
  });
});
