import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MonoSportHome from './MonoSportHome';

let scrollSpy;
let addedScrollIntoView = false;

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

const getChooser = () => screen.getByRole('region', { name: 'Choose sport' });

describe('MonoSportHome priority starts', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
    if (!Element.prototype.scrollIntoView) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value() {},
      });
      addedScrollIntoView = true;
    }
    scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollSpy?.mockRestore();
    if (addedScrollIntoView) {
      delete Element.prototype.scrollIntoView;
      addedScrollIntoView = false;
    }
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

  it('keeps search and layout controls inside the choose sport section', () => {
    renderSportHome();

    expect(within(getChooser()).getByLabelText('Search sports')).toBeInTheDocument();
    expect(within(getChooser()).getByRole('button', { name: 'Switch to grid layout' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Search sports')).toHaveLength(1);
  });

  it('keeps the unified choose sport controls visible while searching', () => {
    renderSportHome();

    fireEvent.change(screen.getByLabelText('Search sports'), { target: { value: 'tennis' } });

    const chooser = getChooser();
    expect(within(chooser).getByLabelText('Search sports')).toHaveValue('tennis');
    expect(within(chooser).getByRole('heading', { name: 'Tennis' })).toBeInTheDocument();
  });
});
