import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, LocalAuthProvider } from '../auth/AuthContext';
import {
  SignedIn,
  SignedOut,
  AuthGoogleOneTap,
  AuthSignInButton,
  AuthSignUpButton,
  AuthUserButton,
} from './AuthButtons';

vi.mock('@clerk/clerk-react', () => ({
  GoogleOneTap: () => <div data-testid="clerk-one-tap" />,
  SignInButton: ({ children }) => <div data-testid="clerk-sign-in">{children}</div>,
  SignUpButton: ({ children }) => <div data-testid="clerk-sign-up">{children}</div>,
  UserButton: (props) => (
    <button type="button" aria-label={props['aria-label'] || 'Account menu'}>
      Account
    </button>
  ),
}));

describe('local auth button fallbacks', () => {
  it('renders signed-out content and hides signed-in content in local mode', () => {
    render(
      <LocalAuthProvider reason="offline">
        <SignedOut>
          <span>guest landing</span>
        </SignedOut>
        <SignedIn>
          <span>dashboard landing</span>
        </SignedIn>
      </LocalAuthProvider>,
    );

    expect(screen.getByText('guest landing')).toBeInTheDocument();
    expect(screen.queryByText('dashboard landing')).not.toBeInTheDocument();
  });

  it('does not render cloud-only Clerk widgets in local mode', () => {
    const { container } = render(
      <LocalAuthProvider reason="missing-config">
        <AuthUserButton />
        <AuthGoogleOneTap />
        <AuthSignInButton>
          <button type="button">Sign in</button>
        </AuthSignInButton>
        <AuthSignUpButton>
          <button type="button">Sign up</button>
        </AuthSignUpButton>
      </LocalAuthProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Clerk account menu and hides signed-out prompts for signed-in cloud users', async () => {
    render(
      <AuthContext.Provider
        value={{
          authMode: 'cloud',
          authModeReason: 'available',
          cloudAuthAvailable: true,
          isAuthenticated: true,
          isLoading: false,
          isUserReady: true,
          user: { id: 'user_1' },
          clerkUser: { id: 'clerk_1' },
          needsUsername: false,
          needsOnboarding: false,
        }}
      >
        <AuthUserButton aria-label="Account menu" />
        <SignedOut>
          <button type="button">Sign in</button>
        </SignedOut>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});
