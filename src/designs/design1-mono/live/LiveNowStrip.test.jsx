import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from '../../../components/ErrorBoundary';

const mocks = vi.hoisted(() => ({ feed: undefined, cloud: true, throwErr: false, useQuery: vi.fn() }));

vi.mock('convex/react', () => ({
  useQuery: (ref, args) => {
    mocks.useQuery(ref, args);
    if (mocks.throwErr) throw new Error("Could not find public function for 'live:listLiveFeed'.");
    return mocks.feed;
  },
}));
vi.mock('../../../../convex/_generated/api', () => ({ api: { live: { listLiveFeed: 'live:listLiveFeed' } } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ cloudAuthAvailable: mocks.cloud }) }));

import LiveNowStrip from './LiveNowStrip';

const item = (token, a, b) => ({
  token,
  sport: 'tennis',
  scorecardKind: 'tennis',
  pointsA: 0,
  pointsB: 0,
  setsA: 1,
  setsB: 0,
  periodLabel: '40-30',
  teamA: { name: a },
  teamB: { name: b },
});

beforeEach(() => {
  mocks.feed = undefined;
  mocks.cloud = true;
  mocks.throwErr = false;
  mocks.useQuery.mockClear();
});
afterEach(cleanup);

describe('LiveNowStrip', () => {
  it('renders nothing while loading', () => {
    mocks.feed = undefined;
    const { container } = render(<MemoryRouter><LiveNowStrip /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when nothing is live', () => {
    mocks.feed = [];
    const { container } = render(<MemoryRouter><LiveNowStrip /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when cloud is unavailable, and skips the query', () => {
    mocks.cloud = false;
    mocks.feed = undefined;
    const { container } = render(<MemoryRouter><LiveNowStrip /></MemoryRouter>);
    expect(mocks.useQuery).toHaveBeenCalledWith('live:listLiveFeed', 'skip');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the rail of live cards linking to each watch page', () => {
    mocks.feed = [item('T1', 'Reds', 'Blues')];
    render(<MemoryRouter><LiveNowStrip /></MemoryRouter>);
    expect(mocks.useQuery).toHaveBeenCalledWith('live:listLiveFeed', { limit: 6 }); // compact peek
    expect(screen.getByText(/Live now/)).toBeInTheDocument();
    // No "See all" link — there is no dedicated /live page; cards link to the watch page.
    expect(screen.queryByRole('link', { name: 'See all' })).toBeNull();
    expect(screen.getByRole('link', { name: /Reds versus Blues/i })).toHaveAttribute('href', '/live/T1');
  });

  it('a query failure (e.g. listLiveFeed not deployed) is contained — host stays up', () => {
    // Mirrors the DashboardLanding wrapping: a render throw from useQuery must be
    // swallowed by the silent ErrorBoundary fallback, never bubbling to the host.
    mocks.throwErr = true;
    const { container } = render(
      <MemoryRouter>
        <div data-testid="host">
          <ErrorBoundary fallback={null} captureToSentry={false}>
            <LiveNowStrip />
          </ErrorBoundary>
        </div>
      </MemoryRouter>,
    );
    // Host survived; the strip rendered nothing.
    expect(screen.getByTestId('host')).toBeInTheDocument();
    expect(container.querySelector('.live-strip')).toBeNull();
  });
});
