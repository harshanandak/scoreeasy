import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimGuestMatchSaves, consumeGuestUploadNotice } from './guestMatchUploads';
import { enqueueQuickMatchSave } from '../hooks/useMatchSync';
import { loadQuickMatch, saveQuickMatch, saveSportTournament, loadSportTournaments } from './storage';
import { attemptMatchSave, enqueueMatchSave, pendingMatchSaves } from './pendingMatchSaves';

const guest = { id: 'guest', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, winner: 'North', status: 'completed', completedAt: '2026-11-01T12:00:00Z' };
beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
describe('automatic guest upload claim', () => {
  it('claims once for X, survives another scan and never queues X for Y', () => {
    saveQuickMatch(guest);
    expect(claimGuestMatchSaves('X')).toEqual(['quick:football:guest']);
    expect(claimGuestMatchSaves('X')).toEqual([]);
    expect(claimGuestMatchSaves('Y')).toEqual([]);
    expect(pendingMatchSaves('X')).toHaveLength(1);
    expect(pendingMatchSaves('Y')).toHaveLength(0);
    expect(loadQuickMatch('guest').syncOwnerId).toBe('X');
    expect(pendingMatchSaves('X')[0].payload.date).toBe(Date.parse(guest.completedAt));
  });
  it('leaves active matches intact and claims them only after completion', () => {
    saveQuickMatch({ ...guest, status: 'in-progress', completedAt: undefined, winner: undefined });
    expect(loadQuickMatch('guest').status).toBe('in-progress');
    expect(claimGuestMatchSaves('X')).toEqual([]);
    expect(loadQuickMatch('guest').status).toBe('in-progress');
    saveQuickMatch(guest);
    expect(claimGuestMatchSaves('X')).toHaveLength(1);
  });
  it('never claims a previously owned match, even without a pending record', () => {
    saveQuickMatch({ ...guest, syncOwnerId: 'X', sync: { status: 'synced' } });
    expect(claimGuestMatchSaves('Y')).toEqual([]);
  });
  it('keeps the first account binding when a stale board overwrites local sync metadata', () => {
    saveQuickMatch({ ...guest, id: 'stale' });
    claimGuestMatchSaves('X');
    saveQuickMatch({ ...guest, id: 'stale' });
    expect(claimGuestMatchSaves('Y')).toEqual([]);
    expect(enqueueQuickMatchSave({ sport: 'football', isAuthenticated: true, user: { _id: 'Y' } }, { ...guest, id: 'stale' }).status).toBe('idle');
    expect(pendingMatchSaves('Y')).toEqual([]);
  });
  it('leaves the result local when the owner claim cannot be persisted', () => {
    saveQuickMatch({ ...guest, id: 'quota' });
    const original = Storage.prototype.setItem;
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key.startsWith('se_guest_match_claim:')) throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    expect(claimGuestMatchSaves('X')).toEqual([]);
    expect(loadQuickMatch('quota').syncOwnerId).toBeUndefined();
    blocked.mockRestore();
    expect(claimGuestMatchSaves('X')).toHaveLength(1);
  });
  it('queues guest tournament results through the same owner-bound queue', () => {
    saveSportTournament('se_football', { id: 'cup', teams: [{ id: 'a', name: 'North' }, { id: 'b', name: 'South' }], matches: [{ ...guest, team1Id: 'a', team2Id: 'b' }] });
    expect(claimGuestMatchSaves('X')).toContain('tournament:football:cup:guest');
    expect(loadSportTournaments('se_football')[0].matches[0].syncOwnerId).toBe('X');
    expect(claimGuestMatchSaves('Y')).toEqual([]);
    const record = pendingMatchSaves('X')[0];
    expect(enqueueMatchSave('Y', record.payload, undefined, record.tournamentMatch)).toBeUndefined();
    expect(pendingMatchSaves('Y')).toEqual([]);
    expect(loadSportTournaments('se_football')[0].matches[0].syncOwnerId).toBe('X');
  });
  it('retains the claim offline and retries without duplicating the account save', async () => {
    saveQuickMatch(guest);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    claimGuestMatchSaves('X');
    const save = vi.fn().mockResolvedValue('cloud-id');
    const record = pendingMatchSaves('X')[0];
    expect(consumeGuestUploadNotice('X')).toBe(0);
    expect((await attemptMatchSave(record, save)).status).toBe('pending');
    expect(save).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    expect((await attemptMatchSave(record, save)).status).toBe('synced');
    expect(claimGuestMatchSaves('Y')).toEqual([]);
    expect(claimGuestMatchSaves('X')).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].expectedOwnerId).toBe('X');
    expect(consumeGuestUploadNotice('Y')).toBe(0);
    expect(consumeGuestUploadNotice('X')).toBe(1);
    expect(consumeGuestUploadNotice('X')).toBe(0);
  });
});
