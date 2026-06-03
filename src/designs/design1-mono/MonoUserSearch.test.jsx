import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonoUserSearch from './MonoUserSearch';

let searchResults = null;

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => searchResults),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ cloudAuthAvailable: true }),
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
        <Route path="/volleyball/quick" element={<p>Guest match</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonoUserSearch', () => {
  beforeEach(() => {
    searchResults = null;
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
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick');
  });
});
