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
});
