import {
  saveData,
  loadData,
  clearData,
  safeSave,
  getStorageUsage,
  isStorageNearFull,
  isStorageAvailable,
  isPrivateMode,
  STORAGE_KEYS,
  loadPreference,
  savePreference,
  saveSportTournament,
  loadSportTournaments,
  deleteSportTournament,
  saveStatistics,
  loadAllStatistics,
} from './storage';

beforeEach(() => {
  localStorage.clear();
});

// ─── Basic CRUD ────────────────────────────────────────────────────────────────

describe('saveData / loadData / clearData', () => {
  it('saves and loads a string value', () => {
    saveData('testKey', 'hello');
    expect(loadData('testKey')).toBe('hello');
  });

  it('saves and loads an object', () => {
    const obj = { name: 'Test', score: 42 };
    saveData('testObj', obj);
    expect(loadData('testObj')).toEqual(obj);
  });

  it('saves and loads an array', () => {
    const arr = [1, 2, 3];
    saveData('testArr', arr);
    expect(loadData('testArr')).toEqual(arr);
  });

  it('returns defaultValue when key does not exist', () => {
    expect(loadData('missing')).toBeNull();
    expect(loadData('missing', [])).toEqual([]);
    expect(loadData('missing', 'fallback')).toBe('fallback');
  });

  it('clearData removes the key', () => {
    saveData('toRemove', { data: true });
    expect(loadData('toRemove')).toEqual({ data: true });
    clearData('toRemove');
    expect(loadData('toRemove')).toBeNull();
  });

  it('clearData returns true on success', () => {
    saveData('key', 'val');
    expect(clearData('key')).toBe(true);
  });

  it('saveData returns true on success', () => {
    expect(saveData('key', 'val')).toBe(true);
  });

  it('handles saving null and undefined', () => {
    saveData('nullVal', null);
    expect(loadData('nullVal')).toBeNull();
  });

  it('handles saving numeric values', () => {
    saveData('num', 99);
    expect(loadData('num')).toBe(99);
  });

  it('handles saving boolean values', () => {
    saveData('bool', true);
    expect(loadData('bool')).toBe(true);
  });

  it('overwrites existing data', () => {
    saveData('key', 'first');
    saveData('key', 'second');
    expect(loadData('key')).toBe('second');
  });
});

// ─── safeSave ──────────────────────────────────────────────────────────────────


describe('savePreference / loadPreference', () => {
  it('saves and loads string preferences', () => {
    expect(savePreference('se_layout', 'grid')).toBe(true);
    expect(loadPreference('se_layout', 'tabs')).toBe('grid');
  });

  it('falls back to the default value when missing', () => {
    expect(loadPreference('missing_preference', 'tabs')).toBe('tabs');
  });

  it('supports JSON-serializable values', () => {
    const value = { theme: 'mono', compact: true };
    expect(savePreference('se_settings', value)).toBe(true);
    expect(loadPreference('se_settings', null)).toEqual(value);
  });
});

describe('safeSave', () => {
  it('returns { success: true } on normal save', () => {
    const result = safeSave('test', { value: 1 });
    expect(result).toEqual({ success: true });
  });

  it('data saved via safeSave is retrievable', () => {
    safeSave('safeKey', [1, 2, 3]);
    expect(loadData('safeKey')).toEqual([1, 2, 3]);
  });

  it('handles QuotaExceededError', () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      const err = new DOMException('quota exceeded', 'QuotaExceededError');
      throw err;
    });

    const result = safeSave('bigData', 'x'.repeat(100));
    expect(result.success).toBe(false);
    expect(result.error).toBe('QuotaExceededError');

    Storage.prototype.setItem = originalSetItem;
  });

  it('handles generic errors', () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('Something went wrong');
    });

    const result = safeSave('failKey', 'data');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');

    Storage.prototype.setItem = originalSetItem;
  });
});

// ─── getStorageUsage ───────────────────────────────────────────────────────────

describe('getStorageUsage', () => {
  it('returns object with used, total, percentage', () => {
    const usage = getStorageUsage();
    expect(usage).toHaveProperty('used');
    expect(usage).toHaveProperty('total');
    expect(usage).toHaveProperty('percentage');
  });

  it('total is 5MB', () => {
    const usage = getStorageUsage();
    expect(usage.total).toBe(5 * 1024 * 1024);
  });

  it('used is 0 when localStorage is empty', () => {
    const usage = getStorageUsage();
    expect(usage.used).toBe(0);
    expect(usage.percentage).toBe(0);
  });

  it('used increases after saving data', () => {
    saveData('someKey', 'someValue');
    const usage = getStorageUsage();
    expect(usage.used).toBeGreaterThan(0);
    expect(usage.percentage).toBeGreaterThan(0);
  });
});

