import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, LocalAuthProvider } from '../../../auth/AuthContext';
import { getSportsByCategory } from '../../../models/sportRegistry';
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

const COUNT = SLIDES.length;
const PITCH = 300;

/* jsdom has no layout. This gives every rail card a width of PITCH (card 0 sits at the 16px
   gutter) and a scrollTo that moves the rail and fires its scroll event, as a browser does. */
function installRailLayout() {
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function offsetLeft() {
    const rail = this.parentElement;
    return rail?.classList.contains('home-rail') ? 16 + [...rail.children].indexOf(this) * PITCH : 0;
  });
  Element.prototype.scrollTo = function scrollTo({ left }) {
    this.scrollLeft = left;
    this.dispatchEvent(new Event('scroll'));
  };
  return () => {
    offset.mockRestore();
    delete Element.prototype.scrollTo;
  };
}

function reducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Home', () => {
  beforeEach(() => { localStorage.clear(); });

  afterEach(() => {
    cleanup();
    delete window.matchMedia;
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

  it('shows 8 sports as full tiles in registry order, after the headline, Start and the board rail', () => {
    const { container } = renderLanding();
    const registry = Object.values(getSportsByCategory()).flat().map((sport) => sport.id);
    const tiles = [...container.querySelectorAll('.kit-landing-grid .kit-tile')];
    expect(tiles).toHaveLength(8);
    expect(tiles.map((tile) => tile.dataset.sport)).toEqual(registry.slice(0, 8));
    // Hockey is in the registry and on /play, but Home stops at an even 8 so no tile sits alone.
    expect(registry).toContain('hockey');
    expect(tiles.map((tile) => tile.dataset.sport)).not.toContain('hockey');
    expect(container.querySelector('.kit-landing-rail')).toBeNull();
    for (const tile of tiles) {
      expect(tile).not.toHaveClass('kit-tile-mini');
      expect(tile.querySelector('.kit-tile-hint')).not.toBeNull();
    }
    const hero = container.querySelector('.kit-landing-hero');
    const start = screen.getByRole('link', { name: 'Start a match' });
    const example = screen.getByTestId('landing-example');
    expect(follows(hero, start)).toBe(true);
    expect(follows(start, example)).toBe(true);
    expect(follows(example, tiles[0])).toBe(true);
    expect(screen.getByRole('heading', { name: 'Pick your sport' })).toBeInTheDocument();
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
    expect(all).toHaveLength(COUNT);
    expect(all.filter((slide) => slide.getAttribute('aria-hidden') === 'true')).toHaveLength(0);
    // The loop's two extra copies are for the eye only: hidden from assistive tech.
    const clones = [...container.querySelectorAll('[data-clone="true"]')];
    expect(clones).toHaveLength(COUNT * 2);
    for (const clone of clones) expect(clone).toHaveAttribute('aria-hidden', 'true');
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
      expect(slide.textContent).toContain(SLIDES[i].tagline);
    });
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

  describe('board rail', () => {
    let restoreLayout;
    beforeEach(() => { restoreLayout = installRailLayout(); });
    afterEach(() => { restoreLayout(); });

    // The layout effect parks the rail on the first real board: card index COUNT.
    function renderRail() {
      const { container } = renderLanding();
      const rail = container.querySelector('.home-rail');
      expect(rail.scrollLeft).toBe(COUNT * PITCH);
      return { container, rail, root: screen.getByTestId('landing-example') };
    }

    it('moves between boards with the arrow keys and never changes the Start label', () => {
      const { rail, root } = renderRail();
      expect(rail).toHaveAttribute('tabindex', '0');
      for (let i = 1; i <= COUNT; i += 1) {
        fireEvent.keyDown(rail, { key: 'ArrowRight' });
        expect(root).toHaveAttribute('data-active', String(i % COUNT));
        expect(screen.getByRole('link', { name: 'Start a match' })).toHaveAttribute('href', '/play');
      }
    });

    it('plays through every board by itself, then wraps from the last board to the first', () => {
      const { container, rail, root } = renderRail();
      expect(root).toHaveAttribute('data-active', '0');
      for (let i = 1; i < COUNT; i += 1) {
        fireEvent.animationEnd(container.querySelector('.home-advance'));
        expect(root).toHaveAttribute('data-active', String(i));
      }
      expect(rail.scrollLeft).toBe((COUNT * 2 - 1) * PITCH);
      // Past the last board is the first board's copy in the third copy ...
      fireEvent.animationEnd(container.querySelector('.home-advance'));
      expect(rail.scrollLeft).toBe(COUNT * 2 * PITCH);
      expect(root).toHaveAttribute('data-active', '0');
      // ... and when the rail comes to rest it steps back into the middle copy, unseen.
      fireEvent(rail, new Event('scrollend'));
      expect(rail.scrollLeft).toBe(COUNT * PITCH);
      expect(root).toHaveAttribute('data-active', '0');
    });

    it('wraps from the first board to the last on a swipe back, and on round again', () => {
      const { rail, root } = renderRail();
      // One board back from the first board is the last board's copy in the first copy.
      rail.scrollLeft = (COUNT - 1) * PITCH;
      fireEvent.scroll(rail);
      expect(root).toHaveAttribute('data-active', String(COUNT - 1));
      fireEvent(rail, new Event('scrollend'));
      expect(rail.scrollLeft).toBe((COUNT * 2 - 1) * PITCH);
      expect(root).toHaveAttribute('data-active', String(COUNT - 1));
      fireEvent.keyDown(rail, { key: 'ArrowRight' });
      fireEvent(rail, new Event('scrollend'));
      expect(rail.scrollLeft).toBe(COUNT * PITCH);
      expect(root).toHaveAttribute('data-active', '0');
    });

    it('holds auto-advance while touched, hovered or focused, and resumes after', () => {
      const { rail, root } = renderRail();
      expect(root).not.toHaveClass('is-paused');
      fireEvent.pointerDown(rail, { pointerType: 'touch' });
      expect(root).toHaveClass('is-paused');
      fireEvent.pointerUp(rail, { pointerType: 'touch' });
      expect(root).not.toHaveClass('is-paused');
      fireEvent.mouseEnter(root);
      expect(root).toHaveClass('is-paused');
      fireEvent.mouseLeave(root);
      expect(root).not.toHaveClass('is-paused');
      fireEvent.focus(rail);
      expect(root).toHaveClass('is-paused');
      fireEvent.blur(rail);
      expect(root).not.toHaveClass('is-paused');
    });

    it('does not auto-advance or animate under reduced motion, and can still be moved by hand', () => {
      reducedMotion();
      const { container, rail, root } = renderRail();
      expect(container.querySelector('.home-advance')).toBeNull();
      expect(container.querySelector('.home-tick')).toBeNull();
      expect(root).toHaveAttribute('data-active', '0');
      fireEvent.keyDown(rail, { key: 'ArrowRight' });
      expect(root).toHaveAttribute('data-active', '1');
    });
  });
});
