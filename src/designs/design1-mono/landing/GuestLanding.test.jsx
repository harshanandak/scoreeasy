import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthContext, LocalAuthProvider } from '../../../auth/AuthContext';
import { getSportById, getSportsByCategory } from '../../../models/sportRegistry';
import GuestLanding from './GuestLanding';
import { buildDemo } from './landingDemo';
import { LANDING_FAQ } from './landingFaq';
import { SLIDES } from './ScoreSlides';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route" data-new-match={String(location.state?.newMatch === true)}>{`${location.pathname}${location.search}`}</output>;
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

function renderSignedIn() {
  return render(
    <AuthContext.Provider value={{ cloudAuthAvailable: true, isAuthenticated: true, isLoading: false }}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<GuestLanding />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function slides(container) {
  return [...container.querySelectorAll('[aria-roledescription="slide"]')];
}

describe('Home', () => {
  beforeEach(() => { localStorage.clear(); });

  afterEach(() => {
    cleanup();
  });

  it('has one fixed Start that opens the sport picker, plus Sign in and sign up', () => {
    renderLanding();
    const start = screen.getAllByRole('link', { name: 'Start a match' });
    expect(start).toHaveLength(1);
    expect(start[0]).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create a free account' })).toBeInTheDocument();
  });

  it('puts Sign in in the top bar, not the headline block, and hides it from a signed-in visitor', () => {
    const { container, unmount } = renderLanding();
    const signIn = screen.getByRole('link', { name: 'Sign in' });
    expect(container.querySelector('.kit-top')).toContainElement(signIn);
    expect(container.querySelector('.kit-landing-hero')).not.toContainElement(signIn);
    unmount();
    renderSignedIn();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Start a match' })).toBeInTheDocument();
  });

  it('shows every sport as a full tile in registry order, between the headline and Start', () => {
    const { container } = renderLanding();
    const expected = Object.values(getSportsByCategory()).flat().map((sport) => sport.id);
    const tiles = [...container.querySelectorAll('.kit-landing-rail .kit-tile')];
    expect(tiles.map((tile) => tile.dataset.sport)).toEqual(expected);
    for (const tile of tiles) {
      expect(tile).not.toHaveClass('kit-tile-mini');
      expect(tile.querySelector('.kit-tile-hint')).not.toBeNull();
    }
    const hero = container.querySelector('.kit-landing-hero');
    const start = screen.getByRole('link', { name: 'Start a match' });
    const example = screen.getByTestId('landing-example');
    expect(hero.compareDocumentPosition(tiles[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tiles.at(-1).compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(start.compareDocumentPosition(example) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('starts the tapped sport quick match from a tile, and See all opens the Play hub', () => {
    const { container } = renderLanding();
    const ids = ['cricket', 'tennis'];
    for (const id of ids) {
      fireEvent.click(container.querySelector(`.kit-tile[data-sport="${id}"]`));
      expect(screen.getByLabelText('Current route')).toHaveTextContent(new RegExp(`^/${id}/quick$`));
      expect(screen.getByLabelText('Current route')).toHaveAttribute('data-new-match', 'true');
      cleanup();
      renderLanding();
    }
    fireEvent.click(screen.getByRole('link', { name: 'See all' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/play');
  });

  it('shows a labelled carousel of sport boards with no sport tabs and no hint list', () => {
    const { container } = renderLanding();
    const carousel = screen.getByTestId('landing-example');
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(carousel).toHaveAccessibleName();
    expect(within(carousel).queryByRole('group', { name: 'Pick a sport' })).toBeNull();
    expect(within(carousel).queryAllByRole('listitem')).toHaveLength(0);
    const all = slides(container);
    expect(all).toHaveLength(SLIDES.length);
    expect(all.filter((slide) => slide.getAttribute('aria-hidden') !== 'true')).toHaveLength(1);
  });

  it('draws every slide from its sport engine, with a short calm tagline', () => {
    const { container } = renderLanding();
    slides(container).forEach((slide, i) => {
      const demo = buildDemo(SLIDES[i].sportId);
      for (const team of demo.teams) {
        expect(slide.textContent).toContain(team.name);
        expect(slide.textContent).toContain(team.score);
      }
      expect(SLIDES[i].tagline.split(/\s+/).length).toBeLessThanOrEqual(8);
      expect(SLIDES[i].tagline).not.toMatch(/!/);
    });
  });

  it('moves between slides with the dots and never changes the Start label', () => {
    const { container } = renderLanding();
    for (const [i, slide] of SLIDES.entries()) {
      const dot = screen.getByRole('button', { name: `Show ${getSportById(slide.sportId).name}` });
      fireEvent.click(dot);
      expect(dot).toHaveAttribute('aria-current', 'true');
      expect(slides(container)[i]).not.toHaveAttribute('aria-hidden');
      expect(screen.getByRole('link', { name: 'Start a match' })).toHaveAttribute('href', '/play');
    }
  });

  it('keeps FAQs collapsed and the structured data consistent', () => {
    const { container } = renderLanding();
    const rows = [...container.querySelectorAll('details')];
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).not.toHaveAttribute('open');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    expect(blocks.find(block => block['@type'] === 'FAQPage').mainEntity.map(item => [item.name, item.acceptedAnswer.text])).toEqual(LANDING_FAQ.map(item => [item.question, item.answer]));
  });

  it('does not remember an unfinished Sign in attempt', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(localStorage.getItem('se_entered_app')).toBeNull();
  });
});
