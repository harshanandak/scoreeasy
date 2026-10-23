import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/AuthContext';
import MonoProfile from './MonoProfile';

const authState = {
  authMode: 'local',
  authModeReason: 'missing-config',
  cloudAuthAvailable: true,
  isAuthenticated: false,
  isLoading: false,
  isUserReady: true,
  user: null,
  clerkUser: null,
  needsUsername: false,
  needsOnboarding: false,
};

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => null),
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderProfile(initialEntry = '/profile', authOverrides = {}) {
  return render(
    <AuthContext.Provider value={{ ...authState, ...authOverrides }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <Routes>
          <Route path="/profile" element={<MonoProfile />} />
          <Route path="/profile/:username" element={<MonoProfile />} />
          <Route path="/login" element={<p>Login</p>} />
          <Route path="/play" element={<p>Play hub</p>} />
          <Route path="/users/search" element={<p>Find players</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('MonoProfile recovery actions', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets unauthenticated users sign in or keep scoring as a guest', () => {
    renderProfile('/profile');

    expect(screen.getByRole('heading', { name: 'Your profile, when you’re ready' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to sync your profile and find other players. You can keep scoring on this device without an account.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Sign in$/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring as a guest' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/play');
  });

  it('preserves the profile return target when sending users to sign in', () => {
    renderProfile('/profile');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login?returnTo=%2Fprofile');
  });

  it('shows a signed-in scorer their stats, sports and recent matches exactly as stored', async () => {
    const { useQuery } = await import('convex/react');
    const { getFunctionName } = await import('convex/server');
    const fixtures = {
      'matches:getPublicUserStatsByUsername': {
        totalMatches: 12, wins: 7, winRate: 58, gamesOperated: 3,
        sportBreakdown: { cricket: { played: 4, wins: 1 }, volleyball: { played: 8, wins: 6 } },
      },
      'matches:getPublicRecentByUsername': [
        { _id: 'r1', sport: 'volleyball', team1: 'Royals', team2: 'Strikers', score1: 3, score2: 1, winner: 'Royals', date: Date.parse('2026-10-20T12:00:00Z') },
        { _id: 'r2', sport: 'football', team1: 'City', team2: 'United', score1: 2, score2: 2, winner: 'Draw', date: Date.parse('2026-10-18T12:00:00Z'), matchRole: 'refereeing' },
      ],
    };
    useQuery.mockImplementation((ref, args) => (args === 'skip' ? undefined : fixtures[getFunctionName(ref)] ?? null));

    renderProfile('/profile', {
      isAuthenticated: true,
      user: { username: 'harsha', displayName: 'Harsha', createdAt: Date.parse('2026-06-04T10:00:00Z') },
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Harsha' })).toBeInTheDocument();
    expect(screen.getByText('@harsha · Player and scorer · Joined June 2026')).toBeInTheDocument();

    const stats = screen.getByRole('list', { name: 'Stats' });
    expect(within(stats).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['12matches', '7wins', '58%win rate', '3scored']);

    // Sports: most played first, wins and the rest straight from the breakdown.
    const sports = screen.getByRole('region', { name: 'Sports' });
    const rows = [...sports.querySelectorAll('.kit-brow')];
    expect(rows.map((row) => row.querySelector('.kit-brow-name').textContent)).toEqual(['Volleyball', 'Cricket']);
    expect(rows.map((row) => row.querySelector('.kit-brow-sub').textContent)).toEqual(['6 W · 2 L · 75%', '1 W · 3 L · 25%']);
    expect(within(sports).getByLabelText('8 played')).toBeInTheDocument();
    expect(rows[0].style.getPropertyValue('--kit-p')).toBe('100%');
    expect(rows[1].style.getPropertyValue('--kit-p')).toBe('50%');

    // Recent rows bold the winner only; a draw stays plain.
    const recent = screen.getByRole('region', { name: 'Recent matches' });
    const titles = [...recent.querySelectorAll('.kit-row-title')];
    expect([...titles[0].querySelectorAll('strong')].map((el) => el.textContent)).toEqual(['Royals']);
    expect(titles[1].querySelectorAll('strong')).toHaveLength(0);
    expect(recent).toHaveTextContent('Football · 18 Oct 2026 · scored');

    useQuery.mockImplementation(() => null);
  });

  it('gives missing public profiles useful recovery actions', () => {
    renderProfile('/profile/notarealuser');

    expect(screen.getByText('User @notarealuser not found.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Find players' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/users/search');
  });
});
