import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ feed: [], cloud: true, error: false, query: vi.fn() }));
vi.mock('convex/react', () => ({ useQuery: (...args) => {
  mock.query(...args);
  if (mock.error) throw new Error('Unavailable');
  return mock.feed;
} }));
vi.mock('../../../../convex/_generated/api', () => ({ api: { live: { listLiveFeed: 'feed' } } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ cloudAuthAvailable: mock.cloud }) }));
import LiveNavButton from './LiveNavButton';
beforeEach(() => { mock.feed = []; mock.cloud = true; mock.error = false; mock.query.mockClear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Live navigation presence', () => {
  it('announces the current count and removes the dot for empty/loading feeds', () => {
    mock.feed = [{}, {}, {}, {}];
    const view = render(<LiveNavButton>Live</LiveNavButton>);
    expect(screen.getByRole('button', { name: 'Live, 4 matches now' }).querySelector('.kit-nav-live-dot')).toBeInTheDocument();
    expect(mock.query).toHaveBeenCalledWith('feed', {});
    for (const feed of [[], undefined]) {
      mock.feed = feed;
      view.rerender(<LiveNavButton>Live</LiveNavButton>);
      expect(screen.getByRole('button', { name: 'Live' }).querySelector('.kit-nav-live-dot')).toBeNull();
    }
  });
  it('keeps the button without querying when cloud is unavailable', () => {
    mock.cloud = false;
    render(<LiveNavButton aria-current="page">Live</LiveNavButton>);
    expect(mock.query).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-current', 'page');
  });
  it('contains a discovery failure and keeps the original navigation handler', () => {
    mock.error = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const click = vi.fn();
    render(<LiveNavButton onClick={click}>Live</LiveNavButton>);
    screen.getByRole('button', { name: 'Live' }).click();
    expect(click).toHaveBeenCalledOnce();
  });
});
