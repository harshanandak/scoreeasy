import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocalAuthProvider } from '../auth/AuthContext';
import {
  SignedIn,
  SignedOut,
  AuthGoogleOneTap,
  AuthSignInButton,
  AuthSignUpButton,
  AuthUserButton,
} from './AuthButtons';

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
});
