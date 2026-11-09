import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { ConvexError } from 'convex/values';
import { AuthContext } from '../auth/AuthContext';
import { usePendingMatchSaves } from './usePendingMatchSaves';
import { attemptMatchSave, enqueueMatchSave, hydratePendingMatchSaves, pendingMatchSaves, tournamentCompletionId } from '../utils/pendingMatchSaves';
import { loadPendingSaveFallback, storePendingSaveFallback } from '../utils/pendingMatchSaveStore';
import MatchSyncStatus from '../designs/design1-mono/components/MatchSyncStatus';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => ({}), useMutation: () => save }));
const writeLocal = Storage.prototype.setItem;
const reference = { storageKey: 'se_football', tournamentId: 100, matchId: 'final' };
const payload = { clientMatchId: 'tournament:football:100:final', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1 };
let owner;
let sequence = 0;
function Worker() { usePendingMatchSaves(); return null; }
function mount() {
  render(<AuthContext.Provider value={{ isAuthenticated: true, user: { _id: owner } }}>
    <Worker /><MatchSyncStatus clientMatchId={payload.clientMatchId} tournamentMatch={reference} />
  </AuthContext.Provider>);
}
function fixture(result) {
  const match = { id: 'final', status: 'completed', score1: result.score1, score2: result.score2, completedAt: result.date };
  writeLocal.call(localStorage, 'se_football', JSON.stringify([{ id: 100, matches: [match] }]));
  return match;
}
function failFallbackWrites() {
  const transaction = IDBDatabase.prototype.transaction;
  return vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (stores, mode, ...options) {
    if (mode === 'readwrite') throw new DOMException('Full', 'QuotaExceededError');
    return transaction.call(this, stores, mode, ...options);
  });
}
async function seedDurable() {
  fixture(payload);
  enqueueMatchSave(owner, payload, undefined, reference);
  await waitFor(() => expect(pendingMatchSaves(owner)[0]).toMatchObject({ storageFailed: false }));
}
beforeEach(() => {
  owner = `dirty-hydration-${++sequence}`;
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  save.mockReset().mockResolvedValue('server-id');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps a replacement and its warning through readable IDB hydration after its write fails, then sends its own fingerprint', async () => {
  await seedDurable();
  failFallbackWrites();
  const replacement = { ...payload, score1: 0, score2: 3, date: 2 };
  const match = fixture(replacement);
  enqueueMatchSave(owner, replacement, undefined, reference);
  await hydratePendingMatchSaves(owner);
  expect((await loadPendingSaveFallback(owner))[0]).toMatchObject({ payload });
  expect(pendingMatchSaves(owner)[0]).toMatchObject({
    payload: replacement, completionId: tournamentCompletionId(match), state: 'pending', storageFailed: true,
  });
  mount();
  await act(async () => { window.dispatchEvent(new Event('focus')); await hydratePendingMatchSaves(owner); });
  expect(screen.getByRole('status')).toHaveTextContent(/kept only for this session.*lost on refresh/i);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith(replacement));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved to your account'));
  expect(pendingMatchSaves(owner)).toEqual([]);
  expect(JSON.parse(localStorage.getItem('se_football'))[0].matches).toEqual([match]);
});

it('keeps an uncommitted permanent rejection terminal and session-only through hydration and foreground retries', async () => {
  await seedDurable();
  let writes;
  save.mockImplementationOnce(async () => { writes = failFallbackWrites(); throw new ConvexError('Rejected'); });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await attemptMatchSave(pendingMatchSaves(owner)[0], save);
  await hydratePendingMatchSaves(owner);
  expect((await loadPendingSaveFallback(owner))[0]).toMatchObject({ state: 'syncing', terminal: false });
  expect(pendingMatchSaves(owner)[0]).toMatchObject({ state: 'failed', terminal: true, storageFailed: true });
  mount();
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    await hydratePendingMatchSaves(owner);
  });
  expect(screen.getByRole('status')).toHaveTextContent(/Couldn't save.*kept only for this session.*lost on refresh/i);
  expect(pendingMatchSaves(owner)[0]).toMatchObject({ terminal: true, storageFailed: true });
  expect(save).toHaveBeenCalledTimes(1);

  // A matching acknowledgement from another tab still outranks the dirty rejection.
  writes.mockRestore();
  const stored = (await loadPendingSaveFallback(owner))[0];
  await storePendingSaveFallback(`se_pending_match:${encodeURIComponent(owner)}:${encodeURIComponent(payload.clientMatchId)}`, { ...stored, state: 'synced' });
  await act(async () => { window.dispatchEvent(new Event('focus')); await hydratePendingMatchSaves(owner); });
  expect(pendingMatchSaves(owner, true)[0]).toMatchObject({ state: 'synced', storageFailed: false });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved to your account'));
  expect(pendingMatchSaves(owner)).toEqual([]);
  expect(save).toHaveBeenCalledTimes(1);
});

it('clears the session-only failure after manual Retry commits and succeeds', async () => {
  await seedDurable();
  let writes;
  save.mockImplementationOnce(async () => { writes = failFallbackWrites(); throw new ConvexError('Rejected'); });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await attemptMatchSave(pendingMatchSaves(owner)[0], save);
  await hydratePendingMatchSaves(owner);
  mount();
  expect(screen.getByRole('status')).toHaveTextContent(/Couldn't save.*kept only for this session.*lost on refresh/i);
  writes.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved to your account'));
  await act(async () => { await hydratePendingMatchSaves(owner); });
  expect((await loadPendingSaveFallback(owner))[0]).toMatchObject({ state: 'synced', storageFailed: false });
  expect(screen.getByRole('status')).not.toHaveTextContent(/only for this session|lost on refresh/i);
  expect(pendingMatchSaves(owner)).toEqual([]);
  expect(save).toHaveBeenCalledTimes(2);
});
