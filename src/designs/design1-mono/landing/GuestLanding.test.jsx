import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, LocalAuthProvider } from '../../../auth/AuthContext';
import { LATER_GROUP_LABEL, PRIORITY_GROUP_LABEL } from '../../../models/sportFocus';
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

const COUNT = CARDS.length;
const loopOf = (card) => CARDS[card].timeline.loopMs;
const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/* jsdom has no layout and no media: this answers (min-width: N) and prefers-reduced-motion for a window
   `width` px wide. With no call at all there is no matchMedia, which Home reads as a phone. */
function setScreen({ width = 390, reduced = false } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    let matches = false;
    if (query.includes('prefers-reduced-motion')) matches = reduced;
    else if (min) matches = width >= Number(min[1]);
    return { matches, media: query, addEventListener: () => {}, removeEventListener: () => {} };
  });
}

/* An IntersectionObserver the test drives by hand. */
class FakeObserver {
  static all = [];

  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
    FakeObserver.all.push(this);
  }

  observe(el) { this.targets.add(el); }

  unobserve(el) { this.targets.delete(el); }

  disconnect() { this.targets.clear(); }
}

function see(el, { visible, top = 0 }) {
  act(() => {
    FakeObserver.all.forEach((observer) => {
      if (observer.targets.has(el)) {
        observer.callback([{ target: el, isIntersecting: visible, intersectionRatio: visible ? 1 : 0, boundingClientRect: { top, bottom: top + 10 } }]);
      }
    });
  });
}

