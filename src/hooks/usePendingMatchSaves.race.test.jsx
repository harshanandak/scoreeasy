import { matchStorageKey, setMatchStorageScope } from '../utils/accountStorage';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { usePendingMatchSaves } from './usePendingMatchSaves';
import { attemptMatchSave, enqueueMatchSave } from '../utils/pendingMatchSaves';
import MatchSyncStatus from '../designs/design1-mono/components/MatchSyncStatus';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => ({}), useMutation: () => save }));
const ownerId = 'race-owner';
const clientMatchId = 'race-result';
const key = `se_pending_match:${ownerId}:${clientMatchId}`;
const payload = { clientMatchId, sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1 };
const auth = { isAuthenticated: true, user: { _id: ownerId } };
const localResult = () => JSON.parse(localStorage.getItem(matchStorageKey('se_quickmatches')))[0];

beforeEach(() => {
  localStorage.clear(); setMatchStorageScope(ownerId);
  save.mockReset();
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ ...payload, id: 'race-match', status: 'completed' }]));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([true, false])('keeps the synced marker when A acknowledges between B check and failure writes; next startup prunes without sending (online: %s)', async (online) => {
  const record = enqueueMatchSave(ownerId, payload, 'race-match');
  const write = Storage.prototype.setItem;
  let interleaved = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key && JSON.parse(value).state === 'failed' && !interleaved) {
      interleaved = true;
      // Another tab's acknowledgement lands after B's check but before B's writes.
      write.call(this, matchStorageKey('se_quickmatches'), JSON.stringify([{ ...localResult(), syncOwnerId: ownerId, sync: { status: 'synced' } }]));
      this.removeItem(key);
    }
    return write.call(this, name, value);
  });
  await act(async () => { await attemptMatchSave(record, () => Promise.reject(new TypeError('Failed to fetch'))); });
  expect(interleaved).toBe(true);
  expect(localResult().sync.status).toBe('synced');
  expect(JSON.parse(localStorage.getItem(matchStorageKey(key)))).toMatchObject({ state: 'failed' });

  render(<AuthContext.Provider value={auth}><MatchSyncStatus clientMatchId={clientMatchId} quickMatchId="race-match" /></AuthContext.Provider>);
  expect(screen.getByText('Saved to your account')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
  renderHook(() => usePendingMatchSaves(auth));
  expect(localStorage.getItem(matchStorageKey(key))).toBeNull();
  expect(localResult().sync.status).toBe('synced');
  expect(save).not.toHaveBeenCalled();
});

it('clears an existing stale record on every foreground drain without a network call', () => {
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ ...localResult(), syncOwnerId: ownerId, sync: { status: 'synced' } }]));
  renderHook(() => usePendingMatchSaves(auth));
  for (const event of ['focus', 'online']) {
    localStorage.setItem(matchStorageKey(key), JSON.stringify({ ownerId, payload, quickMatchId: 'race-match', state: 'failed', attempts: 1, nextAttemptAt: 0 }));
    act(() => window.dispatchEvent(new Event(event)));
    expect(localStorage.getItem(matchStorageKey(key))).toBeNull();
  }
  expect(save).not.toHaveBeenCalled();
});

it('does not downgrade a synced result when the same save is enqueued again', () => {
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ ...localResult(), syncOwnerId: ownerId, sync: { status: 'synced' } }]));
  enqueueMatchSave(ownerId, payload, 'race-match');
  expect(localResult().sync.status).toBe('synced');
});
