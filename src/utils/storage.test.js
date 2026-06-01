import {
  saveData,
  loadData,
  listDataKeys,
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
  deleteQuickMatch,
  loadCompletedQuickMatches,
  loadQuickMatches,
  replaceCompletedQuickMatches,
  saveQuickMatch,
  saveQuickMatches,
  isStaleQuickMatchDraft,
  saveStatistics,
  loadAllStatistics,
  createMemoryFallback,
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

  it('lists keys from the active storage backend', () => {
    saveData('se_key_one', { ok: true });
    saveData('se_key_two', { ok: true });

    expect(listDataKeys()).toEqual(expect.arrayContaining(['se_key_one', 'se_key_two']));
  });

  it('memory fallback supports key enumeration', () => {
    const fallback = createMemoryFallback();
    fallback.setItem('se_memory_one', '1');
    fallback.setItem('se_memory_two', '2');

    expect(fallback.length).toBe(2);
    expect([fallback.key(0), fallback.key(1)]).toEqual(expect.arrayContaining([
      'se_memory_one',
      'se_memory_two',
    ]));
    expect(fallback.key(2)).toBeNull();
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

describe('Quick match persistence normalization', () => {
  const freshDate = '2026-06-01T10:00:00.000Z';
  const staleDate = '2026-05-29T10:00:00.000Z';
  const now = new Date('2026-06-01T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores completed quick matches for every supported sport with terminal status', () => {
    const sports = [
      'volleyball',
      'badminton',
      'tabletennis',
      'tennis',
      'pickleball',
      'squash',
      'football',
      'basketball',
      'hockey',
      'handball',
      'futsal',
      'kabaddi',
      'rugby',
      'cricket',
    ];

    sports.forEach((sport, index) => {
      expect(saveQuickMatch({
        id: `${sport}-${index}`,
        sport,
        team1: `${sport} A`,
        team2: `${sport} B`,
        score1: index + 1,
        score2: index,
        winner: `${sport} A`,
        completedAt: freshDate,
      })).toBe(true);
    });

    const completed = loadCompletedQuickMatches();
    expect(completed).toHaveLength(sports.length);
    const bySportName = (a, b) => a.localeCompare(b);
    expect(completed.map((match) => match.sport).sort(bySportName)).toEqual([...sports].sort(bySportName));
    expect(completed.every((match) => match.status === 'completed')).toBe(true);
  });

  it('cleans stale drafts, phantom 0-0 ties, and impossible durations while keeping valid drafts', () => {
    saveQuickMatches([
      {
        id: 'stale-draft',
        sport: 'football',
        team1: 'Old A',
        team2: 'Old B',
        status: 'in-progress',
        updatedAt: staleDate,
        score1: 1,
        score2: 0,
      },
      {
        id: 'fresh-draft',
        sport: 'football',
        team1: 'Fresh A',
        team2: 'Fresh B',
        status: 'in-progress',
        updatedAt: freshDate,
        score1: 1,
        score2: 0,
      },
      {
        id: 'phantom',
        sport: 'football',
        team1: 'Ghost A',
        team2: 'Ghost B',
        status: 'completed',
        winner: 'Tie',
        score1: 0,
        score2: 0,
        completedAt: freshDate,
      },
      {
        id: 'real-result',
        sport: 'football',
        team1: 'Real A',
        team2: 'Real B',
        status: 'completed',
        winner: 'Real A',
        score1: 3,
        score2: 1,
        elapsedSeconds: 572 * 60 * 60,
        completedAt: freshDate,
      },
      {
        id: 'scoreless-draw',
        sport: 'football',
        team1: 'Nil A',
        team2: 'Nil B',
        status: 'completed',
        winner: 'Draw',
        score1: 0,
        score2: 0,
        completedAt: freshDate,
      },
    ]);

    expect(loadQuickMatches().map((match) => match.id)).toEqual(['fresh-draft', 'real-result', 'scoreless-draw']);
    expect(loadCompletedQuickMatches()).toEqual([
      expect.objectContaining({
        id: 'real-result',
        status: 'completed',
        elapsedSeconds: undefined,
      }),
      expect.objectContaining({
        id: 'scoreless-draw',
        status: 'completed',
        winner: 'Draw',
      }),
    ]);
  });

  it('replaces completed quick matches without deleting active drafts', () => {
    saveQuickMatches([
      {
        id: 'active-draft',
        sport: 'football',
        team1: 'Draft A',
        team2: 'Draft B',
        status: 'in-progress',
        updatedAt: freshDate,
        score1: 1,
        score2: 0,
      },
      {
        id: 'completed-match',
        sport: 'football',
        team1: 'Done A',
        team2: 'Done B',
        status: 'completed',
        winner: 'Done A',
        score1: 2,
        score2: 1,
        completedAt: freshDate,
      },
    ]);

    expect(deleteQuickMatch('completed-match')).toBe(true);
    expect(loadQuickMatches().map((match) => match.id)).toEqual(['active-draft']);

    expect(replaceCompletedQuickMatches([
      {
        id: 'restored-match',
        sport: 'football',
        team1: 'Restored A',
        team2: 'Restored B',
        status: 'completed',
        winner: 'Restored A',
        score1: 4,
        score2: 2,
        completedAt: freshDate,
      },
    ])).toBe(true);

    expect(loadQuickMatches().map((match) => match.id)).toEqual(['active-draft', 'restored-match']);
  });

  it('detects stale per-sport quick match drafts by updated timestamp', () => {
    expect(isStaleQuickMatchDraft({
      phase: 'scoring',
      sport: 'football',
      updatedAt: staleDate,
    })).toBe(true);

    expect(isStaleQuickMatchDraft({
      phase: 'scoring',
      sport: 'football',
      updatedAt: freshDate,
    })).toBe(false);

    expect(isStaleQuickMatchDraft({
      phase: 'scoring',
      sport: 'tennis',
      createdAt: staleDate,
      draftState: { savedAt: freshDate },
    })).toBe(false);

    expect(isStaleQuickMatchDraft({
      status: 'completed',
      completedAt: staleDate,
    })).toBe(false);
  });
});
