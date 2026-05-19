import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MonoSportHome from './MonoSportHome';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderSportHome() {
  return render(
    <MemoryRouter initialEntries={['/play']}>
      <LocationProbe />
      <Routes>
        <Route path="/play" element={<MonoSportHome />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonoSportHome priority starts', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps cricket prioritized while routing users to cricket format choices', () => {
    renderSportHome();

    fireEvent.click(screen.getByRole('button', { name: 'Start Cricket' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/play?sport=cricket');
    expect(screen.getByRole('tab', { name: 'Cricket' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'T20' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Quick Match/i })).not.toBeInTheDocument();
  });

  it('routes volleyball priority users to the sport card choices instead of a quick match', () => {
    renderSportHome();

    fireEvent.click(screen.getByRole('button', { name: 'Start Volleyball' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/play?sport=volleyball');
    expect(screen.getByRole('tab', { name: 'Net Sports' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Volleyball' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Quick Match/i })).not.toBeInTheDocument();
  });
});