// ─── isStorageNearFull ─────────────────────────────────────────────────────────

describe('isStorageNearFull', () => {
  it('returns false when storage is empty', () => {
    expect(isStorageNearFull()).toBe(false);
  });

  it('returns boolean', () => {
    expect(typeof isStorageNearFull()).toBe('boolean');
  });

  it('uses default threshold of 0.8', () => {
    // With empty storage, well below 80%
    expect(isStorageNearFull()).toBe(false);
  });

  it('accepts custom threshold', () => {
    // With threshold 0, percentage (0) >= 0 is true, so storage is "near full"
    expect(isStorageNearFull(0)).toBe(true);
    // With threshold 1, empty storage (0%) is below 100%
    expect(isStorageNearFull(1)).toBe(false);
  });
});

// ─── isStorageAvailable / isPrivateMode ────────────────────────────────────────

describe('isStorageAvailable', () => {
  it('returns true in test environment (jsdom)', () => {
    expect(isStorageAvailable()).toBe(true);
  });
});

describe('isPrivateMode', () => {
  it('is false in test environment', () => {
    expect(isPrivateMode).toBe(false);
  });
});

// ─── STORAGE_KEYS ──────────────────────────────────────────────────────────────

describe('STORAGE_KEYS', () => {
  it('has all expected keys', () => {
    expect(STORAGE_KEYS.TOURNAMENTS).toBe('se_tournaments');
    expect(STORAGE_KEYS.STATISTICS).toBe('se_statistics');
  });
});

// ─── Generic sport storage ─────────────────────────────────────────────────────

describe('Generic sport storage (saveSportTournament / loadSportTournaments / deleteSportTournament)', () => {
  const key = 'se_test_sport';
  const t1 = { id: 's1', name: 'Tournament Alpha' };
  const t2 = { id: 's2', name: 'Tournament Beta' };

  it('loadSportTournaments returns empty array for unknown key', () => {
    expect(loadSportTournaments(key)).toEqual([]);
  });

  it('saveSportTournament adds a tournament', () => {
    saveSportTournament(key, t1);
    const loaded = loadSportTournaments(key);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(t1);
  });

  it('saveSportTournament adds multiple tournaments', () => {
    saveSportTournament(key, t1);
    saveSportTournament(key, t2);
    expect(loadSportTournaments(key)).toHaveLength(2);
  });

  it('saveSportTournament updates existing by id', () => {
    saveSportTournament(key, t1);
    saveSportTournament(key, { ...t1, name: 'Updated Alpha' });
    const loaded = loadSportTournaments(key);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Updated Alpha');
  });

  it('deleteSportTournament removes by id', () => {
    saveSportTournament(key, t1);
    saveSportTournament(key, t2);
    deleteSportTournament(key, 's1');
    const loaded = loadSportTournaments(key);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('s2');
  });

  it('different sport keys are independent', () => {
    saveSportTournament('se_sport_a', t1);
    saveSportTournament('se_sport_b', t2);
    expect(loadSportTournaments('se_sport_a')).toHaveLength(1);
    expect(loadSportTournaments('se_sport_b')).toHaveLength(1);
    expect(loadSportTournaments('se_sport_a')[0].id).toBe('s1');
    expect(loadSportTournaments('se_sport_b')[0].id).toBe('s2');
  });
});

// ─── Statistics storage ────────────────────────────────────────────────────────

describe('Statistics storage', () => {
  it('loadAllStatistics returns empty object by default', () => {
    expect(loadAllStatistics()).toEqual({});
  });

  it('saveStatistics stores per-sport stats', () => {
    saveStatistics('football', { gamesPlayed: 10 });
    saveStatistics('cricket', { gamesPlayed: 5 });
    const all = loadAllStatistics();
    expect(all.football).toEqual({ gamesPlayed: 10 });
    expect(all.cricket).toEqual({ gamesPlayed: 5 });
  });

  it('saveStatistics overwrites sport stats', () => {
    saveStatistics('football', { gamesPlayed: 10 });
    saveStatistics('football', { gamesPlayed: 20 });
    expect(loadAllStatistics().football).toEqual({ gamesPlayed: 20 });
  });
});
