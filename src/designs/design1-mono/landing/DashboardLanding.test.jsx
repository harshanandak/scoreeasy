import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLanding from './DashboardLanding';

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    needsOnboarding: false,
    user: null,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <LocationProbe />
      <Routes>
        <Route path="/app" element={<DashboardLanding />} />
        <Route path="/:sport/tournament/new" element={<p>New tournament setup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardLanding start flow', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback?.(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    globalThis.localStorage.clear();
  });

  it('allows a new-user 2-team tournament to reach tournament setup', async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Volleyball/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tournament/i }));
    fireEvent.change(screen.getByLabelText('TOURNAMENT NAME'), { target: { value: 'Office Cup' } });
    fireEvent.change(screen.getByPlaceholderText('Team 1'), { target: { value: 'Eagles' } });
    fireEvent.change(screen.getByPlaceholderText('Team 2'), { target: { value: 'Hawks' } });

    fireEvent.click(await screen.findByText('Office Cup'));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/tournament/new');
    });
    expect(screen.getByText('New tournament setup')).toBeInTheDocument();
  });

  it('routes empty existing-user New tournament to the recent match sport setup', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' }]));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'New tournament' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/tournament/new');
    });
    expect(screen.getByText('New tournament setup')).toBeInTheDocument();
  });

  it('renders returning-player dashboard when session storage is corrupt', async () => {
    globalThis.localStorage.setItem('gs_sessions', JSON.stringify({ id: 'bad-session' }));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' }]));

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'New tournament' })).toBeInTheDocument();
  });

  it('does not render a second dashboard navigation inside the app shell', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' }]));

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'New tournament' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Find players/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
