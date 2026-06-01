import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonoLogin from './MonoLogin';
import MonoSignUp from './MonoSignUp';
import SSOCallback from './SSOCallback';

let authState;
let signInProps;
let signUpProps;
let ssoProps;

vi.mock('@clerk/clerk-react', () => ({
  SignIn: (props) => {
    signInProps = props;
    return <p>Sign in widget</p>;
  },
  SignUp: (props) => {
    signUpProps = props;
    return <p>Sign up widget</p>;
  },
  AuthenticateWithRedirectCallback: (props) => {
    ssoProps = props;
    return <p>SSO callback</p>;
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

function renderAuthRoute(initialEntry, element) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={element} />
        <Route path="/signup" element={element} />
        <Route path="/sso-callback" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('auth fallback app entry routing', () => {
  beforeEach(() => {
    authState = { cloudAuthAvailable: true };
    signInProps = null;
    signUpProps = null;
    ssoProps = null;
    globalThis.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.sessionStorage.clear();
  });

  it('routes bare login fallback through app entry', () => {
    renderAuthRoute('/login', <MonoLogin />);

    expect(screen.getByText('Sign in widget')).toBeInTheDocument();
    expect(signInProps.forceRedirectUrl).toBe('/');
    expect(signInProps.fallbackRedirectUrl).toBe('/');
    expect(signInProps.signUpUrl).toBe('/signup?returnTo=%2F');
  });

  it('preserves explicit login returnTo targets', () => {
    renderAuthRoute('/login?returnTo=%2Fprofile', <MonoLogin />);

    expect(signInProps.forceRedirectUrl).toBe('/profile');
    expect(signInProps.fallbackRedirectUrl).toBe('/profile');
  });

  it('routes bare sign-up fallback through app entry', () => {
    renderAuthRoute('/signup', <MonoSignUp />);

    expect(screen.getByText('Sign up widget')).toBeInTheDocument();
    expect(signUpProps.forceRedirectUrl).toBe('/');
    expect(signUpProps.fallbackRedirectUrl).toBe('/');
    expect(signUpProps.signInUrl).toBe('/login?returnTo=%2F');
  });

  it('routes SSO callback fallback through app entry', async () => {
    renderAuthRoute('/sso-callback', <SSOCallback />);

    await waitFor(() => {
      expect(ssoProps).toEqual(expect.objectContaining({
        signInFallbackRedirectUrl: '/',
        signUpFallbackRedirectUrl: '/',
      }));
    });
  });
});
