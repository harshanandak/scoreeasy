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

function renderSportHome(initialEntry = '/play') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/play" element={<MonoSportHome />} />
        <Route path="/:sport/quick" element={<p>Quick setup</p>} />
        <Route path="/:sport/tournament" element={<p>Tournament hub</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const getChooser = () => screen.getByRole('region', { name: 'Choose sport' });

describe('MonoSportHome sport chooser', () => {
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

  it('renders popular sports first with quick and tournament actions', () => {
    renderSportHome();

    expect(screen.getByRole('heading', { level: 1, name: 'Play' })).toBeInTheDocument();

    const chooser = getChooser();
    expect(within(chooser).getByText('Popular')).toBeInTheDocument();
    expect(within(chooser).getByRole('button', { name: 'Quick match: Cricket' })).toBeInTheDocument();
    expect(within(chooser).getByRole('button', { name: 'Tournament: Cricket' })).toBeInTheDocument();
    expect(within(chooser).getByRole('button', { name: 'Quick match: Football' })).toBeInTheDocument();
    expect(within(chooser).getByRole('button', { name: 'Quick match: Volleyball' })).toBeInTheDocument();
  });

  it('starts a quick match from a sport row', () => {
    renderSportHome();

    fireEvent.click(screen.getByRole('button', { name: 'Quick match: Cricket' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick');
    expect(screen.getByText('Quick setup')).toBeInTheDocument();
  });

  it('routes the tournament action to the sport tournament hub', () => {
    renderSportHome();

    fireEvent.click(screen.getByRole('button', { name: 'Tournament: Volleyball' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/tournament');
    expect(screen.getByText('Tournament hub')).toBeInTheDocument();
  });

  it('filters rows while keeping the chooser controls visible', () => {
    renderSportHome();

    fireEvent.change(screen.getByLabelText('Search sports'), { target: { value: 'tennis' } });

    const chooser = getChooser();
    expect(within(chooser).getByLabelText('Search sports')).toHaveValue('tennis');
    expect(within(chooser).getByRole('button', { name: 'Quick match: Tennis' })).toBeInTheDocument();
    expect(within(chooser).queryByRole('button', { name: 'Quick match: Cricket' })).not.toBeInTheDocument();
  });

  it('shows an empty state for unmatched searches', () => {
    renderSportHome();

    fireEvent.change(screen.getByLabelText('Search sports'), { target: { value: 'zzzz' } });

    expect(screen.getByText('No sports found.')).toBeInTheDocument();
  });

  it('orders groups around the popular games', () => {
    renderSportHome();

    const text = getChooser().textContent;
    expect(text.indexOf('Popular')).toBeGreaterThan(-1);
    expect(text.indexOf('Popular')).toBeLessThan(text.indexOf('Team Sports'));
    expect(text.indexOf('Team Sports')).toBeLessThan(text.indexOf('Racquet Sports'));
    // Categories fully covered by the popular tier (Cricket, Net Sports) do not repeat below it.
    expect(text).not.toContain('Net Sports');
  });

  it('scrolls the requested sport into view from the sport query param', () => {
    renderSportHome('/play?sport=volleyball');

    expect(document.getElementById('sport-row-volleyball')).not.toBeNull();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('keeps tap targets sized for mobile', () => {
    renderSportHome();

    expect(screen.getByLabelText('Search sports')).toHaveClass('mono-input');
    expect(screen.getByRole('button', { name: 'Quick match: Cricket' })).toHaveStyle({ minHeight: '44px' });
  });
});
