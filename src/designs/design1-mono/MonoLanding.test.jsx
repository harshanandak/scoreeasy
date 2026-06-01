import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MonoLanding from './MonoLanding';

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isLoading: true,
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState.current,
}));

describe('mono landing auth state', () => {
  it('renders a loading state while cloud auth initializes', () => {
    render(<MonoLanding />);

    expect(screen.getByRole('status')).toHaveTextContent('Checking cloud sign in');
  });
});
