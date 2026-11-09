import { matchStorageKey } from '../../utils/accountStorage';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../auth/AuthContext';
import MonoHistory from './MonoHistory';
import MatchSyncStatus from './components/MatchSyncStatus';

const clientMatchId = 'quick:football:no-provider';
const key = `se_pending_match:owner:${encodeURIComponent(clientMatchId)}`;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{
    id: 'no-provider', clientMatchId, sport: 'football', team1: 'North', team2: 'South',
    score1: 2, score2: 1, winner: 'North', status: 'completed', completedAt: '2026-11-01T12:00:00Z',
  }]));
  localStorage.setItem(matchStorageKey(key), JSON.stringify({ ownerId: 'owner', quickMatchId: 'no-provider', payload: { clientMatchId }, state: 'failed', terminal: true, attempts: 1, nextAttemptAt: 0 }));
});
afterEach(cleanup);

it.each([false, true])('renders History and Stats with a pending record and no ConvexProvider (signed in: %s)', (isAuthenticated) => {
  const { container } = render(
    <AuthContext.Provider value={{ isAuthenticated, user: isAuthenticated ? { _id: 'owner' } : null }}>
      <MemoryRouter>
        <MonoHistory />
        <MatchSyncStatus clientMatchId={clientMatchId} quickMatchId="no-provider" />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  expect(screen.getByRole('button', { name: /North .* South, .*View details/ })).toBeInTheDocument();
  expect(container.querySelector('.kit-sync-status')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
  expect(screen.getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true');
  expect(localStorage.getItem(matchStorageKey(key))).not.toBeNull();
});
