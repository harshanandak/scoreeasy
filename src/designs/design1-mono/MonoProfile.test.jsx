import { fireEvent, render, screen } from '@testing-library/react';
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
          <Route path="/volleyball/quick" element={<p>Guest match</p>} />
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

    fireEvent.click(screen.getByRole('button', { name: 'Start guest match' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick');
  });

  it('preserves the profile return target when sending users to sign in', () => {
    renderProfile('/profile');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in to sync profile' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login?returnTo=%2Fprofile');
  });

  it('gives missing public profiles useful recovery actions', () => {
    renderProfile('/profile/notarealuser');

    expect(screen.getByText('User @notarealuser not found.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Find players' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/users/search');
  });
});
