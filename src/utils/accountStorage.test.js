import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const match = { id: 'offline', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, status: 'completed', completedAt: '2026-11-01' };
let scope, storage;
beforeEach(async () => {
  vi.resetModules(); localStorage.clear();
  scope = await import('./accountStorage');
  storage = await import('./storage');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name, run) => Promise.resolve().then(run) } });
});
afterEach(() => vi.restoreAllMocks());
const full = () => new DOMException('Full', 'QuotaExceededError');

describe('account namespaces', () => {
  it('isolates untagged account results from guest and another account, including after reload', async () => {
    scope.setMatchStorageScope('clerk-X');
    expect(storage.saveQuickMatch(match)).toBe(true);
    scope.setMatchStorageScope(null);
    expect(storage.loadQuickMatches()).toEqual([]);
    scope.setMatchStorageScope('clerk-Y');
    expect(storage.loadQuickMatches()).toEqual([]);
    vi.resetModules();
    scope = await import('./accountStorage'); storage = await import('./storage');
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadQuickMatch(match.id)).toMatchObject(match);
  });

  it('never falls back to guest when an account write fails and retains the storage warning', async () => {
    const health = await import('./saveHealth');
    scope.setMatchStorageScope('clerk-X');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw full(); });
    expect(storage.saveQuickMatch(match)).toBe(false);
    expect(health.hasOutstandingSaveFailure()).toBe(true);
    scope.setMatchStorageScope(null);
    expect(storage.loadQuickMatches()).toEqual([]);
    expect(localStorage.getItem('se_quickmatches')).toBeNull();
  });

  it('binds delayed writes to their account after sign-out', () => {
    scope.setMatchStorageScope('clerk-X');
    const lateWrite = () => scope.withMatchStorageScope('clerk-X', () => storage.saveQuickMatch(match));
    scope.setMatchStorageScope(null);
    lateWrite();
    expect(storage.loadQuickMatches()).toEqual([]);
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadQuickMatch(match.id)).toMatchObject(match);
  });

  it('keeps two tab resolvers independent over the same browser storage', async () => {
    const tabX = scope; tabX.setMatchStorageScope('clerk-X');
    vi.resetModules();
    const tabY = await import('./accountStorage'); tabY.setMatchStorageScope('clerk-Y');
    localStorage.setItem(tabX.matchStorageKey('se_quickmatches'), JSON.stringify([match]));
    expect(localStorage.getItem(tabY.matchStorageKey('se_quickmatches'))).toBeNull();
    expect(tabX.matchStorageKey('se_quickmatches')).not.toBe(tabY.matchStorageKey('se_quickmatches'));
  });

  it.each(['se_quickmatch_draft_football_offline', 'se_quickmatch_draft_tennis_offline', 'se_kabaddi_backup_kabaddi_offline_before_kabaddi_v2', 'gs_sessions', 'gs_history', 'se_statistics', 'se_matches_pending_undo'])('scopes %s and returns only active logical keys', key => {
    scope.setMatchStorageScope('clerk-X');
    expect(storage.saveData(key, { score: 12 })).toBe(true);
    expect(storage.listDataKeys()).toContain(key);
    scope.setMatchStorageScope(null);
    expect(storage.loadData(key)).toBeNull();
    expect(storage.listDataKeys()).not.toContain(key);
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadData(key)).toEqual({ score: 12 });
  });
});

