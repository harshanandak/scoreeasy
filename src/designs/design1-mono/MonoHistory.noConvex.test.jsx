import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../auth/AuthContext';
import MonoHistory from './MonoHistory';
import MatchSyncStatus from './components/MatchSyncStatus';

const clientMatchId = 'quick:football:no-provider';
const key = `se_pending_match:owner:${encodeURIComponent(clientMatchId)}`;
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
  localStorage.setItem('se_quickmatches', JSON.stringify([{
    id: 'no-provider', clientMatchId, sport: 'football', team1: 'North', team2: 'South',
    score1: 2, score2: 1, winner: 'North', status: 'completed', completedAt: '2026-11-01T12:00:00Z',
  }]));
  localStorage.setItem(key, JSON.stringify({ ownerId: 'owner', quickMatchId: 'no-provider', payload: { clientMatchId }, state: 'failed', terminal: true, attempts: 1, nextAttemptAt: 0 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([false, true])('renders History and Stats with a pending record and no ConvexProvider (signed in: %s)', async (isAuthenticated) => {
  if (!isAuthenticated) {
    const [owned] = JSON.parse(localStorage.getItem('se_quickmatches'));
    localStorage.setItem('se_quickmatches', JSON.stringify([owned, { ...owned, id: 'guest', clientMatchId: 'quick:football:guest', team1: 'North guest' }]));
  }
  const { container } = render(
    <AuthContext.Provider value={{ isAuthenticated, user: isAuthenticated ? { _id: 'owner' } : null }}>
      <MemoryRouter>
        <MonoHistory />
        <MatchSyncStatus clientMatchId={clientMatchId} quickMatchId="no-provider" />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  expect(await screen.findByRole('button', { name: /North .* South, .*View details/ })).toBeInTheDocument();
  if (!isAuthenticated) await waitFor(() => expect(screen.queryByRole('button', { name: /^North \d.* South, .*View details/ })).not.toBeInTheDocument());
  expect(container.querySelector('.kit-sync-status')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
  expect(screen.getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
  expect(localStorage.getItem(key)).not.toBeNull();
});
