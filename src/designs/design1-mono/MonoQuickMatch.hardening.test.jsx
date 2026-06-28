import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Tests for the #106 quick-match hardening items. Mirrors the seed-into-scoring
// harness in MonoQuickMatch.broadcast.test.jsx: a mocked storage.loadData returns
// the seeded draft for the active sport key (no timestamp -> not stale), so the
// restore effect lands straight in the 'scoring' phase.

const nav = vi.hoisted(() => vi.fn());
const ctx = vi.hoisted(() => ({ sport: 'volleyball', draft: null, queryResult: undefined }));
const storageMock = vi.hoisted(() => ({ clearData: vi.fn() }));
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
  useAuth: () => ({ isAuthenticated: true, cloudAuthAvailable: true }),
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
  saveQuickMatch: vi.fn(() => true),
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
  ctx.queryResult = undefined;
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

    // Confirming inside the dialog performs the wipe + navigates home.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    expect(storageMock.clearData).toHaveBeenCalled();
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

  it('announces the last scoring action in an aria-live region inside the scorer', () => {
    seedVolleyball({ lastAction: 'Reds +1' });
    render(<MonoQuickMatch />);

    const lastActionText = screen.getByText(/Last: Reds \+1/);
    expect(lastActionText).toBeInTheDocument();
    // The strip lives in a polite live region so each action is announced.
    expect(lastActionText.closest('[aria-live="polite"]')).not.toBeNull();
  });
});
