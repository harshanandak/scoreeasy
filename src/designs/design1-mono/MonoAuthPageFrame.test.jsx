import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonoAuthPageFrame from './MonoAuthPageFrame';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderFrame(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/login"
          element={(
            <MonoAuthPageFrame
              subtitle="Sign in to continue"
              helperText="Use email recovery from the password step if you cannot sign in."
            >
              <div>Auth widget</div>
            </MonoAuthPageFrame>
          )}
        />
        <Route path="/volleyball/quick" element={<p>Guest scoring</p>} />
        <Route path="/play" element={<p>Play hub</p>} />
        <Route path="/app" element={<p>Home screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderFrameWithoutHelperText(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/login"
          element={(
            <MonoAuthPageFrame subtitle="Sign in to continue">
              <div>Auth widget</div>
            </MonoAuthPageFrame>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonoAuthPageFrame', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback();
      return 1;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows recovery guidance without blocking guest scoring', () => {
    renderFrame('/login?returnTo=%2Fvolleyball%2Fquick');

    expect(screen.getByText('Use email recovery from the password step if you cannot sign in.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick');
    expect(screen.getByText('Guest scoring')).toBeInTheDocument();
  });

  it('sends a guest to the Play hub to pick a game when no return target is given', () => {
    renderFrame('/login');

    fireEvent.click(screen.getByRole('button', { name: 'Continue as guest' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/play');
    expect(screen.getByText('Play hub')).toBeInTheDocument();
  });

  it('keeps helper text optional', () => {
    renderFrameWithoutHelperText();

    expect(screen.getByText('Sign in to continue')).toBeInTheDocument();
    expect(screen.queryByText(/recovery/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as guest' })).toBeInTheDocument();
  });

  it('shows a title over the subtitle when the page gives one, and the subtitle as the heading when not', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={(
              <MonoAuthPageFrame title="Sign in" subtitle="Sign in or create account">
                <div>Auth widget</div>
              </MonoAuthPageFrame>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in');
    expect(screen.getByText('Sign in or create account')).toBeInTheDocument();
    expect(screen.getByText('Auth widget')).toBeInTheDocument();
  });

  it('keeps Continue as guest and Back to home as full controls', () => {
    renderFrame('/login');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in to continue');
    expect(screen.getByRole('button', { name: 'Continue as guest' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/app');
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });
});
