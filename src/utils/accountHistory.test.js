import { describe, expect, it } from 'vitest';
import { cloudHistoryEntry, mergeAccountHistory } from './accountHistory';

describe('account History union', () => {
  const local = { id: 'local', clientMatchId: 'same', team1: 'Local', date: '2026-11-01', syncOwnerId: 'X', sync: { status: 'pending' } };
  const cloud = { _id: 'cloud', accountOwnerId: 'X', operatedBy: 'db-X', clientMatchId: 'same', sport: 'football', team1: 'Cloud', team2: 'Other', score1: 2, score2: 1, winner: 'Cloud', date: Date.parse('2026-11-02') };
  it('keeps an unsynced local revision once and sorts the union newest first', () => {
    const newer = { ...cloud, _id: 'new', clientMatchId: 'new', date: Date.parse('2026-11-03') };
    expect(mergeAccountHistory([local], [cloud, newer], 'X', 'db-X').map(m => m.team1)).toEqual(['Cloud', 'Local']);
  });
  it('uses the account result when the local copy has been acknowledged', () => {
    expect(mergeAccountHistory([{ ...local, sync: { status: 'synced' } }], [cloud], 'X', 'db-X')).toMatchObject([{ team1: 'Cloud', cloudOnly: true }]);
  });
  it('hides X local and cached cloud matches immediately from a guest or Y', () => {
    expect(mergeAccountHistory([local], [cloud], null, null)).toEqual([]);
    expect(mergeAccountHistory([local], [cloud], 'Y', 'db-Y')).toEqual([]);
    expect(mergeAccountHistory([local], [cloud], 'Y', 'db-X')).toEqual([]);
    expect(mergeAccountHistory([{ id: 'guest' }, local], [], 'Y', 'db-Y')).toEqual([{ id: 'guest' }]);
  });
  it('does not invent a board, winner or completed score for cloud summaries', () => {
    expect(cloudHistoryEntry({ ...cloud, resultType: 'abandoned' })).toMatchObject({ score: '2 - 1', winner: null, cloudOnly: true, resultType: 'abandoned' });
    expect(cloudHistoryEntry({ ...cloud, detail: { sets: [{ score1: 25, score2: 20 }] } }).score).toBe('2 - 1');
    expect(cloudHistoryEntry({ ...cloud, clientMatchId: undefined }).id).toBe('cloud-cloud');
  });
});
