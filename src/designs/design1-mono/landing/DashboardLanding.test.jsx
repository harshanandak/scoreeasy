import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLanding from './DashboardLanding';

let authState;

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => authState,
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
        <Route path="/:sport/tournament" element={<p>Tournament hub</p>} />
        <Route path="/:sport/quick" element={<p>Quick match</p>} />
        <Route path="/play" element={<p>Play hub</p>} />
        <Route path="/login" element={<p>Account entry</p>} />
        <Route path="/profile" element={<p>Profile</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardLanding start flow', () => {
  beforeEach(() => {
    authState = {
      cloudAuthAvailable: true,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
      user: null,
    };
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

  it('routes the featured sport Tournament action to that sport tournament hub', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' }]));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: 'Tournament' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/tournament');
    });
    expect(screen.getByText('Tournament hub')).toBeInTheDocument();
  });

  it('puts returning guest scoring and account choices above sports', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' },
    ]));

    renderDashboard();

    expect(await screen.findByRole('heading', { name: /Welcome\s*back/i })).toBeInTheDocument();
    expect(screen.getByText('Guest mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quick ▸' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tournament' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/login?returnTo=%2Fapp');
    });
    expect(screen.getByText('Account entry')).toBeInTheDocument();
  });

  it('shows signed-in account status instead of the guest account prompt', async () => {
    authState = {
      ...authState,
      isAuthenticated: true,
      user: {
        username: 'harsha',
        favoriteGames: ['cricket'],
      },
    };
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' },
    ]));

    renderDashboard();

    expect(await screen.findByRole('heading', { name: /Welcome back,\s*harsha/i })).toBeInTheDocument();
    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.queryByText(/Guest on this device/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/profile');
    });
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('renders returning-player dashboard when session storage is corrupt', async () => {
    globalThis.localStorage.setItem('gs_sessions', JSON.stringify({ id: 'bad-session' }));
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' }]));

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Tournament' })).toBeInTheDocument();
  });

  it('does not render a second dashboard navigation inside the app shell', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' }]));

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Tournament' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Find players/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('counts the full quick-match history in the Recent stat even when more than three are stored', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify(
      Array.from({ length: 5 }, (_, i) => ({ id: `recent-${i}`, sport: 'cricket', team1: 'A', team2: 'B' })),
    ));

    renderDashboard();

    await screen.findByRole('button', { name: 'Tournament' });
    const recentStat = screen.getByText('Recent').parentElement;
    expect(recentStat).toHaveTextContent('5');
  });

  it('falls back to recently played sports when stored favorite ids are stale', async () => {
    authState = {
      ...authState,
      isAuthenticated: true,
      user: { username: 'harsha', favoriteGames: ['not-a-real-sport'] },
    };
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' },
    ]));

    renderDashboard();

    await screen.findByRole('button', { name: 'Tournament' });
    expect(screen.getByText('Recently played')).toBeInTheDocument();
    expect(screen.queryByText('Favourites')).not.toBeInTheDocument();
  });

  it('hides the rematch action when the latest stored match has no resolvable sport', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'recent-1', team1: 'A', team2: 'B' },
    ]));

    renderDashboard();

    expect(await screen.findByRole('heading', { name: /Welcome\s*back/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rematch:/i })).not.toBeInTheDocument();
  });

  it('offers the rematch action when the latest stored match has a resolvable sport', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' },
    ]));

    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Rematch:/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick');
    });
  });
});
