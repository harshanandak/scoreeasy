import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocalAuthProvider, useAuth } from './AuthContext';

function AuthStateProbe() {
  const auth = useAuth();

  return (
    <dl>
      <dt>mode</dt>
      <dd data-testid="auth-mode">{auth.authMode}</dd>
      <dt>reason</dt>
      <dd data-testid="auth-reason">{auth.authModeReason}</dd>
      <dt>loading</dt>
      <dd data-testid="auth-loading">{String(auth.isLoading)}</dd>
      <dt>ready</dt>
      <dd data-testid="auth-ready">{String(auth.isUserReady)}</dd>
      <dt>authenticated</dt>
      <dd data-testid="auth-authenticated">{String(auth.isAuthenticated)}</dd>
    </dl>
  );
}

describe('LocalAuthProvider', () => {
  it('provides an unauthenticated ready state for local mode', () => {
    render(
      <LocalAuthProvider reason="offline">
        <AuthStateProbe />
      </LocalAuthProvider>,
    );

    expect(screen.getByTestId('auth-mode')).toHaveTextContent('local');
    expect(screen.getByTestId('auth-reason')).toHaveTextContent('offline');
    expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    expect(screen.getByTestId('auth-ready')).toHaveTextContent('true');
    expect(screen.getByTestId('auth-authenticated')).toHaveTextContent('false');
  });
});
