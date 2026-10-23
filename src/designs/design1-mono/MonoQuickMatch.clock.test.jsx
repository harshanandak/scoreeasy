import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Keep the real scorer, timer, board and persistence payload. Stub only external services.
const ctx = vi.hoisted(() => ({ sport: 'volleyball', draft: null }));
const storage = vi.hoisted(() => ({ saveData: vi.fn(() => true), saveQuickMatch: vi.fn(() => true) }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({
  useLiveBroadcast: () => ({ isLive: false, reset: vi.fn(), finalize: vi.fn(), point: vi.fn(), undo: vi.fn() }),
}));
vi.mock('../../lib/live/liveSession', () => ({ getConsent: () => 'unknown', loadSession: () => null, saveSession: vi.fn() }));
vi.mock('../../utils/storage', () => ({
  loadData: (key, fallback) => key === `se_quickmatch_draft_${ctx.sport}` ? ctx.draft : fallback,
  loadQuickMatch: () => null, saveData: storage.saveData, saveQuickMatch: storage.saveQuickMatch,
  clearData: vi.fn(), isStaleQuickMatchDraft: () => false,
}));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');
const scorer = () => <StrictMode><MonoQuickMatch /></StrictMode>;
const tick = (seconds) => act(() => vi.advanceTimersByTime(seconds * 1000));
const setsClock = () => document.querySelector('.tsb-meta');
const draftCalls = () => storage.saveData.mock.calls.filter(([key]) => key.startsWith('se_quickmatch_draft_'));

function seed(sport, extra = {}) {
  ctx.sport = sport;
  ctx.draft = {
    phase: 'scoring', sport, team1Name: 'Reds', team2Name: 'Blues', quickMatchId: 3003,
    format: { type: 'best-of', sets: 3, target: 25, winBy: 2 },
    sets: [{ score1: 0, score2: 0, completed: false }], currentSet: 0,
    timerElapsed: 0, startedAt: '2026-10-23T11:42:00Z', updatedAt: '2026-10-23T11:42:00Z',
    ...extra,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  vi.clearAllMocks();
  ctx.sport = 'volleyball';
  ctx.draft = null;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('sets clocks in the app StrictMode lifecycle', () => {
  it.each(['volleyball', 'badminton', 'tabletennis'])('ticks a fresh %s match without per-second draft saves', (sport) => {
    ctx.sport = sport;
    render(scorer());
    fireEvent.click(screen.getByRole('button', { name: `Start ${sport === 'tabletennis' ? 'table tennis' : sport}` }));
    expect(setsClock()).toHaveTextContent('0:00');
    const saves = draftCalls().length;
    tick(3);
    expect(setsClock()).toHaveTextContent('0:03');
    expect(draftCalls()).toHaveLength(saves);
  });

  it.each(['volleyball', 'badminton', 'tabletennis'])('restores %s after 18 minutes, keeps ticking and snapshots only on scoring', (sport) => {
    seed(sport);
    render(scorer());
    expect(setsClock()).toHaveTextContent('18:00');
    const saves = draftCalls().length;
    tick(2);
    expect(setsClock()).toHaveTextContent('18:02');
    expect(draftCalls()).toHaveLength(saves);
    fireEvent.click(screen.getByRole('button', { name: 'Add point for Reds' }));
    expect(draftCalls().at(-1)[1]).toMatchObject({ timerElapsed: 1082, startedAt: ctx.draft.startedAt });
  });

  it('keeps elapsed time through Finish-cancel and Undo, then stops at the saved result', async () => {
    seed('volleyball');
    render(scorer());
    tick(2);
    expect(setsClock()).toHaveTextContent('18:02');
    fireEvent.click(screen.getByRole('button', { name: 'Add point for Reds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(setsClock()).toHaveTextContent('18:02');
    expect(screen.getByRole('button', { name: 'Add point for Reds' })).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    // Finish confirmation has always left a live match running until it is ended.
    tick(3);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'Keep scoring' }));
    tick(1);
    expect(setsClock()).toHaveTextContent('18:06');
    fireEvent.click(screen.getByRole('button', { name: 'Add point for Reds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'End match' }));
    });
    expect(screen.getByRole('region', { name: 'Match result' })).toBeInTheDocument();
    expect(storage.saveQuickMatch.mock.calls.at(-1)[0]).toMatchObject({ elapsedSeconds: 1086 });
    tick(10);
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(setsClock()).toHaveTextContent('0:00');
    tick(1);
    expect(setsClock()).toHaveTextContent('0:01');
  });

  it('resumes a different sport draft while the same component stays in scoring', () => {
    seed('volleyball');
    const mounted = render(scorer());
    seed('badminton', { timerElapsed: 60, updatedAt: '2026-10-23T12:00:00Z' });
    mounted.rerender(scorer());
    expect(setsClock()).toHaveTextContent('1:00');
    tick(2);
    expect(setsClock()).toHaveTextContent('1:02');
  });

  it('supports an older draft with only timerElapsed', () => {
    seed('volleyball', { timerElapsed: 42, startedAt: undefined, updatedAt: undefined });
    render(scorer());
    expect(setsClock()).toHaveTextContent('0:42');
    tick(1);
    expect(setsClock()).toHaveTextContent('0:43');
  });

  it('reloads the saved score and undo history with the elapsed time since the last scoring save', () => {
    seed('volleyball');
    const mounted = render(scorer());
    tick(2);
    fireEvent.click(screen.getByRole('button', { name: 'Add point for Reds' }));
    ctx.draft = draftCalls().at(-1)[1];
    mounted.unmount();
    tick(120);
    render(scorer());
    expect(setsClock()).toHaveTextContent('20:02');
    expect(screen.getByRole('button', { name: 'Add point for Reds' })).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(screen.getByRole('button', { name: 'Add point for Reds' })).toHaveTextContent('0');
    tick(1);
    expect(setsClock()).toHaveTextContent('20:03');
  });
});

describe('goals countdown using the same timer', () => {
  it('keeps an expired countdown paused when restoring another expired sport in the same component', () => {
    const expired = { format: { mode: 'timed', timeLimit: 1080 }, gScore1: 1, gScore2: 0 };
    seed('football', expired);
    const mounted = render(scorer());
    tick(10);
    expect(vi.getTimerCount()).toBe(0);
    seed('kabaddi', expired);
    mounted.rerender(scorer());
    tick(10);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    expect(vi.getTimerCount()).toBe(0);
  });

  it('counts down in StrictMode, preserves time through Finish-cancel and Undo, then pauses at zero', () => {
    seed('football', {
      format: { mode: 'timed', timeLimit: 1085 }, gScore1: 1, gScore2: 0, gScoreHistory: [],
    });
    render(scorer());
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:05');
    tick(1);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:04');
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Reds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'Keep scoring' }));
    tick(4);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    expect(screen.getByRole('dialog', { name: 'End match?' })).toBeInTheDocument();
    const saves = draftCalls().length;
    tick(10);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'Keep scoring' }));
    expect(screen.getByRole('button', { name: 'Add 1 to Reds' })).toBeDisabled();
    expect(draftCalls()).toHaveLength(saves);
  });
});
