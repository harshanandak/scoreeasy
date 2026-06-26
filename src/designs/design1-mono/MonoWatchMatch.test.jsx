import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MonoWatchMatch from './MonoWatchMatch';
import { api } from '../../../convex/_generated/api';

// Mock the Convex client hooks so useQuery / usePaginatedQuery return fixtures.
// The component switches on the function reference, so the api mock below hands
// out distinct string refs per query.
const mocks = vi.hoisted(() => ({
  snapshot: undefined,
  meta: undefined,
  paginated: { results: [], status: 'Exhausted', loadMore: vi.fn(), isLoading: false },
}));

vi.mock('convex/react', () => ({
  useQuery: (ref) => {
    if (ref === 'live:getByToken') return mocks.snapshot;
    if (ref === 'live:getMeta') return mocks.meta;
    return undefined;
  },
  usePaginatedQuery: () => mocks.paginated,
  useMutation: () => vi.fn().mockResolvedValue({ ok: true }), // ReportMatch report
}));

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    live: {
      getByToken: 'live:getByToken',
      getMeta: 'live:getMeta',
      listEvents: 'live:listEvents',
      report: 'live:report',
    },
  },
}));

// A volleyball snapshot — A leads 18-21 in set 2, A serving, still live.
const VOLLEY_SNAPSHOT = {
  sport: 'volleyball',
  status: 'live',
  scorecardKind: 'volleyball',
  pointsA: 18,
  pointsB: 21,
  setsA: 1,
  setsB: 0,
  setScores: [{ a: 25, b: 20 }],
  servingTeam: 'A',
  currentUnit: 2,
  periodLabel: 'SET 2',
  lastSeq: 4,
  startedAt: 1000,
  lastEventAt: 1000,
  isYouthMatch: false,
};

const META = {
  sport: 'volleyball',
  teamA: { name: 'Reds' },
  teamB: { name: 'Blues' },
  players: [],
  isYouthMatch: false,
};

// A few public event rows in ascending seq order (as listEvents returns).
const EVENTS = [
  { seq: 1, type: 'point', team: 'A', value: 1, runningA: 1, runningB: 0, setsA: 0, setsB: 0, at: 1000 },
  { seq: 2, type: 'point', team: 'B', value: 1, runningA: 1, runningB: 1, setsA: 0, setsB: 0, at: 2000 },
  { seq: 3, type: 'point', team: 'B', value: 1, runningA: 1, runningB: 2, setsA: 0, setsB: 0, at: 3000 },
];

function renderAt(token = 'ABC123') {
  return render(
    <MemoryRouter initialEntries={[`/live/${token}`]}>
      <Routes>
        <Route path="/live/:token" element={<MonoWatchMatch />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.snapshot = undefined;
  mocks.meta = undefined;
  mocks.paginated = { results: [], status: 'Exhausted', loadMore: vi.fn(), isLoading: false };
  vi.spyOn(Date, 'now').mockReturnValue(1000);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MonoWatchMatch', () => {
  it('renders the pinned scorebug from a volleyball snapshot + names', () => {
    mocks.snapshot = VOLLEY_SNAPSHOT;
    mocks.meta = META;
    renderAt();

    const bug = screen.getByRole('banner', { name: 'Match scorebug' });
    expect(within(bug).getByText('Reds')).toBeInTheDocument();
    expect(within(bug).getByText('Blues')).toBeInTheDocument();
    expect(within(bug).getByText('18')).toBeInTheDocument();
    expect(within(bug).getByText('21')).toBeInTheDocument();
    // Live eyebrow present; not paused/final.
    expect(within(bug).getByText('LIVE')).toBeInTheDocument();
    expect(within(bug).queryByText('PAUSED')).not.toBeInTheDocument();
    expect(within(bug).queryByText('FINAL')).not.toBeInTheDocument();
  });

  it('renders the feed from the paginated events (newest first, score-after)', () => {
    mocks.snapshot = VOLLEY_SNAPSHOT;
    mocks.meta = META;
    mocks.paginated = { results: EVENTS, status: 'Exhausted', loadMore: vi.fn(), isLoading: false };
    renderAt();

    const feed = screen.getByRole('region', { name: 'Commentary feed' });
    const items = within(feed).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // Newest event (seq 3) is first; its score-after is 1-2.
    expect(within(items[0]).getByText('1–2')).toBeInTheDocument();
    // Team names appear in the descriptions.
    expect(within(feed).getAllByText(/Reds|Blues/).length).toBeGreaterThan(0);
  });

  it('shows the not-available screen when getByToken returns null', () => {
    mocks.snapshot = null; // resolved not-found / private / removed
    mocks.meta = null;
    renderAt();

    expect(screen.getByText(/isn't available/i)).toBeInTheDocument();
    expect(screen.queryByRole('banner', { name: 'Match scorebug' })).not.toBeInTheDocument();
  });

  it('shows the PAUSED badge when the last event is stale (> 90s)', () => {
    Date.now.mockReturnValue(VOLLEY_SNAPSHOT.lastEventAt + 91000);
    mocks.snapshot = VOLLEY_SNAPSHOT;
    mocks.meta = META;
    renderAt();

    const bug = screen.getByRole('banner', { name: 'Match scorebug' });
    expect(within(bug).getByText('PAUSED')).toBeInTheDocument();
  });

  it('renders a loading skeleton while the snapshot is undefined', () => {
    mocks.snapshot = undefined;
    renderAt();
    expect(screen.getByLabelText('Loading match')).toBeInTheDocument();
  });
});
