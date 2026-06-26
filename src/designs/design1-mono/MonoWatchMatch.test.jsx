import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

// Public event rows in DESCENDING seq order — listEvents is now .order("desc")
// so the first page is the newest plays (the live tail). FeedPanel renders them
// as-returned (no client reversal).
const EVENTS = [
  { seq: 3, type: 'point', team: 'B', value: 1, runningA: 1, runningB: 2, setsA: 0, setsB: 0, at: 3000 },
  { seq: 2, type: 'point', team: 'B', value: 1, runningA: 1, runningB: 1, setsA: 0, setsB: 0, at: 2000 },
  { seq: 1, type: 'point', team: 'A', value: 1, runningA: 1, runningB: 0, setsA: 0, setsB: 0, at: 1000 },
];

// A goals snapshot — A leads 3-2. setScores empty (flat-points sport).
const GOALS_SNAPSHOT = {
  sport: 'football',
  status: 'live',
  scorecardKind: 'goals',
  pointsA: 3,
  pointsB: 2,
  setsA: 0,
  setsB: 0,
  setScores: [],
  servingTeam: null,
  currentUnit: 1,
  periodLabel: undefined,
  lastSeq: 5,
  startedAt: 1000,
  lastEventAt: 1000,
  isYouthMatch: false,
};

// A cricket snapshot — 1st innings, India 150/3, opponent not yet batted (0).
const CRICKET_SNAPSHOT = {
  sport: 'cricket',
  status: 'live',
  scorecardKind: 'cricket',
  pointsA: 150,
  pointsB: 0,
  setsA: 0,
  setsB: 0,
  setScores: [],
  servingTeam: null,
  currentUnit: 1,
  periodLabel: 'India 150/3 (25.2 ov)',
  lastSeq: 30,
  startedAt: 1000,
  lastEventAt: 1000,
  isYouthMatch: false,
};

function renderAt(token = 'ABC123', search = '') {
  return render(
    <MemoryRouter initialEntries={[`/live/${token}${search}`]}>
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

  it('scorecard (goals) renders the total from the snapshot, no winner mid-match', () => {
    // Snapshot says 3-2 LIVE; the loaded event page is EMPTY. A correct scorecard
    // shows the snapshot totals (re-deriving from the partial page would show 0-0)
    // and must NOT declare a winner while the match is in progress.
    mocks.snapshot = GOALS_SNAPSHOT; // status 'live'
    mocks.meta = { ...META, sport: 'football' };
    mocks.paginated = { results: [], status: 'Exhausted', loadMore: vi.fn(), isLoading: false };
    renderAt('ABC123', '?kiosk=1'); // kiosk renders the scorecard directly

    const card = screen.getByRole('region', { name: 'Line score' });
    expect(within(card).getByText('3')).toBeInTheDocument();
    expect(within(card).getByText('2')).toBeInTheDocument();
    // LIVE → no winner highlight, total column labelled "Total" not "Final".
    expect(card.querySelector('[data-winner]')).toBeNull();
    expect(within(card).getByText('Total')).toBeInTheDocument();
    expect(within(card).queryByText('Final')).not.toBeInTheDocument();
  });

  it('scorecard (goals) DOES highlight the winner once the match is final', () => {
    mocks.snapshot = { ...GOALS_SNAPSHOT, status: 'final' };
    mocks.meta = { ...META, sport: 'football' };
    mocks.paginated = { results: [], status: 'Exhausted', loadMore: vi.fn(), isLoading: false };
    renderAt('ABC123', '?kiosk=1');

    const card = screen.getByRole('region', { name: 'Line score' });
    expect(card.querySelector('[data-winner]')).not.toBeNull(); // A (3) wins
    expect(within(card).getByText('Final')).toBeInTheDocument();
  });

  it('scorecard (cricket) shows per-side runs + period line, never a misleading "leads by"', () => {
    // Innings 1: 150-0. "India leads by 150" / a "150–0 margin" would be wrong.
    mocks.snapshot = CRICKET_SNAPSHOT;
    mocks.meta = { ...META, sport: 'cricket' };
    mocks.paginated = { results: [], status: 'Exhausted', loadMore: vi.fn(), isLoading: false };
    renderAt('ABC123', '?kiosk=1');

    const card = screen.getByRole('region', { name: 'Match summary' });
    expect(within(card).getByText('150')).toBeInTheDocument();
    expect(within(card).getByText('India 150/3 (25.2 ov)')).toBeInTheDocument(); // authoritative line
    expect(within(card).queryByText(/leads by/i)).not.toBeInTheDocument();
  });

  it('uses stable keys even when both teams share the same name (no dup-key warning)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.snapshot = CRICKET_SNAPSHOT;
    mocks.meta = { ...META, sport: 'cricket', teamA: { name: 'White' }, teamB: { name: 'White' } };
    mocks.paginated = { results: [], status: 'Exhausted', loadMore: vi.fn(), isLoading: false };
    renderAt('ABC123', '?kiosk=1'); // SnapshotSummary renders two same-named rows

    const dupKey = errSpy.mock.calls.some((c) => /same key/i.test(String(c[0])));
    expect(dupKey).toBe(false);
  });

  it('stats tab is driven by the snapshot (points/sets/serving), not the event page', () => {
    mocks.snapshot = VOLLEY_SNAPSHOT; // 18-21, 1-0 sets, A serving, SET 2
    mocks.meta = META;
    mocks.paginated = { results: [], status: 'Exhausted', loadMore: vi.fn(), isLoading: false };
    renderAt();

    fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
    const stats = screen.getByRole('region', { name: 'Match stats' });
    expect(within(stats).getByText('18')).toBeInTheDocument();
    expect(within(stats).getByText('21')).toBeInTheDocument();
    expect(within(stats).getByText('1–0')).toBeInTheDocument();
    expect(within(stats).getByText('Reds')).toBeInTheDocument(); // serving team
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
