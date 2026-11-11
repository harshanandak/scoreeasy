import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../../auth/AuthContext';
import { getSportsByCategory } from '../../../models/sportRegistry';
import GuestLanding from './GuestLanding';
import { STORIES } from './storyTimelines';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route" data-new-match={String(location.state?.newMatch === true)}>{location.pathname}</output>;
}
function renderLanding({ signedIn = false } = {}) {
  return render(<AuthContext.Provider value={{ isAuthenticated: signedIn, cloudAuthAvailable: true, isLoading: false }}>
    <MemoryRouter><LocationProbe /><GuestLanding /></MemoryRouter>
  </AuthContext.Provider>);
}
function setScreen({ width = 390, reduced = false } = {}) {
  vi.stubGlobal('matchMedia', vi.fn((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : width >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1]),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
}
class FakeObserver {
  static all = [];
  constructor(callback) { this.callback = callback; this.disconnect = vi.fn(); FakeObserver.all.push(this); }
  observe = vi.fn();
}
const advance = (ms) => act(() => vi.advanceTimersByTime(ms));
const stage = () => document.querySelector('.stage');
const scene = () => document.querySelector('.scene[aria-hidden="false"]');
const next = () => fireEvent.keyDown(stage(), { key: 'ArrowRight' });
const previous = () => fireEvent.keyDown(stage(), { key: 'ArrowLeft' });
const start = () => within(document.querySelector('.act')).getByRole('button');
const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Home stage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setScreen();
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
      constructor(type, options = {}) { super(type, options); this.pointerType = options.pointerType ?? 'mouse'; }
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete Element.prototype.scrollIntoView;
    FakeObserver.all = [];
  });

  it('orders the top bar, headline, playing stage, Start, account link, steps, picker, closing band and legal footer', () => {
    const { container } = renderLanding();
    const elements = ['.top', 'h1', '.stage', '.act .cta', '.acct', '.steps', '.sports', '.end-grid', '.end-foot'].map((selector) => container.querySelector(selector));
    elements.forEach((el) => expect(el).not.toBeNull());
    elements.slice(1).forEach((el, i) => expect(follows(elements[i], el)).toBe(true));
    expect(container.querySelector('header.hero')).toContainElement(stage());
    expect(container.querySelector('header.hero')).toContainElement(start());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Score your next match on your phone.');
    expect(screen.getByText('3 steps to the first point')).toBeInTheDocument();
    expect(within(container.querySelector('.steps')).getAllByRole('listitem')).toHaveLength(3);
    expect(container.querySelector('.acct')).toHaveTextContent(/^or create a free account$/);
    expect(container.querySelector('footer.end')).toContainElement(screen.getByRole('heading', { name: 'Keep every match.' }));
    expect(container.querySelector('details, .home-sticky, .home-rail')).toBeNull();
    expect(readFileSync('index.html', 'utf8')).not.toContain('"FAQPage"');
  });

  it('shows Sign in only when signed out and does not mark an unfinished sign-in as entering the app', () => {
    const { unmount } = renderLanding();
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(document.querySelector('.top')).toContainElement(link);
    expect(link).toHaveAttribute('href', '/login');
    fireEvent.click(link);
    expect(localStorage.getItem('se_entered_app')).toBeNull();
    unmount();
    renderLanding({ signedIn: true });
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(start()).toHaveAccessibleName('Start a tennis match');
  });

  it('shows My matches only to a returning guest, alongside Sign in', () => {
    const { unmount } = renderLanding();
    expect(screen.queryByRole('link', { name: 'My matches' })).toBeNull();
    unmount();
    localStorage.setItem('se_entered_app', 'true');
    renderLanding();
    const top = within(document.querySelector('.top'));
    expect(top.getByRole('link', { name: 'My matches' })).toHaveAttribute('href', '/app');
    expect(top.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it.each([[899, 'on your phone'], [900, 'from the sideline'], [1280, 'from the sideline']])('uses the approved headline at %ipx', (width, phrase) => {
    setScreen({ width }); renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(phrase);
  });

  it('shows all four story captions and promise chips with one accessible scene at a time', () => {
    renderLanding();
    const perks = ['No sign-up', 'Free', 'Works offline', 'Rules built in'];
    const captions = ['Tap who won the point. The rules call the rest.', 'Wrong tap? One Undo fixes the over.', 'Friends follow live. No signal? Goals wait, then land.', 'Set point, all out, win by 2. Called for you.'];
    perks.forEach((perk, i) => {
      expect(document.querySelectorAll('.scene[aria-hidden="false"]')).toHaveLength(1);
      expect(scene()).toHaveTextContent(perk);
      expect(scene()).toHaveTextContent(captions[i]);
      expect(stage()).toHaveAttribute('aria-roledescription', 'carousel');
      next();
    });
    expect(stage()).toHaveAttribute('data-story', '0');
    expect(stage().querySelectorAll('button')).toHaveLength(1);
  });

  it.each([['tennis', 0], ['cricket', 1], ['football', 2]])('starts %s with the same newMatch state as a tile', (sport, index) => {
    renderLanding();
    for (let i = 0; i < index; i++) next();
    expect(start()).toHaveAccessibleName(`Start a ${sport} match`);
    fireEvent.click(start());
    expect(screen.getByLabelText('Current route')).toHaveTextContent(`/${sport}/quick`);
    expect(screen.getByLabelText('Current route')).toHaveAttribute('data-new-match', 'true');
    expect(localStorage.getItem('se_entered_app')).toBe('true');
  });

  it('last story scrolls to and focuses the picker heading without a pointer focus ring', () => {
    renderLanding(); previous();
    expect(start()).toHaveAccessibleName('Pick your sport');
    fireEvent.click(start(), { detail: 1 });
    const heading = screen.getByRole('heading', { name: 'Pick your sport' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(heading).toHaveFocus();
    expect(document.querySelector('.sports')).toHaveAttribute('data-keyboard-focus', 'false');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  });

  it('retains both Start label and target while hovered, focused or pressed, including overlapping holds', () => {
    renderLanding();
    const button = start();
    fireEvent.pointerEnter(button); fireEvent.focus(button);
    advance(20000);
    expect(stage()).toHaveAttribute('data-story', '0');
    next();
    expect(stage()).toHaveAttribute('data-story', '1');
    expect(button).toHaveAccessibleName('Start a tennis match');
    fireEvent.pointerLeave(button);
    expect(button).toHaveAccessibleName('Start a tennis match');
    fireEvent.pointerDown(button, { clientX: 100 }); fireEvent.blur(button);
    advance(10000);
    expect(button).toHaveAccessibleName('Start a tennis match');
    fireEvent.pointerUp(button, { clientX: 100 });
    expect(button).toHaveAccessibleName('Start a cricket match');
  });

  it('shows the real Popular 6 full tiles and More 3 mini tiles, including Hockey, without group headings', () => {
    renderLanding();
    const groups = getSportsByCategory();
    const popular = within(screen.getByRole('region', { name: 'Popular' })).getAllByRole('button');
    const more = within(screen.getByRole('region', { name: 'More sports' })).getAllByRole('button');
    expect(popular.map((tile) => tile.dataset.sport)).toEqual(groups.Popular.map((sport) => sport.id));
    expect(more.map((tile) => tile.dataset.sport)).toEqual(['tennis', 'tabletennis', 'hockey']);
    expect(popular).toHaveLength(6); expect(more).toHaveLength(3);
    popular.forEach((tile) => { expect(tile).not.toHaveClass('kit-tile-mini'); expect(tile.querySelector('.kit-tile-hint')).not.toBeNull(); });
    more.forEach((tile) => expect(tile).toHaveClass('kit-tile-mini'));
    expect(screen.queryByRole('heading', { name: 'Popular' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'More sports' })).toBeNull();
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/play');
  });

  it.each(Object.values(getSportsByCategory()).flat().map((sport) => [sport.id, sport.name]))('starts %s from its tile', (id, name) => {
    renderLanding(); fireEvent.click(screen.getByRole('button', { name: `Quick match: ${name}` }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(`/${id}/quick`);
    expect(screen.getByLabelText('Current route')).toHaveAttribute('data-new-match', 'true');
  });

  it('wraps arrow keys and horizontal swipes in both directions, ignoring drags and cancellation', () => {
    renderLanding();
    previous(); expect(stage()).toHaveAttribute('data-story', '3');
    next(); expect(stage()).toHaveAttribute('data-story', '0');
    fireEvent.pointerDown(stage(), { clientX: 250, clientY: 100 });
    fireEvent.pointerUp(stage(), { clientX: 100, clientY: 105 });
    expect(stage()).toHaveAttribute('data-story', '1');
    fireEvent.pointerDown(stage(), { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage(), { clientX: 250, clientY: 100 });
    expect(stage()).toHaveAttribute('data-story', '0');
    fireEvent.pointerDown(stage(), { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(stage(), { clientX: 120, clientY: 100 });
    fireEvent.pointerUp(stage(), { clientX: 120, clientY: 100 });
    fireEvent.pointerDown(stage(), { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(stage(), { clientX: 190, clientY: 260 });
    fireEvent.pointerDown(stage(), { clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(stage()); fireEvent.pointerUp(stage(), { clientX: 100, clientY: 100 });
    expect(stage()).toHaveAttribute('data-story', '0');
  });

  it('plays each complete timeline and loops from the fourth story to the first', () => {
    renderLanding();
    STORIES.forEach((story, i) => {
      expect(stage()).toHaveAttribute('data-story', String(i));
      advance(story.duration * 1000 + 30);
    });
    expect(stage()).toHaveAttribute('data-story', '0');
  });

  it('a tap pauses, shows the only pause chip, and a second tap resumes the partial step', () => {
    renderLanding(); advance(1500);
    const tap = () => {
      fireEvent.pointerDown(stage(), { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(stage(), { clientX: 100, clientY: 100 });
    };
    expect(screen.queryByRole('status')).toBeNull();
    tap();
    const before = scene().textContent;
    expect(stage()).toHaveAttribute('data-playing', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Paused');
    expect(screen.getByRole('status')).toHaveAccessibleName('Paused. Tap to play');
    advance(15000); expect(scene().textContent).toBe(before);
    tap();
    expect(stage()).toHaveAttribute('data-story', '0');
    expect(screen.queryByRole('status')).toBeNull();
    advance(299); expect(scene().textContent).toBe(before);
    advance(2); expect(scene().textContent).not.toBe(before);
  });

  it('pressing and holding does not pause, and swiping from a paused story restarts autoplay', () => {
    renderLanding();
    fireEvent.pointerDown(stage(), { clientX: 250, clientY: 100 });
    advance(1500);
    expect(stage()).toHaveAttribute('data-playing', 'true');
    fireEvent.pointerUp(stage(), { clientX: 250, clientY: 100 });
    expect(stage()).toHaveAttribute('data-playing', 'false');
    fireEvent.pointerDown(stage(), { clientX: 250, clientY: 100 });
    fireEvent.pointerUp(stage(), { clientX: 100, clientY: 100 });
    expect(stage()).toHaveAttribute('data-story', '1');
    expect(stage()).toHaveAttribute('data-playing', 'true');
    expect(screen.queryByRole('status')).toBeNull();
    advance(STORIES[1].duration * 1000);
    expect(stage()).toHaveAttribute('data-story', '2');
    fireEvent.keyDown(stage(), { key: ' ' });
    previous();
    expect(stage()).toHaveAttribute('data-story', '1');
    expect(stage()).toHaveAttribute('data-playing', 'true');
    advance(STORIES[1].duration * 1000);
    expect(stage()).toHaveAttribute('data-story', '2');
  });

  it('mouse hover alone holds playback and resumes on leave without a Paused chip', () => {
    renderLanding();
    fireEvent.pointerEnter(start(), { pointerType: 'mouse' });
    expect(stage()).toHaveAttribute('data-playing', 'false');
    expect(screen.queryByRole('status')).toBeNull();
    advance(20000); expect(stage()).toHaveAttribute('data-story', '0');
    fireEvent.pointerLeave(start(), { pointerType: 'mouse' });
    expect(stage()).toHaveAttribute('data-playing', 'true');
    advance(STORIES[0].duration * 1000);
    expect(stage()).toHaveAttribute('data-story', '1');
  });

  it('automatic holds resume themselves but never clear a user pause', () => {
    renderLanding();
    fireEvent.keyDown(stage(), { key: ' ' });
    const observer = FakeObserver.all[0];
    act(() => observer.callback([{ isIntersecting: false, intersectionRatio: 0 }]));
    fireEvent.pointerEnter(start(), { pointerType: 'mouse' });
    act(() => observer.callback([{ isIntersecting: true, intersectionRatio: 1 }]));
    fireEvent.pointerLeave(start(), { pointerType: 'mouse' });
    advance(20000);
    expect(stage()).toHaveAttribute('data-playing', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Paused');
    fireEvent.keyDown(stage(), { key: ' ' });
    advance(STORIES[0].duration * 1000);
    expect(stage()).toHaveAttribute('data-story', '1');
  });

  it.each(['touch', 'pen'])('ignores %s hover and retained pointer focus, but holds while pressed', (pointerType) => {
    renderLanding();
    const button = start();
    fireEvent.pointerEnter(button, { pointerType });
    advance(1000);
    expect(stage()).toHaveAttribute('data-playing', 'true');
    fireEvent.pointerDown(button, { pointerType });
    fireEvent.focus(button);
    expect(stage()).toHaveAttribute('data-playing', 'false');
    fireEvent.pointerUp(button, { pointerType });
    fireEvent.focus(button);
    expect(stage()).toHaveAttribute('data-playing', 'true');
    advance(STORIES[0].duration * 1000);
    expect(stage()).toHaveAttribute('data-story', '1');
  });

  it('toggles the keyboard-only pause control and Space on the stage without intercepting button keys', () => {
    renderLanding(); advance(2000);
    const before = scene().textContent;
    const pause = screen.getByRole('button', { name: 'Pause stories' });
    expect(pause).toHaveClass('story-pause');
    fireEvent.click(pause);
    expect(screen.getByRole('button', { name: 'Play stories' })).toBeInTheDocument();
    advance(15000); expect(scene().textContent).toBe(before);
    fireEvent.keyDown(pause, { key: 'ArrowRight' });
    expect(stage()).toHaveAttribute('data-story', '0');
    fireEvent.keyDown(stage(), { key: ' ' });
    expect(screen.getByRole('button', { name: 'Pause stories' })).toBeInTheDocument();
    advance(1000); expect(scene().textContent).not.toBe(before);
    fireEvent.keyDown(stage(), { key: ' ' });
    expect(stage()).toHaveAttribute('data-playing', 'false');
  });

  it('pauses off screen and in a hidden tab and cleans up observers and timers', () => {
    const { unmount } = renderLanding(); advance(2000);
    const observer = FakeObserver.all[0];
    act(() => observer.callback([{ isIntersecting: false, intersectionRatio: 0 }]));
    const before = scene().textContent; advance(15000); expect(scene().textContent).toBe(before);
    act(() => observer.callback([{ isIntersecting: true, intersectionRatio: 1 }]));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    advance(15000); expect(scene().textContent).toBe(before);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    advance(1000); expect(scene().textContent).not.toBe(before);
    unmount(); expect(observer.disconnect).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it('calls deuce and advantage, then resets points to 0–0, games to 1–0 and serve to Meera after the game', () => {
    renderLanding(); advance(5050); expect(scene()).toHaveTextContent('Deuce');
    advance(1200); expect(scene()).toHaveTextContent('Advantage Asha');
    advance(1200); expect(scene()).toHaveTextContent('Game Asha');
    const asha = scene().querySelector('[data-player="Asha"]');
    const meera = scene().querySelector('[data-player="Meera"]');
    expect(asha.querySelector('.pt')).toHaveTextContent(/^0$/);
    expect(meera.querySelector('.pt')).toHaveTextContent(/^0$/);
    expect(asha.querySelector('.gm')).toHaveTextContent('Games 1');
    expect(meera.querySelector('.gm')).toHaveTextContent('Games 0');
    expect(within(scene()).getByRole('img', { name: 'Meera serving' })).toBeInTheDocument();
    expect(within(scene()).queryByRole('img', { name: 'Asha serving' })).toBeNull();
    expect(scene().querySelector('.kicker')).toHaveTextContent('Tennis · Game 2');
    expect([...scene().querySelectorAll('.pt')].map((el) => el.textContent)).not.toContain('G');
  });

  it('Undo removes the six, recounts 11 to 5 and keeps all six balls of the over', () => {
    renderLanding(); next(); advance(2550);
    expect(scene().querySelector('.c-runs')).toHaveTextContent(/^11$/);
    expect([...scene().querySelectorAll('.ball.f')].map((el) => el.textContent)).toEqual(['1', '4', '6']);
    advance(1100);
    expect(scene().querySelector('.c-runs')).toHaveTextContent(/^5$/);
    expect([...scene().querySelectorAll('.ball.f')].map((el) => el.textContent)).toEqual(['1', '4']);
    advance(500); expect(scene().querySelector('.removed-six')).toBeNull();
    expect(scene().querySelectorAll('.ball')).toHaveLength(6);
    advance(2200);
    expect([...scene().querySelectorAll('.ball.f')].map((el) => el.textContent)).toEqual(['1', '4', '2', 'W', '1']);
    expect(scene().querySelector('.c-runs')).toHaveTextContent(/^8$/);
  });

  it('shows football goals saved without signal then arriving on the live link', () => {
    renderLanding(); next(); next(); advance(3600);
    expect(scene()).toHaveTextContent('Saved here');
    const phones = scene().querySelectorAll('.ph');
    expect(phones[0].querySelector('.sc')).toHaveTextContent('2');
    expect(phones[1].querySelector('.sc')).toHaveTextContent('1');
    advance(2000); expect(phones[1]).toHaveTextContent('Arrived');
    expect(phones[1].querySelector('.sc')).toHaveTextContent('2');
  });

  it('uses final truthful reduced-motion frames, auto advances every 6s, and still pauses and navigates', () => {
    setScreen({ reduced: true }); renderLanding();
    expect(scene()).toHaveTextContent('Game Asha');
    expect(scene().querySelector('[data-player="Asha"] .pt')).toHaveTextContent(/^0$/);
    expect(within(scene()).getByRole('img', { name: 'Meera serving' })).toBeInTheDocument();
    advance(5999); expect(stage()).toHaveAttribute('data-story', '0');
    advance(1); expect(stage()).toHaveAttribute('data-story', '1');
    expect(scene().querySelector('.c-runs')).toHaveTextContent(/^8$/);
    expect(scene().querySelectorAll('.ball.f')).toHaveLength(5);
    advance(6000); expect([...scene().querySelectorAll('.sc')].map((el) => el.textContent)).toEqual(['2', '2']);
    advance(6000); expect(scene().querySelectorAll('.mom.shown')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Pause stories' }));
    advance(12000); expect(stage()).toHaveAttribute('data-story', '3');
    expect(stage()).toHaveAttribute('data-playing', 'false');
    fireEvent.keyDown(stage(), { key: ' ' });
    advance(6000); expect(stage()).toHaveAttribute('data-story', '0');
    previous();
    fireEvent.click(start());
    expect(screen.getByRole('heading', { name: 'Pick your sport' }).scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('syncs all four hero/footer gradients and theme colours, restoring the prior meta value on unmount', () => {
    const meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = '#123456'; document.head.appendChild(meta);
    const { unmount } = renderLanding();
    STORIES.forEach((story) => {
      expect(meta.content).toBe(story.theme);
      const layers = document.querySelectorAll('.hero-bg i.on');
      expect(layers).toHaveLength(2);
      layers.forEach((layer) => expect(layer).toHaveStyle({ background: story.gradient }));
      next();
    });
    unmount(); expect(meta.content).toBe('#123456'); meta.remove();
  });

  it('runs only nudge A once and keeps the account, closing and legal routes', () => {
    renderLanding();
    const nudge = document.querySelector('.nudge'); expect(nudge).toHaveAttribute('aria-hidden', 'true');
    expect(nudge).toHaveTextContent('Go on, try one'); advance(5250); expect(nudge).toHaveClass('gone');
    next(); previous(); advance(10000); expect(nudge).toHaveClass('gone');
    expect(screen.getByRole('link', { name: 'create a free account' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    for (const label of ['Privacy', 'Terms', 'Contact']) expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', `/${label.toLowerCase()}`);
    expect(document.querySelector('.end-foot')).toHaveTextContent('© 2026 Score Easy');
  });
});
