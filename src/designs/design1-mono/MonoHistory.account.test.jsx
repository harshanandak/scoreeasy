import { matchStorageKey, setMatchStorageScope } from '../../utils/accountStorage';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/AuthContext';
import MonoHistory from './MonoHistory';

const h = vi.hoisted(() => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => ({}), useQuery: () => [], useMutation: () => vi.fn(), usePaginatedQuery: () => h }));
const auth = id => ({ isAuthenticated: Boolean(id), user: id ? { _id: `db-${id}` } : null, clerkUser: id ? { id } : null });
const cloud = { _id: 'result', accountOwnerId: 'X', operatedBy: 'db-X', sport: 'football', team1: 'Account North', team2: 'Account South', score1: 2, score2: 1, winner: 'Account North', date: Date.parse('2026-11-01'), clientMatchId: 'quick:football:cloud' };
const tree = id => <AuthContext.Provider value={auth(id)}><MemoryRouter><MonoHistory /></MemoryRouter></AuthContext.Provider>;
beforeEach(() => {
  localStorage.clear(); setMatchStorageScope('X'); h.results = [cloud]; h.status = 'Exhausted'; h.loadMore.mockReset();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(cleanup);
it('opens a cloud-only stored result read-only without copying it to local history', () => {
  render(tree('X'));
  fireEvent.click(screen.getByRole('button', { name: /Account North .* Account South.*View details/ }));
  expect(screen.getByText(/Saved account result Â· read-only/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Rematch/ })).not.toBeInTheDocument();
  expect(localStorage.getItem(matchStorageKey('se_quickmatches'))).toBeNull();
});
it('removes X rows and an open details sheet on sign-out and an X to Y account switch', () => {
  const { rerender } = render(tree('X'));
  fireEvent.click(screen.getByRole('button', { name: /Account North .* Account South.*View details/ }));
  rerender(tree(null));
  expect(screen.queryByText(/Account North/)).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  rerender(tree('Y'));
  expect(screen.queryByText(/Account North/)).not.toBeInTheDocument();
  rerender(<AuthContext.Provider value={{ ...auth('Y'), user: { _id: 'db-X' } }}><MemoryRouter><MonoHistory /></MemoryRouter></AuthContext.Provider>);
  expect(screen.queryByText(/Account North/)).not.toBeInTheDocument();
});
it('keeps local results while account History is loading or offline and pages older results', () => {
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ id: 'local', sport: 'football', team1: 'Local North', team2: 'Local South', score1: 1, score2: 0, status: 'completed', completedAt: '2026-10-31' }]));
  h.results = []; h.status = 'LoadingFirstPage';
  const { rerender } = render(tree('X'));
  expect(screen.getByText(/Loading account history/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Local North .* Local South.*View details/ })).toBeInTheDocument();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByText(/Offline. Showing matches/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Local North .* Local South.*View details/ })).toBeInTheDocument();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  act(() => window.dispatchEvent(new Event('online')));
  h.status = 'CanLoadMore'; rerender(tree('X'));
  fireEvent.click(screen.getByRole('button', { name: 'Load older account matches' }));
  expect(h.loadMore).toHaveBeenCalledWith(50);
});
