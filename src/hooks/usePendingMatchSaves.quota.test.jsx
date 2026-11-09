import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { AuthContext } from '../auth/AuthContext';
import { usePendingMatchSaves } from './usePendingMatchSaves';
import { enqueueMatchSave, pendingMatchSaves } from '../utils/pendingMatchSaves';
import MatchSyncStatus from '../designs/design1-mono/components/MatchSyncStatus';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => ({}), useMutation: () => save }));
let owner;
let sequence = 0;
const payload = { clientMatchId: 'status-quota-result', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, date: 1 };
function Worker() { usePendingMatchSaves(); return null; }
function mount() {
  return render(<AuthContext.Provider value={{ isAuthenticated: true, user: { _id: owner } }}>
    <Worker /><MatchSyncStatus clientMatchId={payload.clientMatchId} quickMatchId="status-match" />
  </AuthContext.Provider>);
}
beforeEach(() => {
  owner = `quota-status-${++sequence}`;
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...payload, id: 'status-match', status: 'completed' }]));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  save.mockReset().mockResolvedValue('server-id');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reports durable fallback accurately and retries once when connection returns', async () => {
  enqueueMatchSave(owner, payload, 'status-match');
  mount();
  await waitFor(() => expect(pendingMatchSaves(owner)[0]).toMatchObject({ storageFailed: false }));
  expect(screen.getByRole('status')).toHaveTextContent('Waiting for connection');
  expect(screen.getByRole('status')).not.toHaveTextContent(/keep this screen open|only for this session|lost on refresh/i);
  expect(save).not.toHaveBeenCalled();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved to your account'));
  expect(save).toHaveBeenCalledExactlyOnceWith(payload);
});

it('continues warning when both storage APIs are unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined);
  enqueueMatchSave(owner, payload, 'status-match');
  mount();
  expect(screen.getByRole('status')).toHaveTextContent(/kept only for this session.*lost on refresh/i);
  expect(pendingMatchSaves(owner)[0].storageFailed).toBe(true);
});