describe('Home', () => {
  beforeEach(() => { localStorage.clear(); });

  afterEach(() => {
    cleanup();
    delete window.matchMedia;
    delete Element.prototype.scrollIntoView;
    vi.unstubAllGlobals();
    FakeObserver.all = [];
  });

  describe('first screen and page order', () => {
    it('is, on a phone, the top bar, the headline, one reassurance line and the rail: Start comes after', () => {
      const { container } = renderLanding();
      const first = container.querySelector('.home-first');
      expect(first.querySelector('.kit-top')).not.toBeNull();
      const headline = within(first).getByRole('heading', { level: 1 });
      expect(headline).toHaveTextContent('Score your next match on your phone.');
      const assure = within(first).getByText('Free · No account · Works offline');
      const rail = within(first).getByTestId('landing-example');
      expect(follows(headline, assure)).toBe(true);
      expect(follows(assure, rail)).toBe(true);
      // Nothing else is above the fold: Start and the sport picker come after the rail.
      expect(within(first).queryByRole('button', { name: 'Start a match' })).toBeNull();
      expect(within(first).queryByRole('heading', { name: 'Pick your sport' })).toBeNull();
      const start = container.querySelector('.home-start').querySelector('.se-go');
      expect(follows(rail, start)).toBe(true);
      expect(follows(start, container.querySelector('.home-picker'))).toBe(true);
    });

    it('puts Sign in in the top bar for a signed-out visitor only', () => {
      const { container, unmount } = renderLanding();
      const signIn = screen.getByRole('link', { name: 'Sign in' });
      expect(signIn).toHaveAttribute('href', '/login');
      expect(container.querySelector('.kit-top')).toContainElement(signIn);
      expect(container.querySelector('.home-copy')).not.toContainElement(signIn);
      expect(screen.getByRole('link', { name: 'Create a free account' })).toBeInTheDocument();
      unmount();
      renderSignedIn();
      expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Create a free account' })).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Start a match' }).length).toBeGreaterThan(0);
    });

    it('does not remember an unfinished Sign in attempt', () => {
      renderLanding();
      fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
      expect(localStorage.getItem('se_entered_app')).toBeNull();
    });

    it('says phone below 900px and device or sideline from 900px', () => {
      setScreen({ width: 390 });
      const phone = renderLanding();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Score your next match on your phone.');
      expect(screen.getByText('No account needed. Your score saves on this phone, even offline.')).toBeInTheDocument();
      expect(screen.getByText(/Save across phones\?/)).toBeInTheDocument();
      phone.unmount();
      setScreen({ width: 900 });
      renderLanding();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Score your next match from the sideline.');
      expect(screen.getByText('No account needed. Your score saves on this device, even offline.')).toBeInTheDocument();
      expect(screen.getByText(/Save across devices\?/)).toBeInTheDocument();
      expect(screen.queryByText(/phone/i, { selector: 'h1, .home-saves, .home-account' })).toBeNull();
    });

    it('keeps FAQs collapsed and the structured data consistent', () => {
      const { container } = renderLanding();
      const rows = [...container.querySelectorAll('details')];
      expect(rows).toHaveLength(4);
      for (const row of rows) expect(row).not.toHaveAttribute('open');
      const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
      expect(blocks.find((block) => block['@type'] === 'FAQPage').mainEntity.map((item) => [item.name, item.acceptedAnswer.text])).toEqual(LANDING_FAQ.map((item) => [item.question, item.answer]));
    });

    it('ends with a closing Start above the footer', () => {
      const { container } = renderLanding();
      const close = container.querySelector('.home-close');
      expect(within(close).getByRole('button', { name: 'Start a match' })).toBeInTheDocument();
      expect(follows(container.querySelector('.home-faq'), close)).toBe(true);
      expect(follows(close, container.querySelector('.kit-landing-foot'))).toBe(true);
    });
  });

  describe('Start and the sport picker', () => {
    it('has Start as a button that scrolls to the picker and moves focus to its heading, without leaving the page', () => {
      const scrolled = [];
      Element.prototype.scrollIntoView = vi.fn(function scrollIntoView() { scrolled.push(this); });
      const { container } = renderLanding();
      const start = container.querySelector('.home-start').querySelector('.se-go');
      expect(start.tagName).toBe('BUTTON');
      fireEvent.click(start);
      expect(scrolled).toEqual([container.querySelector('.home-picker')]);
      expect(screen.getByRole('heading', { name: 'Pick your sport' })).toHaveFocus();
      expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
    });

    it('shows Play\'s picker: Popular as 6 full tiles, More sports as 3 mini tiles with Hockey, in registry order', () => {
      const { container } = renderLanding();
      const groups = getSportsByCategory();
      const popularIds = groups[PRIORITY_GROUP_LABEL].map((sport) => sport.id);
      const moreIds = groups[LATER_GROUP_LABEL].map((sport) => sport.id);
      const popular = [...container.querySelectorAll('.home-picker .kit-grid2 .kit-tile')];
      const more = [...container.querySelectorAll('.home-picker .kit-grid3 .kit-tile')];
      expect(popular.map((tile) => tile.dataset.sport)).toEqual(popularIds);
      expect(popular).toHaveLength(6);
      expect(more.map((tile) => tile.dataset.sport)).toEqual(moreIds);
      expect(more).toHaveLength(3);
      expect(more.map((tile) => tile.dataset.sport)).toContain('hockey');
      for (const tile of popular) {
        expect(tile).not.toHaveClass('kit-tile-mini');
        expect(tile.querySelector('.kit-tile-hint')).not.toBeNull();
      }
      for (const tile of more) expect(tile).toHaveClass('kit-tile-mini');
      expect(screen.getByRole('heading', { name: PRIORITY_GROUP_LABEL })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: LATER_GROUP_LABEL })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'See all' })).toBeNull();
    });

    it('starts the tapped sport quick match from a tile', () => {
      for (const id of ['cricket', 'tennis', 'hockey']) {
        const { container } = renderLanding();
        fireEvent.click(container.querySelector(`.kit-tile[data-sport="${id}"]`));
        expect(screen.getByLabelText('Current route')).toHaveTextContent(new RegExp(`^/${id}/quick$`));
        expect(screen.getByLabelText('Current route')).toHaveAttribute('data-new-match', 'true');
        cleanup();
      }
    });

    it('moves Start into the hero column on a desktop, beside the headline and the account line', () => {
      setScreen({ width: 1280 });
      const { container } = renderLanding();
      const copy = container.querySelector('.home-copy');
      expect(within(copy).getByRole('button', { name: 'Start a match' })).toBeInTheDocument();
      expect(within(copy).getByRole('link', { name: 'Create a free account' })).toBeInTheDocument();
    });
  });

  describe('sticky Start bar', () => {
    beforeEach(() => { vi.stubGlobal('IntersectionObserver', FakeObserver); });

    const els = (container) => ({
      start: container.querySelector('.home-start'),
      picker: container.querySelector('.home-picker'),
      end: container.querySelector('.home-close').parentElement,
    });
    const bar = () => screen.queryByTestId('sticky-start');

    it('is off at first, comes on once the in-flow Start is above the top of the screen, and goes while the picker or the closing block is on screen', () => {
      const { container } = renderLanding();
      const { start, picker, end } = els(container);
      expect(bar()).toBeNull();
      // Start is still below the fold (not scrolled off the top): no bar.
      see(start, { visible: false, top: 600 });
      expect(bar()).toBeNull();
      see(start, { visible: false, top: -80 });
      expect(bar()).not.toBeNull();
      expect(within(bar()).getByRole('button', { name: 'Start a match' })).toBeInTheDocument();
      see(picker, { visible: true });
      expect(bar()).toBeNull();
      see(picker, { visible: false });
      expect(bar()).not.toBeNull();
      see(end, { visible: true });
      expect(bar()).toBeNull();
      see(end, { visible: false });
      expect(bar()).not.toBeNull();
      // Back up the page, the in-flow Start is on screen again.
      see(start, { visible: true });
      expect(bar()).toBeNull();
    });

    it('scrolls to the picker and focuses its heading, like the in-flow Start', () => {
      const scrolled = [];
      Element.prototype.scrollIntoView = vi.fn(function scrollIntoView() { scrolled.push(this); });
      const { container } = renderLanding();
      see(els(container).start, { visible: false, top: -80 });
      fireEvent.click(within(bar()).getByRole('button', { name: 'Start a match' }));
      expect(scrolled).toEqual([container.querySelector('.home-picker')]);
      expect(screen.getByRole('heading', { name: 'Pick your sport' })).toHaveFocus();
    });

    it.each([[800], [1280]])('is only for phones: none at %ipx', (width) => {
      setScreen({ width });
      const { container } = renderLanding();
      see(els(container).start, { visible: false, top: -80 });
      expect(bar()).toBeNull();
    });
  });

  describe('card rail on a phone', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
    const root = () => screen.getByTestId('landing-example');
    const stage = () => root().querySelector('.home-stage');
    const slides = () => [...root().querySelectorAll('[aria-roledescription="slide"]')];
    const dots = () => within(within(root()).getByRole('group', { name: 'Choose a card' })).getAllByRole('button');
    const pressKey = () => fireEvent.keyDown(document.body, { key: 'Tab' });
    const pressPointer = () => fireEvent.pointerDown(document.body);

    it('is a labelled carousel with one card on show and one dot for each of the five cards', () => {
      renderLanding();
      expect(root()).toHaveAttribute('aria-roledescription', 'carousel');
      expect(root()).toHaveAccessibleName();
      expect(slides()).toHaveLength(1);
      expect(root().querySelectorAll('[data-clone]')).toHaveLength(0);
      expect(CARDS.map((card) => card.id)).toEqual(['tap', 'undo', 'live', 'moments', 'paper']);
      expect(dots()).toHaveLength(COUNT);
      expect(dots()[0]).toHaveAttribute('aria-current', 'true');
      expect(within(root()).queryByRole('button', { name: /Previous card|Next card/ })).toBeNull();
      expect(root().querySelector('.home-board, .home-slide-tag')).toBeNull();
    });

    it('gives every card a heading and a picture named for what happens in it, reached by the dots', () => {
      renderLanding();
      CARDS.forEach((card, i) => {
        fireEvent.click(dots()[i]);
        expect(dots()[i]).toHaveAttribute('aria-current', 'true');
        expect(within(root()).getByRole('group', { name: `${i + 1} of ${COUNT}: ${card.title}` })).toBeInTheDocument();
        expect(within(root()).getByRole('heading', { level: 3, name: card.title })).toBeInTheDocument();
        expect(within(root()).getByRole('img', { name: card.label })).toBeInTheDocument();
      });
    });

    it('plays each card through, moves to the next, and wraps from the last card to the first', () => {
      renderLanding();
      for (let i = 0; i < COUNT; i += 1) {
        expect(root()).toHaveAttribute('data-start', String(i));
        expect(dots()[i]).toHaveAttribute('aria-current', 'true');
        advance(loopOf(i) - 50);
        expect(root()).toHaveAttribute('data-start', String(i));
        advance(100);
      }
      expect(root()).toHaveAttribute('data-start', '0');
    });

    it('wraps from the first card to the last on a swipe or an arrow key, and round again', () => {
      renderLanding();
      fireEvent.keyDown(stage(), { key: 'ArrowLeft' });
      expect(root()).toHaveAttribute('data-start', String(COUNT - 1));
      fireEvent.keyDown(stage(), { key: 'ArrowRight' });
      expect(root()).toHaveAttribute('data-start', '0');
      // A swipe: the finger moves left to go on, right to go back.
      fireEvent.pointerDown(stage(), { pointerType: 'touch', clientX: 260, clientY: 300 });
      fireEvent.pointerUp(stage(), { pointerType: 'touch', clientX: 120, clientY: 305 });
      expect(root()).toHaveAttribute('data-start', '1');
      fireEvent.pointerDown(stage(), { pointerType: 'touch', clientX: 100, clientY: 300 });
      fireEvent.pointerUp(stage(), { pointerType: 'touch', clientX: 240, clientY: 300 });
      fireEvent.pointerDown(stage(), { pointerType: 'touch', clientX: 100, clientY: 300 });
      fireEvent.pointerUp(stage(), { pointerType: 'touch', clientX: 240, clientY: 300 });
      expect(root()).toHaveAttribute('data-start', String(COUNT - 1));
      // A short or mostly vertical drag is not a swipe.
      fireEvent.pointerDown(stage(), { pointerType: 'touch', clientX: 100, clientY: 100 });
      fireEvent.pointerUp(stage(), { pointerType: 'touch', clientX: 130, clientY: 100 });
      fireEvent.pointerDown(stage(), { pointerType: 'touch', clientX: 100, clientY: 100 });
      fireEvent.pointerUp(stage(), { pointerType: 'touch', clientX: 190, clientY: 260 });
      expect(root()).toHaveAttribute('data-start', String(COUNT - 1));
    });

    it('starts every card from its opening frame and plays only the card on show', () => {
      renderLanding();
      expect(slides()[0].textContent).toContain('Love all');
      expect(slides()[0].textContent).not.toContain('Deuce');
      advance(4500);
      expect(slides()[0].textContent).toContain('Deuce');
      fireEvent.click(dots()[1]);
      expect(slides()[0].textContent).toContain('New over');
      expect(slides()[0].textContent).not.toContain('A single');
    });

    it('stops the advance and the animation on Pause, and carries on from where it stopped on Play', () => {
      renderLanding();
      const pause = screen.getByRole('button', { name: 'Pause animations' });
      expect(root()).toHaveAttribute('data-playing', 'true');
      advance(3000);
      const before = slides()[0].textContent;
      fireEvent.click(pause);
      expect(screen.getByRole('button', { name: 'Play animations' })).toBeInTheDocument();
      expect(root()).toHaveAttribute('data-playing', 'false');
      advance(loopOf(0) * 2);
      expect(root()).toHaveAttribute('data-start', '0');
      expect(slides()[0].textContent).toBe(before);
      fireEvent.click(screen.getByRole('button', { name: 'Play animations' }));
      expect(root()).toHaveAttribute('data-playing', 'true');
      // 3 s were already played, so only the rest of the loop is left.
      advance(loopOf(0) - 3000 - 100);
      expect(root()).toHaveAttribute('data-start', '0');
      advance(200);
      expect(root()).toHaveAttribute('data-start', '1');
    });

    it.each([
      ['a finger', () => fireEvent.pointerDown(stage(), { pointerType: 'touch', clientX: 10, clientY: 10 }), () => fireEvent.pointerUp(stage(), { pointerType: 'touch', clientX: 10, clientY: 10 })],
      ['the pointer', () => fireEvent.mouseEnter(root()), () => fireEvent.mouseLeave(root())],
      ['keyboard focus', () => { pressKey(); fireEvent.focus(stage()); }, () => fireEvent.blur(stage())],
    ])('holds while %s is on it, and carries on after', (_name, hold, release) => {
      renderLanding();
      advance(3000);
      hold();
      expect(root()).toHaveAttribute('data-playing', 'false');
      const held = slides()[0].textContent;
      advance(loopOf(0) * 2);
      expect(root()).toHaveAttribute('data-start', '0');
      expect(slides()[0].textContent).toBe(held);
      release();
      expect(root()).toHaveAttribute('data-playing', 'true');
      advance(loopOf(0) - 3000 + 100);
      expect(root()).toHaveAttribute('data-start', '1');
    });

    it('does not hold for the focus a tap leaves behind', () => {
      renderLanding();
      pressPointer();
      fireEvent.focus(stage());
      expect(root()).toHaveAttribute('data-playing', 'true');
    });

    it('holds while the tab is hidden and while less than half of it is on screen', () => {
      vi.stubGlobal('IntersectionObserver', FakeObserver);
      renderLanding();
      expect(root()).toHaveAttribute('data-playing', 'true');
      see(root(), { visible: false });
      expect(root()).toHaveAttribute('data-playing', 'false');
      see(root(), { visible: true });
      expect(root()).toHaveAttribute('data-playing', 'true');
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(root()).toHaveAttribute('data-playing', 'false');
      delete document.hidden;
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(root()).toHaveAttribute('data-playing', 'true');
    });

    it('never stalls: a touch let go just after the card ended still moves on', () => {
      renderLanding();
      advance(loopOf(0) - 100);
      fireEvent.pointerDown(stage(), { pointerType: 'touch', clientX: 10, clientY: 10 });
      advance(5000);
      expect(root()).toHaveAttribute('data-start', '0');
      fireEvent.pointerUp(stage(), { pointerType: 'touch', clientX: 10, clientY: 10 });
      advance(200);
      expect(root()).toHaveAttribute('data-start', '1');
    });

    it('never stalls: if the end timer is lost, the next check sees the deadline has passed and moves on', () => {
      renderLanding();
      advance(1000);
      // The page's clock is throttled: the wall clock moves on but the end timer does not fire.
      vi.setSystemTime(Date.now() + loopOf(0) + 5000);
      advance(500);
      expect(root()).toHaveAttribute('data-start', '1');
    });

    it('never shows a letter as a tennis score while the tap card plays', () => {
      renderLanding();
      const seen = new Set();
      for (let t = 0; t <= loopOf(0) - 100; t += 100) {
        root().querySelectorAll('.home-tap-pt .home-r').forEach((el) => seen.add(el.textContent));
        advance(100);
      }
      expect([...seen].sort()).toEqual(['0', '15', '30', '40', 'AD']);
      expect(root().textContent).not.toMatch(/\bG\b/);
    });

    it('does not advance or animate under reduced motion, shows each card as one still frame, and can still be moved by hand', () => {
      setScreen({ width: 390, reduced: true });
      renderLanding();
      expect(root()).toHaveAttribute('data-playing', 'false');
      expect(screen.queryByRole('button', { name: /animations/ })).toBeNull();
      expect(slides()[0].textContent).toContain('Deuce');
      advance(loopOf(0) * 3);
      expect(root()).toHaveAttribute('data-start', '0');
      expect(slides()[0].textContent).toContain('Deuce');
      const still = ['A six tapped by mistake is gone. Back to 5.', 'Sharing live', 'Need 12 off 8'];
      still.forEach((text, i) => {
        fireEvent.keyDown(stage(), { key: 'ArrowRight' });
        expect(root()).toHaveAttribute('data-start', String(i + 1));
        expect(slides()[0].textContent).toContain(text);
      });
      fireEvent.click(dots()[4]);
      expect(slides()[0].querySelector('.home-paper')).toHaveClass('is-app');
    });
  });

  describe('card rail on a tablet', () => {
    beforeEach(() => { vi.useFakeTimers(); setScreen({ width: 800 }); });
    afterEach(() => { vi.useRealTimers(); });

    it('shows two cards, plays both, and moves on two at a time without losing a card', () => {
      renderLanding();
      const root = screen.getByTestId('landing-example');
      const slides = () => [...root.querySelectorAll('[aria-roledescription="slide"]')];
      expect(slides()).toHaveLength(2);
      expect(slides().map((slide) => slide.getAttribute('aria-label'))).toEqual([
        `1 of ${COUNT}: ${CARDS[0].title}`, `2 of ${COUNT}: ${CARDS[1].title}`,
      ]);
      act(() => { vi.advanceTimersByTime(2000); });
      // Both cards on show are playing: the tap card is past its opening and so is the undo card.
      expect(slides()[0].querySelector('.home-tap-call .home-r:not(.is-out)')).not.toHaveTextContent('Love all');
      expect(slides()[1].textContent).not.toContain('New over');
      act(() => { vi.advanceTimersByTime(Math.max(loopOf(0), loopOf(1)) - 2000 + 50); });
      expect(root).toHaveAttribute('data-start', '2');
      expect(slides()).toHaveLength(2);
      expect(root.querySelectorAll('.home-dot.is-on')).toHaveLength(2);
      // The last page wraps: card 5 then card 1.
      act(() => { vi.advanceTimersByTime(Math.max(loopOf(2), loopOf(3)) + 50); });
      expect(slides().map((slide) => slide.getAttribute('aria-label'))).toEqual([
        `5 of ${COUNT}: ${CARDS[4].title}`, `1 of ${COUNT}: ${CARDS[0].title}`,
      ]);
    });
  });

  describe('card marquee on a desktop', () => {
    beforeEach(() => { vi.useFakeTimers(); setScreen({ width: 1280 }); });
    afterEach(() => { vi.useRealTimers(); });

    const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });
    const root = () => screen.getByTestId('landing-example');

    it('slides two identical groups, the copy hidden from assistive tech and from the keyboard, with no arrow buttons', () => {
      renderLanding();
      expect(root()).toHaveClass('home-marquee');
      const groups = [...root().querySelectorAll('.home-group')];
      expect(groups).toHaveLength(2);
      expect(groups[0]).not.toHaveAttribute('aria-hidden');
      expect(groups[1]).toHaveAttribute('aria-hidden', 'true');
      expect(groups[1]).toHaveAttribute('inert');
      expect(groups[1].querySelectorAll('.home-card')).toHaveLength(COUNT);
      expect(groups[1].querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(0);
      expect(within(root()).getAllByRole('group', { name: /of 5:/ })).toHaveLength(COUNT);
      expect(within(root()).getAllByRole('img')).toHaveLength(COUNT);
      expect(within(root()).queryByRole('button', { name: /Previous card|Next card/ })).toBeNull();
      expect(root().querySelectorAll('.home-dot')).toHaveLength(0);
    });

    it('plays every card on show by itself, and starts each over when its loop ends', () => {
      renderLanding();
      const [tap, undo] = within(root()).getAllByRole('group', { name: /of 5:/ });
      expect(tap.textContent).toContain('Love all');
      advance(1200);
      expect(undo.textContent).toContain('A single');
      advance(800);
      expect(tap.querySelector('.home-tap-call .home-r:not(.is-out)')).not.toHaveTextContent('Love all');
      advance(loopOf(0) - 2000 + 300);
      expect(tap.textContent).toContain('Love all');
    });

    it('stands a card still while it is off screen and plays it again when it comes back', () => {
      vi.stubGlobal('IntersectionObserver', FakeObserver);
      renderLanding();
      const [tap] = within(root()).getAllByRole('group', { name: /of 5:/ });
      see(tap, { visible: false });
      advance(4000);
      expect(tap.textContent).toContain('Love all');
      see(tap, { visible: true });
      advance(2000);
      expect(tap.querySelector('.home-tap-call .home-r:not(.is-out)')).not.toHaveTextContent('Love all');
    });

    it('has a visible Pause that stops the track and every animation, and Play carries on; hover and keyboard focus pause too', () => {
      renderLanding();
      const [tap] = within(root()).getAllByRole('group', { name: /of 5:/ });
      advance(2000);
      const before = tap.textContent;
      fireEvent.click(screen.getByRole('button', { name: 'Pause animations' }));
      expect(root()).toHaveClass('is-paused');
      expect(root()).toHaveAttribute('data-playing', 'false');
      advance(5000);
      expect(tap.textContent).toBe(before);
      fireEvent.click(screen.getByRole('button', { name: 'Play animations' }));
      expect(root()).not.toHaveClass('is-paused');
      advance(2000);
      expect(tap.textContent).not.toBe(before);
      fireEvent.mouseEnter(root());
      expect(root()).toHaveClass('is-paused');
      fireEvent.mouseLeave(root());
      expect(root()).not.toHaveClass('is-paused');
      fireEvent.keyDown(document.body, { key: 'Tab' });
      fireEvent.focus(screen.getByRole('button', { name: 'Pause animations' }));
      expect(root()).toHaveClass('is-paused');
      fireEvent.blur(screen.getByRole('button', { name: 'Pause animations' }));
      expect(root()).not.toHaveClass('is-paused');
    });

    it('has no marquee under reduced motion: one static row of cards on their still frames, no copy, no Pause', () => {
      setScreen({ width: 1280, reduced: true });
      renderLanding();
      expect(root()).toHaveClass('is-still');
      expect(root().querySelectorAll('.home-group')).toHaveLength(1);
      expect(screen.queryByRole('button', { name: /animations/ })).toBeNull();
      const [tap] = within(root()).getAllByRole('group', { name: /of 5:/ });
      expect(tap.textContent).toContain('Deuce');
      advance(loopOf(0) * 2);
      expect(tap.textContent).toContain('Deuce');
    });
  });
});
