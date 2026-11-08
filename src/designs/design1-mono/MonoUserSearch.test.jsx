import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonoUserSearch from './MonoUserSearch';

let searchResults = null;
const auth = vi.hoisted(() => ({ cloudAuthAvailable: true, isAuthenticated: true, isUserReady: true }));

vi.mock('convex/react', () => ({
  useQuery: vi.fn((_ref, args) => args === 'skip' ? undefined : searchResults),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => auth,
}));

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value) => value,
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderUserSearch() {
  return render(
    <MemoryRouter initialEntries={['/users/search']}>
      <LocationProbe />
      <Routes>
        <Route path="/users/search" element={<MonoUserSearch />} />
        <Route path="/play" element={<p>Play hub</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonoUserSearch', () => {
  it('skips the user directory while signed out and explains how to search', async () => {
    const { useQuery } = await import('convex/react');
    auth.isAuthenticated = false;
    useQuery.mockClear();
    renderUserSearch();
    fireEvent.change(screen.getByLabelText('Search users by username'), { target: { value: 'own' } });
    expect(useQuery.mock.calls.every(([, args]) => args === 'skip')).toBe(true);
    expect(screen.getByText('Sign in to search cloud profiles.')).toBeInTheDocument();
    expect(screen.queryByText(/No players found/)).not.toBeInTheDocument();
  });
  beforeEach(() => {
    searchResults = null;
    auth.isAuthenticated = true;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers useful recovery actions when a player search has no results', () => {
    searchResults = [];
    renderUserSearch();

    fireEvent.change(screen.getByLabelText('Search users by username'), { target: { value: 'zz' } });

    expect(screen.getByText('No players found for "zz"')).toBeInTheDocument();
    expect(screen.getByText(/Try another username/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start guest match' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/play');
  });
});
