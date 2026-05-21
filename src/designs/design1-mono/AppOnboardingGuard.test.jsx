import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Design1Mono from './index';

const authState = vi.hoisted(() => ({
  current: {
    authMode: 'cloud',
    cloudAuthAvailable: true,
    isAuthenticated: true,
    isLoading: false,
    needsOnboarding: true,
    user: { id: 'user_1' },
  },
}));

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState.current,
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderApp(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Design1Mono />
    </MemoryRouter>,
  );
}

describe('app onboarding guard', () => {
  beforeEach(() => {
    authState.current = {
      authMode: 'cloud',
      cloudAuthAvailable: true,
      isAuthenticated: true,
      isLoading: false,
      needsOnboarding: true,
      user: { id: 'user_1' },
    };
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets incomplete profiles keep using core app routes', async () => {
    renderApp('/play');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/play');
    });
    expect(screen.getByText('Profile setup can wait')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish profile' })).toBeInTheDocument();
  });

  it('preserves the active app route when users choose to finish profile setup', async () => {
    renderApp('/history?filter=quick');

    fireEvent.click(await screen.findByRole('button', { name: 'Finish profile' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/onboarding?returnTo=%2Fhistory%3Ffilter%3Dquick');
    });
  });

  it('still gates account surfaces behind onboarding completion', async () => {
    renderApp('/profile');

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/onboarding?returnTo=%2Fprofile');
    });
  });
});
