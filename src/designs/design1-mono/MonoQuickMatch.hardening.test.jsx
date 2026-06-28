import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Tests for the #106 quick-match hardening items. Mirrors the seed-into-scoring
// harness in MonoQuickMatch.broadcast.test.jsx: a mocked storage.loadData returns
// the seeded draft for the active sport key (no timestamp -> not stale), so the
// restore effect lands straight in the 'scoring' phase.

const nav = vi.hoisted(() => vi.fn());
const ctx = vi.hoisted(() => ({ sport: 'volleyball', draft: null, queryResult: undefined, cloudAuthAvailable: true }));
const storageMock = vi.hoisted(() => ({ clearData: vi.fn(), saveQuickMatch: vi.fn(() => true) }));
const live = vi.hoisted(() => ({
  point: vi.fn(() => Promise.resolve()),
  undo: vi.fn(() => Promise.resolve()),
  finalize: vi.fn(() => Promise.resolve()),
  goLive: vi.fn(() => Promise.resolve({ token: 'TOK', matchId: 'mid' })),
  setVisibility: vi.fn(() => Promise.resolve()),
  reset: vi.fn(),
}));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => ctx.queryResult }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => nav,
  useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, cloudAuthAvailable: ctx.cloudAuthAvailable }),
}));
vi.mock('../../hooks/useLiveBroadcast', () => ({
  useLiveBroadcast: () => ({ ...live, isLive: false, token: null, error: null }),
}));
vi.mock('../../lib/live/liveSession', () => ({
  getConsent: () => 'accepted',
  setConsent: vi.fn(),
  loadSession: () => null,
  saveSession: vi.fn(),
}));
vi.mock('../../utils/storage', () => ({
  loadData: vi.fn((key, def) => (key === `se_quickmatch_draft_${ctx.sport}` ? ctx.draft : def)),
  saveData: vi.fn(() => true),
  clearData: storageMock.clearData,
  saveQuickMatch: storageMock.saveQuickMatch,
  isStaleQuickMatchDraft: () => false,
}));

const { default: MonoQuickMatch } = await import('./MonoQuickMatch.jsx');

const base = { phase: 'scoring', team1Name: 'Reds', team2Name: 'Blues', lastAction: '' };

function seedVolleyball(extra = {}) {
  ctx.sport = 'volleyball';
  ctx.draft = {
    ...base,
    sport: 'volleyball',
    quickMatchId: 3003,
    format: { type: 'best-of', sets: 3, target: 25, winBy: 2 },
    sets: [{ score1: 0, score2: 0, completed: false }],
    currentSet: 0,
    ...extra,
  };
}

beforeEach(() => {
  nav.mockClear();
  storageMock.clearData.mockClear();
  storageMock.saveQuickMatch.mockClear();
  live.point.mockClear();
  live.finalize.mockClear();
  live.reset.mockClear();
  ctx.queryResult = undefined;
  ctx.cloudAuthAvailable = true;
});

