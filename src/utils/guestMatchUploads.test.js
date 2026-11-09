import { setMatchStorageScope, withMatchStorageScope, matchStorageKey } from './accountStorage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimGuestMatchSaves, consumeGuestUploadNotice } from './guestMatchUploads';
import { enqueueQuickMatchSave } from '../hooks/useMatchSync';
import { loadQuickMatch, saveQuickMatch, saveSportTournament, loadSportTournaments } from './storage';
import { attemptMatchSave, enqueueMatchSave, pendingMatchSaves } from './pendingMatchSaves';

const guest = { id: 'guest', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, winner: 'North', status: 'completed', completedAt: '2026-11-01T12:00:00Z' };
beforeEach(() => { localStorage.clear(); setMatchStorageScope(null); Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name, run) => Promise.resolve().then(run) } }); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
describe('automatic guest upload claim', () => {
  it('claims once for X, survives another scan and never queues X for Y', async () => {
    saveQuickMatch(guest);
    expect(await claimGuestMatchSaves('X')).toEqual(['quick:football:guest']);
    expect(await claimGuestMatchSaves('X')).toEqual([]);
    expect(await claimGuestMatchSaves('Y')).toEqual([]);
    expect(pendingMatchSaves('X')).toHaveLength(1);
    expect(pendingMatchSaves('Y')).toHaveLength(0);
    expect(withMatchStorageScope('X', () => loadQuickMatch('guest')).syncOwnerId).toBe('X');
    expect(pendingMatchSaves('X')[0].payload.date).toBe(Date.parse(guest.completedAt));
  });
  it('leaves active matches intact and claims them only after completion', async () => {
    saveQuickMatch({ ...guest, status: 'in-progress', completedAt: undefined, winner: undefined });
    expect(loadQuickMatch('guest').status).toBe('in-progress');
    expect(await claimGuestMatchSaves('X')).toEqual([]);
    expect(loadQuickMatch('guest')).toBeNull();
    expect(withMatchStorageScope('X', () => loadQuickMatch('guest')).status).toBe('in-progress');
    withMatchStorageScope('X', () => saveQuickMatch(guest));
    expect(await claimGuestMatchSaves('X')).toHaveLength(1);
  });
  it('never claims a previously owned match, even without a pending record', async () => {
    withMatchStorageScope('X', () => saveQuickMatch({ ...guest, syncOwnerId: 'X', sync: { status: 'synced' } }));
    expect(await claimGuestMatchSaves('Y')).toEqual([]);
  });
  it('keeps the first account binding when a stale board overwrites local sync metadata', async () => {
    saveQuickMatch({ ...guest, id: 'stale' });
    await claimGuestMatchSaves('X');
    withMatchStorageScope('X', () => saveQuickMatch({ ...guest, id: 'stale' }));
    expect(await claimGuestMatchSaves('Y')).toEqual([]);
    expect(withMatchStorageScope('Y', () => loadQuickMatch('stale'))).toBeNull();
    expect(enqueueQuickMatchSave({ sport: 'football', isAuthenticated: true, user: { _id: 'Y' } }, { ...guest, id: 'stale' }).status).toBe('idle');
    expect(pendingMatchSaves('Y')).toEqual([]);
  });
  it('leaves the result local when the owner claim cannot be persisted', async () => {
    saveQuickMatch({ ...guest, id: 'quota' });
    const original = Storage.prototype.setItem;
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === matchStorageKey('se_quickmatches', 'X')) throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    expect(await claimGuestMatchSaves('X')).toEqual([]);
    expect(loadQuickMatch('quota').syncOwnerId).toBeUndefined();
    expect(withMatchStorageScope('X', () => loadQuickMatch('quota'))).toBeNull();
    blocked.mockRestore();
    expect(await claimGuestMatchSaves('X')).toHaveLength(1);
  });
  it('queues guest tournament results through the same owner-bound queue', async () => {
    saveSportTournament('se_football', { id: 'cup', teams: [{ id: 'a', name: 'North' }, { id: 'b', name: 'South' }], matches: [{ ...guest, team1Id: 'a', team2Id: 'b' }] });
    expect(await claimGuestMatchSaves('X')).toContain('tournament:football:cup:guest');
    expect(withMatchStorageScope('X', () => loadSportTournaments('se_football'))[0].matches[0].syncOwnerId).toBe('X');
    expect(await claimGuestMatchSaves('Y')).toEqual([]);
    const record = pendingMatchSaves('X')[0];
    expect(enqueueMatchSave('Y', record.payload, undefined, record.tournamentMatch)).toBeUndefined();
    expect(withMatchStorageScope('Y', () => loadSportTournaments('se_football'))).toEqual([]);
    expect(pendingMatchSaves('Y')).toEqual([]);
    expect(withMatchStorageScope('X', () => loadSportTournaments('se_football'))[0].matches[0].syncOwnerId).toBe('X');
  });
  it('retains the claim offline and retries without duplicating the account save', async () => {
    saveQuickMatch(guest);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await claimGuestMatchSaves('X');
    const save = vi.fn().mockResolvedValue('cloud-id');
    const record = pendingMatchSaves('X')[0];
    expect(consumeGuestUploadNotice('X')).toBe(0);
    expect((await attemptMatchSave(record, save)).status).toBe('pending');
    expect(save).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    expect((await attemptMatchSave(record, save)).status).toBe('synced');
    expect(await claimGuestMatchSaves('Y')).toEqual([]);
    expect(await claimGuestMatchSaves('X')).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].expectedOwnerId).toBe('X');
    expect(consumeGuestUploadNotice('Y')).toBe(0);
    expect(consumeGuestUploadNotice('X')).toBe(1);
    expect(consumeGuestUploadNotice('X')).toBe(0);
  });
});
