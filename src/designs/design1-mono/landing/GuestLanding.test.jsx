import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, LocalAuthProvider } from '../../../auth/AuthContext';
import { getSportsByCategory } from '../../../models/sportRegistry';
import GuestLanding from './GuestLanding';
import { CARDS } from './cardTimelines';
import { LANDING_FAQ } from './landingFaq';

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

const COUNT = CARDS.length;
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

  it('shows 8 sports as full tiles in registry order, after the headline, Start and the card rail', () => {
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

  it('shows a labelled carousel of animation cards with no sport tabs and no hint list', () => {
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

  it('shows the concept animations, not sport scoreboards', () => {
    const { container } = renderLanding();
    expect(container.querySelector('.home-board, .home-slide-tag')).toBeNull();
    const carousel = screen.getByTestId('landing-example');
    expect(within(carousel).queryByText(/Every ball counted/)).toBeNull();
    expect(CARDS.map((card) => card.id)).toEqual(['tap', 'undo', 'live', 'moments', 'paper']);
  });

  it('gives every card a heading and a picture named for what happens in it', () => {
    renderLanding();
    const carousel = screen.getByTestId('landing-example');
    // Only the real copy is exposed: the clones are aria-hidden, so each name is found once.
    expect(within(carousel).getAllByRole('img')).toHaveLength(COUNT);
    CARDS.forEach((card, i) => {
      expect(within(carousel).getByRole('group', { name: `${i + 1} of ${COUNT}: ${card.title}` })).toBeInTheDocument();
      expect(within(carousel).getByRole('heading', { level: 3, name: card.title })).toBeInTheDocument();
      expect(within(carousel).getByRole('img', { name: card.label })).toBeInTheDocument();
      expect(card.title.split(/\s+/).length).toBeLessThanOrEqual(5);
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

  describe('card rail', () => {
    let restoreLayout;
    beforeEach(() => { vi.useFakeTimers(); restoreLayout = installRailLayout(); });
    afterEach(() => { restoreLayout(); vi.useRealTimers(); });

    // The layout effect parks the rail on the first real card: card index COUNT.
    function renderRail() {
      const { container } = renderLanding();
      const rail = container.querySelector('.home-rail');
      expect(rail.scrollLeft).toBe(COUNT * PITCH);
      return { container, rail, root: screen.getByTestId('landing-example') };
    }

    const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
    const rest = (rail) => fireEvent(rail, new Event('scrollend'));
    const loopOf = (card) => CARDS[card].timeline.loopMs;

    it('moves between cards with the arrow keys and never changes the Start label', () => {
      const { rail, root } = renderRail();
      expect(rail).toHaveAttribute('tabindex', '0');
      for (let i = 1; i <= COUNT; i += 1) {
        fireEvent.keyDown(rail, { key: 'ArrowRight' });
        expect(root).toHaveAttribute('data-active', String(i % COUNT));
        expect(screen.getByRole('link', { name: 'Start a match' })).toHaveAttribute('href', '/play');
      }
    });

    it('plays each card through by itself, then wraps from the last card to the first', () => {
      const { rail, root } = renderRail();
      expect(root).toHaveAttribute('data-active', '0');
      for (let i = 1; i < COUNT; i += 1) {
        advance(loopOf(i - 1));
        expect(root).toHaveAttribute('data-active', String(i));
        rest(rail);
      }
      expect(rail.scrollLeft).toBe((COUNT * 2 - 1) * PITCH);
      // Past the last card is the first card's copy in the third copy ...
      advance(loopOf(COUNT - 1));
      expect(rail.scrollLeft).toBe(COUNT * 2 * PITCH);
      expect(root).toHaveAttribute('data-active', '0');
      // ... and when the rail comes to rest it steps back into the middle copy, unseen.
      rest(rail);
      expect(rail.scrollLeft).toBe(COUNT * PITCH);
      expect(root).toHaveAttribute('data-active', '0');
    });

    it('wraps from the first card to the last on a swipe back, and on round again', () => {
      const { rail, root } = renderRail();
      // One card back from the first card is the last card's copy in the first copy.
      rail.scrollLeft = (COUNT - 1) * PITCH;
      fireEvent.scroll(rail);
      expect(root).toHaveAttribute('data-active', String(COUNT - 1));
      rest(rail);
      expect(rail.scrollLeft).toBe((COUNT * 2 - 1) * PITCH);
      expect(root).toHaveAttribute('data-active', String(COUNT - 1));
      fireEvent.keyDown(rail, { key: 'ArrowRight' });
      rest(rail);
      expect(rail.scrollLeft).toBe(COUNT * PITCH);
      expect(root).toHaveAttribute('data-active', '0');
    });

    it('animates only the visible card, and every card starts from its opening frame', () => {
      const { container } = renderRail();
      const [tap, undo] = slides(container);
      expect(tap.textContent).toContain('Love all');
      expect(tap.textContent).not.toContain('Deuce');
      advance(6000);
      // Deuce lands at 5.84 s: the tap at 5.7 s, then the answer 140 ms later.
      expect(tap.textContent).toContain('Deuce');
      expect(undo.textContent).toContain('New over');
      expect(undo.textContent).not.toContain('A single');
    });

    it('plays every copy of the visible card, so the copy on screen is the one that moves', () => {
      const { container } = renderRail();
      const clones = [...container.querySelectorAll('[data-clone="true"]')];
      const cloneOfTap = clones.filter((clone) => clone.textContent.includes('Tap. The rule answers.'));
      expect(cloneOfTap).toHaveLength(2);
      advance(6000);
      for (const clone of cloneOfTap) expect(clone.textContent).toContain('Deuce');
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

    it.each([
      ['touch', (rail) => fireEvent.pointerDown(rail, { pointerType: 'touch' }), (rail) => fireEvent.pointerUp(rail, { pointerType: 'touch' })],
      ['hover', (rail, root) => fireEvent.mouseEnter(root), (rail, root) => fireEvent.mouseLeave(root)],
      ['focus', (rail) => fireEvent.focus(rail), (rail) => fireEvent.blur(rail)],
    ])('stops the animation and the advance while held by %s, and carries on from where it stopped', (_name, hold, release) => {
      const { container, rail, root } = renderRail();
      const [tap] = slides(container);
      advance(3000);
      hold(rail, root);
      // Far past the end of the loop: nothing changes while held.
      advance(loopOf(0) * 2);
      expect(root).toHaveAttribute('data-active', '0');
      expect(tap.textContent).not.toContain('Deuce');
      release(rail, root);
      // 3 s were already played, so only the rest of the loop is left.
      advance(loopOf(0) - 3000 - 100);
      expect(root).toHaveAttribute('data-active', '0');
      advance(200);
      expect(root).toHaveAttribute('data-active', '1');
    });

    it('does not auto-advance or animate under reduced motion, and can still be moved by hand', () => {
      reducedMotion();
      const { container, rail, root } = renderRail();
      expect(root).toHaveAttribute('data-playing', 'false');
      const [tap, undo, live, moments, paper] = slides(container);
      // Each card shows its one still frame, the one that says what it is about.
      expect(tap.textContent).toContain('Deuce');
      expect(undo.textContent).toContain('A six tapped by mistake is gone. Back to 5.');
      expect(live.textContent).toContain('Sharing live');
      expect(moments.textContent).toContain('Need 12 off 8');
      expect(paper.querySelector('.home-paper')).toHaveClass('is-app');
      advance(loopOf(0) * 3);
      expect(root).toHaveAttribute('data-active', '0');
      expect(tap.textContent).toContain('Deuce');
      expect(container.querySelector('.is-idle')).toBeNull();
      fireEvent.keyDown(rail, { key: 'ArrowRight' });
      expect(root).toHaveAttribute('data-active', '1');
    });
  });
});