describe('copy, verify, remove migration', () => {
  it('routes legacy ownership to separate spaces and is repeatable', () => {
    localStorage.setItem('se_quickmatches', JSON.stringify([match, { ...match, id: 'owned', syncOwnerId: 'clerk-X' }]));
    expect(storage.loadQuickMatches().map(m => m.id)).toEqual(['offline']);
    expect(localStorage.getItem('se_quickmatches')).toBeNull();
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadQuickMatches().map(m => m.id)).toEqual(['owned']);
    scope.migrateMatchStorage(); scope.migrateMatchStorage();
    expect(storage.loadQuickMatches()).toHaveLength(1);
  });

  it('retains originals during quota failure, hides unmigrated owned data, and resumes', () => {
    const original = JSON.stringify([{ ...match, syncOwnerId: 'clerk-X' }]);
    localStorage.setItem('se_quickmatches', original);
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw full(); });
    expect(storage.loadQuickMatches()).toEqual([]);
    expect(localStorage.getItem('se_quickmatches')).toBe(original);
    blocked.mockRestore();
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadQuickMatch(match.id)).toMatchObject(match);
    expect(localStorage.getItem('se_quickmatches')).toBeNull();
  });

  it('resumes after copy succeeded but deleting the original was interrupted, preserving newer scores', () => {
    localStorage.setItem('se_quickmatches', JSON.stringify([{ ...match, syncOwnerId: 'clerk-X' }]));
    const blocked = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('interrupted'); });
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadQuickMatch(match.id)).toMatchObject(match);
    expect(storage.saveQuickMatch({ ...match, score1: 9 })).toBe(true);
    blocked.mockRestore();
    scope.migrateMatchStorage();
    expect(storage.loadQuickMatch(match.id).score1).toBe(9);
    expect(localStorage.getItem('se_quickmatches')).toBeNull();
  });

  it('recognizes the Convex ID alias only for the matching Clerk account', () => {
    localStorage.setItem('se_quickmatches', JSON.stringify([{ ...match, syncOwnerId: 'db-X' }]));
    scope.setMatchStorageScope('clerk-Y', 'db-Y');
    expect(storage.loadQuickMatches()).toEqual([]);
    scope.setMatchStorageScope('clerk-X', 'db-X');
    expect(storage.loadQuickMatch(match.id)).toMatchObject(match);
  });

  it('splits mixed-owner tournament fixtures without exposing another account and keeps guest results', () => {
    localStorage.setItem('se_football', JSON.stringify([{ id: 'cup', matches: [match, { ...match, id: 'X', syncOwnerId: 'clerk-X' }, { ...match, id: 'Y', syncOwnerId: 'clerk-Y' }] }]));
    expect(storage.loadSportTournaments('se_football')[0].matches.map(m => m.id)).toEqual(['offline']);
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadSportTournaments('se_football')[0].matches.map(m => m.id)).toEqual(['X']);
  });

  it.each(['se_kabaddi_backup_kabaddi_old_before_kabaddi_v2', 'se_quickmatch_draft_kabaddi_old_before_kabaddi_v2'])('preserves Kabaddi original backup %s without treating it as a playable draft', async key => {
    const backup = { syncOwnerId: 'clerk-X', phase: 'scoring', sport: 'kabaddi', scores: { score1: 7 } };
    localStorage.setItem(key, JSON.stringify(backup));
    expect(storage.loadData(key)).toBeNull();
    scope.setMatchStorageScope('clerk-X');
    expect(storage.loadData(key)).toEqual(backup);
    const { isKabaddiMigrationBackup } = await import('./kabaddiMigrationBackups');
    expect(storage.listDataKeys().filter(isKabaddiMigrationBackup)).toEqual([key]);
  });
});

describe('guest transfer and account replay', () => {
  it('moves only guest matches and tournaments, uploads them, and resumes account-owned unsynced results', async () => {
    storage.saveQuickMatch(match);
    storage.saveSportTournament('se_football', { id: 'cup', matches: [{ ...match, id: 'fixture' }] });
    scope.setMatchStorageScope('clerk-Y'); storage.saveQuickMatch({ ...match, id: 'private-Y' });
    scope.setMatchStorageScope('clerk-X'); storage.saveQuickMatch({ ...match, id: 'private-X' });
    const { claimGuestMatchSaves } = await import('./guestMatchUploads');
    const queue = await import('./pendingMatchSaves');
    await claimGuestMatchSaves('clerk-X');
    expect(storage.loadQuickMatches().map(m => m.id).sort()).toEqual(['offline', 'private-X']);
    expect(storage.loadSportTournaments('se_football')[0].matches[0].id).toBe('fixture');
    expect(queue.pendingMatchSaves('clerk-X').map(r => r.payload.clientMatchId).sort()).toEqual(['quick:football:offline', 'quick:football:private-X', 'tournament:football:cup:fixture']);
    scope.setMatchStorageScope(null); expect(storage.loadQuickMatches()).toEqual([]);
    expect(storage.loadSportTournaments('se_football')).toEqual([]);
    scope.setMatchStorageScope('clerk-Y');
    expect(storage.loadQuickMatches().map(m => m.id)).toEqual(['private-Y']);
    scope.setMatchStorageScope('clerk-X');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const send = vi.fn().mockResolvedValue('saved');
    for (const record of queue.pendingMatchSaves('clerk-X')) await queue.attemptMatchSave(record, send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.every(([payload]) => payload.expectedOwnerId === 'clerk-X')).toBe(true);
  });

  it('retains the guest original and retries transfer when account storage is full', async () => {
    storage.saveQuickMatch(match);
    scope.setMatchStorageScope('clerk-X');
    const original = Storage.prototype.setItem;
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === scope.matchStorageKey('se_quickmatches')) throw full();
      return original.call(this, key, value);
    });
    const { claimGuestMatchSaves } = await import('./guestMatchUploads');
    expect(await claimGuestMatchSaves('clerk-X')).toEqual([]);
    expect(storage.loadQuickMatches()).toEqual([]);
    scope.setMatchStorageScope(null); expect(storage.loadQuickMatch(match.id)).toMatchObject(match);
    blocked.mockRestore(); scope.setMatchStorageScope('clerk-X');
    expect(await claimGuestMatchSaves('clerk-X')).toContain('quick:football:offline');
    expect(storage.loadQuickMatch(match.id)).toMatchObject(match);
    scope.setMatchStorageScope(null); expect(storage.loadQuickMatches()).toEqual([]);
  });
});
