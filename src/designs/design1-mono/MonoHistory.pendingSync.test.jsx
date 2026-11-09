import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/AuthContext';
import { useMatchSync } from '../../hooks/useMatchSync';
import MonoHistory from './MonoHistory';
import MatchSyncStatus from './components/MatchSyncStatus';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => ({}), useMutation: () => save, useQuery: () => [], usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: () => {} }) }));
vi.mock('../../mobile/share', () => ({ shareText: vi.fn() }));
const auth = { isAuthenticated: true, user: { _id: 'owner' } };
const match = { id: 'm1', sport: 'football', team1: 'North', team2: 'South', score1: 2, score2: 1, winner: 'North', status: 'completed', completedAt: '2026-11-01T12:00:00Z' };
function Harness() {
  const sync = useMatchSync({ ...auth, sport: 'football', team1Players: [], team2Players: [] });
  return <><button onClick={() => sync.syncMatch(match)}>Save cloud</button><MonoHistory /></>;
}
beforeEach(() => { localStorage.clear(); localStorage.setItem('se_quickmatches', JSON.stringify([match])); save.mockReset(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
afterEach(cleanup);

it('shows a failed-save badge in History and clears it after Retry succeeds', async () => {
  save.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue('server-id');
  render(<AuthContext.Provider value={auth}><MemoryRouter><Harness /></MemoryRouter></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Save cloud' }));
  expect(await screen.findByText("Couldn't save")).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByText("Couldn't save")).not.toBeInTheDocument());
  expect(save).toHaveBeenCalledTimes(2);
});

it('shows Waiting for connection while offline and saves on reconnect', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  save.mockResolvedValue('server-id');
  render(<AuthContext.Provider value={auth}><MemoryRouter><Harness /></MemoryRouter></AuthContext.Provider>);
  fireEvent.click(screen.getByRole('button', { name: 'Save cloud' }));
  expect(await screen.findByText('Waiting for connection')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText('Waiting for connection')).not.toBeInTheDocument());
});

it('shows confirmed account status on Finish and hides every cloud status for guests', () => {
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...match, clientMatchId: 'quick:football:m1', syncOwnerId: 'owner', sync: { status: 'synced' } }]));
  const { rerender } = render(<AuthContext.Provider value={auth}><MatchSyncStatus clientMatchId="quick:football:m1" quickMatchId="m1" /></AuthContext.Provider>);
  expect(screen.getByText('Saved to your account')).toBeInTheDocument();
  rerender(<AuthContext.Provider value={{ isAuthenticated: false }}><MatchSyncStatus clientMatchId="quick:football:m1" quickMatchId="m1" /></AuthContext.Provider>);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
