import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAuthProvider } from '../../../auth/AuthContext';
import { getSportsList } from '../../../models/sportRegistry';
import GuestLanding from './GuestLanding';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderLanding({ cloudAuthAvailable = false } = {}) {
  return render(
    <LocalAuthProvider reason="missing-config" cloudAuthAvailable={cloudAuthAvailable}>
      <MemoryRouter>
        <LocationProbe />
        <Routes>
          <Route path="*" element={<GuestLanding />} />
        </Routes>
      </MemoryRouter>
    </LocalAuthProvider>,
  );
}

function setViewport(width, mobile = false) {
  globalThis.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: mobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  Object.defineProperty(globalThis, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

const pickFor = (name) => within(screen.getByRole('group', { name: 'Pick a sport' })).getByRole('button', { name });
const startLinks = (name) => screen.getAllByRole('link', { name });

describe('GuestLanding', () => {
  beforeEach(() => {
    setViewport(1024);
  });

  afterEach(() => {
    cleanup();
  });

  it('says what the app is and gives one primary action plus a secondary sign in', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Score any game on your phone.');
    expect(screen.getByText(/start in seconds with no account/i)).toHaveTextContent(/works offline/i);
    expect(screen.getByText(/once you sign in, the matches you score are saved to your account/i)).toBeInTheDocument();
    expect(startLinks(/^Start /)[0]).toHaveAttribute('href', '/play?sport=cricket');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('always points Sign in at the unified /login route, even on local auth builds', () => {
    renderLanding({ cloudAuthAvailable: false });

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows a picker tile for every registered sport, three across with no scrolling row', () => {
    renderLanding();

    for (const sport of getSportsList()) {
      expect(pickFor(sport.name)).toBeInTheDocument();
    }
    expect(getSportsList()).toHaveLength(9);
    expect(within(screen.getByRole('group', { name: 'Pick a sport' })).getAllByRole('button')).toHaveLength(9);
  });

  it('keeps the chip, the example card and every Start button on the same sport', () => {
    renderLanding();

    expect(pickFor('Cricket')).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('landing-example')).getByText('Cricket')).toBeInTheDocument();
    expect(startLinks('Start Cricket')).toHaveLength(2);

    fireEvent.click(pickFor('Badminton'));

    expect(pickFor('Badminton')).toHaveAttribute('aria-pressed', 'true');
    expect(pickFor('Cricket')).toHaveAttribute('aria-pressed', 'false');
    expect(within(screen.getByTestId('landing-example')).getByText('Badminton')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start Cricket' })).not.toBeInTheDocument();
    for (const link of startLinks('Start Badminton')) {
      expect(link).toHaveAttribute('href', '/play?sport=badminton');
    }
  });

  it('builds the example scores from the engines, one sport at a time', () => {
    renderLanding();

    const card = screen.getByTestId('landing-example');
    expect(within(card).getByText('India')).toBeInTheDocument();
    expect(within(card).getByText(/^\d+\/\d+$/)).toBeInTheDocument();

    fireEvent.click(pickFor('Volleyball'));
    expect(within(card).getByText('Eagles')).toBeInTheDocument();
    expect(within(card).getByText('18')).toBeInTheDocument();
    expect(within(card).getByText('Set 3 of 5')).toBeInTheDocument();
  });

  it('lays out a scorecard for each sport from what that sport keeps', () => {
    renderLanding();
    const card = screen.getByTestId('landing-example');

    // Cricket: both innings with runs, wickets and overs, who is batting, and the chase.
    expect(card).toHaveAttribute('data-kind', 'cricket');
    expect(within(card).getByText('20 overs')).toBeInTheDocument();
    expect(within(card).getByText('5.3 overs')).toBeInTheDocument();
    expect(within(card).getByText('Batting')).toBeInTheDocument();
    expect(within(card).getByText(/^Australia need d+ off 87 balls · required rate d+.d{2}$/)).toBeInTheDocument();

    // Set sports: the finished sets as a grid, the set in play as the big number, and the server.
    fireEvent.click(pickFor('Volleyball'));
    expect(card).toHaveAttribute('data-kind', 'sets');
    expect(within(card).getByText('S1')).toBeInTheDocument();
    expect(within(card).getByText('S2')).toBeInTheDocument();
    expect(within(card).getByText('Serving')).toBeInTheDocument();

    // Table tennis has no serve line: its serve alternates every two points and the engine is not fed it.
    fireEvent.click(pickFor('Table Tennis'));
    expect(within(card).queryByText('Serving')).not.toBeInTheDocument();

    fireEvent.click(pickFor('Tennis'));
    expect(card).toHaveAttribute('data-kind', 'tennis');
    expect(within(card).getByText('Serving')).toBeInTheDocument();
    expect(within(card).getByText('30')).toBeInTheDocument();

    // Goal sports: the period line score up to the period in play.
    fireEvent.click(pickFor('Basketball'));
    expect(card).toHaveAttribute('data-kind', 'goals');
    expect(['Q1', 'Q2', 'Q3'].map((period) => within(card).getByText(period))).toHaveLength(3);
    expect(within(card).queryByText('Q4')).not.toBeInTheDocument();

    // Kabaddi: points by category, one pip per player, who raids next.
    fireEvent.click(pickFor('Kabaddi'));
    expect(card).toHaveAttribute('data-kind', 'kabaddi');
    expect(within(card).getAllByText('Touch')).toHaveLength(2);
    expect(within(card).getByText('Raids next')).toBeInTheDocument();
    expect(card.querySelectorAll('.kit-score-pips i')).toHaveLength(14);
  });

  it('explains the product below the app: four numbered sections in the original voice', () => {
    renderLanding();

    const sections = [
      ['01 / App experience', 'Start first. Save later.'],
      ['02 / Features', 'Everything you need.'],
      ['03 / Sports', '9 sports. Your rules.'],
      ['04 / How it works', 'Three steps.'],
    ];
    for (const [eyebrow, heading] of sections) {
      expect(screen.getByText(eyebrow)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Universal score tracker')).toBeInTheDocument();
  });

  it('shows the stat cards and says what the app does, only with claims the app keeps', () => {
    renderLanding();

    const stats = within(screen.getByRole('heading', { level: 2, name: 'Start first. Save later.' }).closest('section'));
    expect(stats.getByText('Sports ready').previousElementSibling).toHaveTextContent('9');
    expect(stats.getByText('Sign-ups needed').previousElementSibling).toHaveTextContent('0');
    expect(stats.getByText('No signal needed').previousElementSibling).toHaveTextContent('OFFLINE');
    expect(stats.getByText(/score your first point without an account/i)).toBeInTheDocument();
    expect(stats.getByText(/keep scoring with no signal\. your matches save on your phone/i)).toBeInTheDocument();
    expect(stats.getByText('You never have to sign in to score.')).toBeInTheDocument();

    const features = within(screen.getByRole('heading', { level: 2, name: 'Everything you need.' }).closest('section'));
    for (const title of ['No sign-up to start', 'Save to your account', 'Live share link', 'Undo that follows', 'Real rules, every sport', 'Tournaments']) {
      expect(features.getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    expect(features.getByText(/weak signal never costs one/i)).toBeInTheDocument();
    expect(features.getByText(/every match you finish is saved to your account\. without one, matches stay on this phone/i)).toBeInTheDocument();
    expect(features.queryByText(/every phone|any phone|follow you/i)).not.toBeInTheDocument();
    expect(features.getByText(/stays private until you share it/i)).toBeInTheDocument();
  });

  it('lists the three steps and closes with a Start and a sign up action', () => {
    renderLanding({ cloudAuthAvailable: true });

    const how = within(screen.getByRole('heading', { level: 2, name: 'Three steps.' }).closest('section'));
    expect(how.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Pick sport'),
      expect.stringContaining('Add teams'),
      expect.stringContaining('Score live'),
    ]);

    const closing = within(screen.getByRole('heading', { level: 2, name: 'Ready?' }).closest('section'));
    expect(closing.getByRole('link', { name: 'Start Cricket' })).toHaveAttribute('href', '/play?sport=cricket');
    expect(closing.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/signup');
  });

  it('turns each sport tile into a start link for that sport', () => {
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: 'Quick match: Table Tennis' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/play?sport=tabletennis');
  });

  it('points Create a free account at the app on cloud builds and at production otherwise', () => {
    renderLanding({ cloudAuthAvailable: true });
    expect(screen.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/signup');
    cleanup();

    renderLanding({ cloudAuthAvailable: false });
    expect(screen.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', 'https://scoreeasy.app/signup');
  });

  it('links the legal pages from the footer', () => {
    renderLanding();

    const legal = within(screen.getByRole('navigation', { name: 'Legal' }));
    expect(legal.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(legal.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(legal.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  });

  it('renders on a phone viewport with the same actions', () => {
    setViewport(390, true);

    renderLanding({ cloudAuthAvailable: true });

    expect(startLinks('Start Cricket')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Quick match: Kabaddi' })).toBeInTheDocument();
  });
});
