import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Confirm-on-discard guard (hotfix eb98882b): a single stray tap on the live
// scorer's "Discard" control must NOT throw away an in-progress quick match with
// no confirmation. There is no render harness for this scorer, so we drive the
// REAL component seeded straight into the scoring phase and click Discard. The
// storage + navigate mocks are captured so we can assert the draft is only
// cleared once the user explicitly confirms. An empty match is unaffected.

const nav = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({
  clearData: vi.fn(),
  saveData: vi.fn(() => true),
  saveQuickMatch: vi.fn(() => true),
}));

// Mutable route+draft so one mocked module set can serve every scenario. loadData
// returns the seeded draft for the active sport's key; no timestamp field, so
// isStaleQuickMatchDraft() stays false and the restore effect lands in 'scoring'.
const ctx = vi.hoisted(() => ({ sport: 'football', draft: null }));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => nav,
  useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, cloudAuthAvailable: true }),
}));
vi.mock('../../hooks/useLiveBroadcast', () => ({
  useLiveBroadcast: () => ({
    point: vi.fn(() => Promise.resolve()),
    undo: vi.fn(() => Promise.resolve()),
    finalize: vi.fn(() => Promise.resolve()),
    goLive: vi.fn(() => Promise.resolve({ token: 'TOK', matchId: 'mid' })),
    setVisibility: vi.fn(() => Promise.resolve()),
    reset: vi.fn(),
    isLive: false,
    token: null,
    error: null,
  }),
}));
vi.mock('../../lib/live/liveSession', () => ({
  getConsent: () => 'accepted',
  setConsent: vi.fn(),
  loadSession: () => null,
  saveSession: vi.fn(),
}));
vi.mock('../../utils/storage', () => ({
  loadData: vi.fn((key, def) => (key === `se_quickmatch_draft_${ctx.sport}` ? ctx.draft : def)),
  saveData: store.saveData,
  clearData: store.clearData,
  saveQuickMatch: store.saveQuickMatch,
  isStaleQuickMatchDraft: () => false,
}));

const { default: MonoQuickMatch } = await import('./MonoQuickMatch.jsx');

const base = { phase: 'scoring', team1Name: 'Reds', team2Name: 'Blues', lastAction: '' };
const FOOTBALL_KEY = 'se_quickmatch_draft_football';

function seedGoals({ withProgress }) {
  ctx.sport = 'football';
  ctx.draft = {
    ...base,
    sport: 'football',
    gScore1: withProgress ? 1 : 0,
    gScore2: 0,
    gScoreHistory: withProgress ? [{ team: 1 }] : [],
    quickMatchId: 1001,
  };
}

beforeEach(() => {
  nav.mockClear();
  store.clearData.mockClear();
  store.saveData.mockClear();
  store.saveQuickMatch.mockClear();
});

describe('MonoQuickMatch confirm-on-discard guard', () => {
  it('in-progress match: a stray Discard tap asks to confirm and does NOT clear the draft yet', async () => {
    seedGoals({ withProgress: true });
    render(<MonoQuickMatch />);

    const discardBtn = await screen.findByRole('button', { name: 'Discard' });
    fireEvent.click(discardBtn);

    // Guard: an explicit confirm dialog must appear before anything is thrown away.
    expect(screen.queryByText('Discard match?')).not.toBeNull();
    // The in-progress draft must still be intact — no discard, no navigation.
    expect(store.clearData).not.toHaveBeenCalledWith(FOOTBALL_KEY);
    expect(nav).not.toHaveBeenCalledWith('/app');
  });

  it('in-progress match: confirming the dialog clears the draft and leaves the scorer', async () => {
    seedGoals({ withProgress: true });
    render(<MonoQuickMatch />);

    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard match' }));

    expect(store.clearData).toHaveBeenCalledWith(FOOTBALL_KEY);
    expect(nav).toHaveBeenCalledWith('/app');
  });

  it('empty match: Discard is unaffected — it drops the match immediately with no confirm', async () => {
    seedGoals({ withProgress: false });
    render(<MonoQuickMatch />);

    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));

    expect(screen.queryByText('Discard match?')).toBeNull();
    expect(store.clearData).toHaveBeenCalledWith(FOOTBALL_KEY);
    expect(nav).toHaveBeenCalledWith('/app');
  });
});
