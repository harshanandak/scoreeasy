import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAuthProvider } from '../../../auth/AuthContext';
import { getSportsList } from '../../../models/sportRegistry';
import GuestLanding from './GuestLanding';
import { LANDING_FAQ } from './landingFaq';

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

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Free live scoreboard app, on your phone.');
    const sub = screen.getByText(/no account needed, and it keeps working offline/i);
    for (const sport of getSportsList()) {
      expect(sub).toHaveTextContent(sport.name.toLowerCase());
    }
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
    // Both innings: India's finished 20 overs and Australia's reply.
    expect(within(card).getAllByText(/^\d+\/\d+$/)).toHaveLength(2);

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
    expect(within(card).getByText(/^Australia need \d+ off 87 balls · required rate \d+\.\d{2}$/)).toBeInTheDocument();

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

  it('explains the product below the app: four numbered sections in sequence', () => {
    renderLanding();

    const sections = [
      ['01 / Features', 'What it does.'],
      ['02 / Sports', '9 sports you can score.'],
      ['03 / How it works', 'Score a match in three steps.'],
      ['04 / FAQ', 'Questions people ask.'],
    ];
    for (const [eyebrow, heading] of sections) {
      expect(screen.getByText(eyebrow)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('Scoreboard app for local matches')).toBeInTheDocument();
  });

  it('drops the old Start first section and does not repeat its facts', () => {
    renderLanding();

    expect(screen.queryByText('01 / App experience')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Start first. Save later.' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sign-ups needed')).not.toBeInTheDocument();
    expect(screen.queryByText('You never have to sign in to score.')).not.toBeInTheDocument();
  });

  it('lists at most five short features, only with claims the app keeps', () => {
    renderLanding();

    const features = within(screen.getByRole('heading', { level: 2, name: 'What it does.' }).closest('section'));
    const titles = ['Each sport’s own rules', 'Undo that follows', 'Tournaments', 'Live share link', 'Saved to your account'];
    expect(features.getAllByRole('listitem')).toHaveLength(titles.length);
    for (const title of titles) {
      expect(features.getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    expect(features.getByText(/signed in, send a link so friends follow the score/i)).toBeInTheDocument();
    expect(features.getByText(/sign in to keep every finished match/i)).toBeInTheDocument();
    expect(features.queryByText(/every phone|any phone|follow you/i)).not.toBeInTheDocument();
  });

  it('answers each FAQ question as visible text', () => {
    renderLanding();

    const faq = within(screen.getByRole('heading', { level: 2, name: 'Questions people ask.' }).closest('section'));
    expect(LANDING_FAQ.length).toBeGreaterThanOrEqual(4);
    expect(LANDING_FAQ.length).toBeLessThanOrEqual(5);
    for (const { question, answer } of LANDING_FAQ) {
      expect(faq.getByRole('heading', { level: 3, name: question })).toBeVisible();
      expect(faq.getByText(answer)).toBeVisible();
    }
    const sportsAnswer = LANDING_FAQ.find((item) => item.question === 'Which sports can I score?').answer.toLowerCase();
    for (const sport of getSportsList()) {
      expect(sportsAnswer).toContain(sport.name.toLowerCase());
    }
  });

  it('keeps the FAQPage JSON-LD in index.html word for word with the visible FAQ', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));

    const faqPage = blocks.find((block) => block['@type'] === 'FAQPage');
    expect(faqPage.mainEntity.map((item) => [item.name, item.acceptedAnswer.text])).toEqual(
      LANDING_FAQ.map((item) => [item.question, item.answer]),
    );

    const app = blocks.find((block) => block['@type'] === 'SoftwareApplication');
    expect(app).toMatchObject({ name: 'Score Easy', applicationCategory: 'SportsApplication' });
  });

  it('keeps the page title and description inside search snippet length', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]*)"/)[1];

    expect(title.length).toBeLessThan(60);
    expect(description.length).toBeLessThan(155);
    expect(html).not.toMatch(/rel="canonical"/);
  });

  it('lists the three steps and closes with a Start and a sign up action', () => {
    renderLanding({ cloudAuthAvailable: true });

    const how = within(screen.getByRole('heading', { level: 2, name: 'Score a match in three steps.' }).closest('section'));
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
