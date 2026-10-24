import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveTeamColours } from '../../../lib/teamColour';
const mock = vi.hoisted(() => ({ feed: [], cloud: true, error: false, query: vi.fn() }));
vi.mock('convex/react', () => ({ useQuery: (ref, args) => {
  mock.query(ref, args);
  if (mock.error) throw new Error('Feed unavailable');
  return mock.feed;
} }));
vi.mock('../../../../convex/_generated/api', () => ({ api: { live: { listLiveFeed: 'feed' } } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ cloudAuthAvailable: mock.cloud }) }));
import MonoLiveNow from './MonoLiveNow';
const item = (token, sport = 'volleyball') => ({ token, sport, scorecardKind: sport === 'badminton' ? 'volleyball' : sport,
  teamA: { name: 'Reds', color: '#ff0000' }, teamB: { name: 'Blues', color: '#0000ff' },
  pointsA: 18, pointsB: 21, setsA: 0, setsB: 0, periodLabel: 'Set 1', lastEventAt: 100000 });
function mount() { return render(<MemoryRouter><Routes><Route path="/" element={<MonoLiveNow />} /><Route path="/play" element={<p>Choose a sport</p>} /></Routes></MemoryRouter>); }
beforeEach(() => { mock.feed = []; mock.cloud = true; mock.error = false; mock.query.mockClear(); vi.useFakeTimers(); vi.setSystemTime(112000); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('Live now', () => {
  it.each([undefined, 'First to 21', '40 min match'])('handles a goals match format of %s without sets', (periodLabel) => {
    mock.feed = [{ ...item('one', 'football'), scorecardKind: 'goals', periodLabel }];
    mount();
    const row = screen.getByRole('link', { name: /Reds versus Blues/ });
    expect(row.textContent).not.toMatch(/sets/i);
    expect(within(row).queryByLabelText(/sets/i)).not.toBeInTheDocument();
    if (periodLabel) expect(within(row).getByText(periodLabel)).toBeInTheDocument();
    else expect(within(row).queryByText(/First to|\d+ min match/i)).not.toBeInTheDocument();
  });

  it('reads only the public feed and renders its scores, period, identity and team colours', () => {
    mock.feed = [item('one')];
    const { container } = mount();
    expect(mock.query).toHaveBeenCalledWith('feed', {});
    expect(mock.query.mock.calls.every(([ref]) => ref === 'feed')).toBe(true);
    const row = screen.getByRole('link', { name: /Reds versus Blues/ });
    expect(row).toHaveAttribute('href', '/live/one');
    for (const value of ['18', '21', 'Set 1', '12s ago', 'Live']) expect(within(row).getByText(value)).toBeInTheDocument();
    expect(within(row).getAllByLabelText(/sets/)).toHaveLength(2);
    const colours = deriveTeamColours('#ff0000', '#0000ff');
    expect(container.querySelector('.kit-live-team-dot').style.backgroundColor).toBeTruthy();
    expect(row.style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
    expect(screen.getByText('Showing public matches with a point in the last 30 minutes.')).toBeInTheDocument();
  });
  it('advances ages and Paused without a new query result, then resumes on a new point', () => {
    mock.feed = [item('one')];
    const view = mount();
    act(() => vi.advanceTimersByTime(79000));
    expect(screen.getByText('Paused')).toBeInTheDocument();
    mock.feed = [{ ...item('one'), lastEventAt: Date.now() }];
    view.rerender(<MemoryRouter><MonoLiveNow /></MemoryRouter>);
    expect(screen.getByText('Live', { selector: '.kit-live-status' })).toBeInTheDocument();
    expect(screen.getByText('0s ago')).toBeInTheDocument();
  });
  it('filters only sports in the feed, returns to All, and resets a removed selection', () => {
    mock.feed = [item('one'), { ...item('two', 'football'), teamA: { name: 'United' } }];
    const view = mount();
    const filters = screen.getByRole('group', { name: 'Filter by sport' });
    expect(within(filters).getAllByRole('button').map(b => b.textContent)).toEqual(['All', 'Volleyball', 'Football']);
    fireEvent.click(within(filters).getByRole('button', { name: 'Football' }));
    expect(screen.queryByRole('link', { name: /Reds versus Blues/ })).not.toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'Football' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(filters).getByRole('button', { name: 'All' }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
    fireEvent.click(within(filters).getByRole('button', { name: 'Football' }));
    mock.feed = [item('one')];
    view.rerender(<MemoryRouter><MonoLiveNow /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /Reds versus Blues/ })).toBeInTheDocument();
  });
  it.each(['empty', 'no cloud', 'error'])('offers /play for %s', (state) => {
    mock.cloud = state !== 'no cloud'; mock.error = state === 'error';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mount();
    expect(screen.getByRole('heading', { name: 'Nothing live right now' })).toBeInTheDocument();
    if (!mock.cloud) expect(mock.query).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: /Score a match/ }));
    expect(screen.getByText('Choose a sport')).toBeInTheDocument();
  });
  it('shows a quiet loading skeleton before the result, then the empty state', () => {
    mock.feed = undefined;
    const view = mount();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading live matches');
    expect(screen.queryByText('Nothing live right now')).not.toBeInTheDocument();
    mock.feed = [];
    view.rerender(<MemoryRouter><MonoLiveNow /></MemoryRouter>);
    expect(screen.getByText('Nothing live right now')).toBeInTheDocument();
  });
  it('uses default team colours and counts games, not sets, for badminton', () => {
    mock.feed = [{ ...item('one', 'badminton'), teamA: { name: 'A' }, teamB: { name: 'B' }, setsB: 1 }];
    mount();
    const row = screen.getByRole('link', { name: /A versus B/ });
    expect(row.style.getPropertyValue('--team-a-core')).toBe(deriveTeamColours().A.core);
    expect(within(row).getByLabelText('0 games')).toHaveTextContent('0games');
    expect(within(row).getByLabelText('1 game')).toHaveTextContent('1game');
    expect(within(row).queryByLabelText(/sets?$/)).toBeNull();
  });
  it('says one set, not one sets', () => {
    mock.feed = [{ ...item('one'), setsA: 1 }];
    mount();
    const row = screen.getByRole('link', { name: /Reds versus Blues/ });
    expect(within(row).getByLabelText('1 set')).toHaveTextContent('1set');
    expect(within(row).getByLabelText('0 sets')).toBeInTheDocument();
  });
});