describe('MonoQuickMatch hardening (#106)', () => {
  it('gates Discard behind a confirm dialog and wipes only on confirm', () => {
    seedVolleyball();
    render(<MonoQuickMatch />);

    // First tap only opens the dialog — nothing is wiped yet.
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    const dialog = screen.getByRole('dialog', { name: /Discard match/i });
    expect(dialog).toBeInTheDocument();
    expect(storageMock.clearData).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();

    // Confirming inside the dialog performs the wipe, tears down the live session,
    // and navigates home.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    expect(storageMock.clearData).toHaveBeenCalled();
    expect(live.reset).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/app');
  });

  it('keeps the match when the Discard dialog is dismissed', () => {
    seedVolleyball();
    render(<MonoQuickMatch />);

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    const dialog = screen.getByRole('dialog', { name: /Discard match/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep scoring' }));

    expect(screen.queryByRole('dialog', { name: /Discard match/i })).not.toBeInTheDocument();
    expect(storageMock.clearData).not.toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
  });

  it('derives the displayed win-by margin from the sport config', () => {
    seedVolleyball({
      format: { type: 'best-of', sets: 3, target: 25, customization: { winBy: 3 } },
    });
    render(<MonoQuickMatch />);

    expect(screen.getByText(/win by 3/)).toBeInTheDocument();
    expect(screen.queryByText(/win by 2/)).not.toBeInTheDocument();
  });

  it('locks scoring and prompts to end when a timed goals match runs out', async () => {
    // Seed a timed match restored exactly at its limit (timerElapsed === timeLimit,
    // no updatedAt so elapsed isn't advanced) → isTimeUp is true on mount.
    ctx.sport = 'football';
    ctx.draft = {
      ...base,
      sport: 'football',
      quickMatchId: 4004,
      gScore1: 1,
      gScore2: 0,
      gScoreHistory: [{ team: 1, value: 1 }],
      format: { mode: 'timed', timeLimit: 60 },
      timerElapsed: 60,
    };
    render(<MonoQuickMatch />);

    // The end prompt appears automatically once time is up.
    expect(await screen.findByRole('dialog', { name: /End match/i })).toBeInTheDocument();
    // Scoring is locked: the half control is disabled.
    expect(screen.getByRole('button', { name: 'Add 1 to Reds' })).toBeDisabled();
  });

  it('lets a no-draw timed match score the deciding point at full time (no 0-0 dead end)', () => {
    // basketball: drawAllowed=false. Tied 0-0 at time-up would otherwise be a dead
    // end (can't score, no undo history, can't end on a tie) — the deciding-score
    // lever must stay live.
    ctx.sport = 'basketball';
    ctx.draft = {
      ...base,
      sport: 'basketball',
      quickMatchId: 7007,
      gScore1: 0,
      gScore2: 0,
      gScoreHistory: [],
      format: { mode: 'timed', timeLimit: 60 },
      timerElapsed: 60,
    };
    render(<MonoQuickMatch />);

    // The deciding-score control is still enabled at 0-0 time-up.
    const plusOne = screen.getAllByRole('button', { name: '+1' })[0];
    expect(plusOne).toBeEnabled();
    fireEvent.click(plusOne);

    // Now untied (1-0): the match becomes endable and the end prompt appears.
    expect(screen.getByRole('dialog', { name: /End match/i })).toBeInTheDocument();
  });

  it('announces the last scoring action in an aria-live region inside the scorer', () => {
    seedVolleyball({ lastAction: 'Reds +1' });
    render(<MonoQuickMatch />);

    const lastActionText = screen.getByText(/Last: Reds \+1/);
    expect(lastActionText).toBeInTheDocument();
    // The strip lives in a polite live region so each action is announced.
    expect(lastActionText.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('reserves a fixed live-broadcast slot when cloud auth is available, and omits it offline', () => {
    seedVolleyball();
    const { container, unmount } = render(<MonoQuickMatch />);
    // The slot holds space even before the bar hydrates, so the score won't jump.
    expect(container.querySelector('.mono-live-slot')).not.toBeNull();
    unmount();

    // Offline build (no cloud auth): no permanent empty slot.
    ctx.cloudAuthAvailable = false;
    seedVolleyball();
    const { container: offlineContainer } = render(<MonoQuickMatch />);
    expect(offlineContainer.querySelector('.mono-live-slot')).toBeNull();
  });

  // Cricket innings transitions moved from inside the setScores updaters to a single
  // post-commit effect. StrictMode double-invokes mount effects + updaters, which is
  // exactly what would surface a double innings-flip / double-finalize regression.
  it('flips the cricket innings once at innings end without finalizing (StrictMode)', () => {
    ctx.sport = 'cricket';
    ctx.draft = {
      ...base,
      sport: 'cricket',
      quickMatchId: 5005,
      // players: 2 -> maxWickets 1, so a single OUT ends the innings.
      format: { overs: 5, players: 2 },
      scores: {
        team1: { runs: 7, balls: 3, wickets: 0, allOut: false },
        team2: { runs: 0, balls: 0, wickets: 0, allOut: false },
      },
      innings: 1,
      battingTeam: 1,
      cricketHistory: [],
    };
    render(
      <StrictMode>
        <MonoQuickMatch />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OUT' }));

    // Innings 1 ending shows the break with the chase target; it never finalizes.
    const breakDialog = screen.getByRole('dialog', { name: 'Innings break' });
    expect(breakDialog).toBeInTheDocument();
    expect(breakDialog).toHaveTextContent('need 8 to win'); // team1's 7 + 1
    expect(live.finalize).not.toHaveBeenCalled();
    expect(storageMock.saveQuickMatch).not.toHaveBeenCalled();
  });

  it('finalizes the cricket match exactly once when the second innings ends (StrictMode)', () => {
    ctx.sport = 'cricket';
    ctx.draft = {
      ...base,
      sport: 'cricket',
      quickMatchId: 6006,
      format: { overs: 5, players: 2 }, // maxWickets 1
      scores: {
        team1: { runs: 5, balls: 30, wickets: 0, allOut: false }, // innings 1 total
        team2: { runs: 5, balls: 12, wickets: 0, allOut: false },  // chasing
      },
      innings: 2,
      battingTeam: 2,
      cricketHistory: [],
    };
    render(
      <StrictMode>
        <MonoQuickMatch />
      </StrictMode>,
    );

    // OUT all-out ends innings 2 -> finish, persisted exactly once (no double-fire).
    fireEvent.click(screen.getByRole('button', { name: 'OUT' }));

    expect(storageMock.saveQuickMatch).toHaveBeenCalledTimes(1);
    expect(live.finalize).toHaveBeenCalledTimes(1);
  });
});
