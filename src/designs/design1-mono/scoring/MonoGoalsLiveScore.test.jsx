import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonoGoalsLiveScore from './MonoGoalsLiveScore';
import { ScoringCompletionContext } from './scoringCompletionContext';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  complete: vi.fn(),
  save: vi.fn(() => true),
  finalize: vi.fn(),
  timer: { elapsed: 0, start: vi.fn(), pause: vi.fn(), reset: vi.fn() },
  tournaments: [],
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
  useParams: () => ({ sport: 'football', id: '100', matchId: 'm1' }),
}));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useTimer', () => ({ useTimer: () => h.timer }));
vi.mock('../../../utils/storage', () => ({
  loadSportTournaments: () => h.tournaments,
  saveSportTournament: (...args) => h.save(...args),
}));
vi.mock('../../../hooks/useLiveBroadcast', () => ({
  useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: h.finalize }),
}));
vi.mock('../../../lib/live/liveSession', () => ({ getConsent: () => 'accepted' }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.save.mockReturnValue(true);
  h.timer.elapsed = 0;
  h.tournaments = [{
    id: 100,
    format: {},
    teams: [{ id: 't1', name: 'Red' }, { id: 't2', name: 'Blue' }],
    matches: [{ id: 'm1', team1Id: 't1', team2Id: 't2', status: 'pending' }],
    knockoutMatches: [],
  }];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderScorer(withProvider) {
  return render(
    <ScoringCompletionContext.Provider value={withProvider ? h.complete : null}>
      <MonoGoalsLiveScore />
    </ScoringCompletionContext.Provider>,
  );
}

function finish(exit, view) {
  if (exit === 'manual') {
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  } else if (exit === 'target score') {
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 point to Red' }));
  } else {
    h.timer.elapsed = 120;
    view.rerender(
      <ScoringCompletionContext.Provider value={h.complete}>
        <MonoGoalsLiveScore />
      </ScoringCompletionContext.Provider>,
    );
  }
  act(() => { vi.advanceTimersByTime(350); });
}

describe('goals completion back-stack (RA-1)', () => {
  it.each(['manual', 'target score', 'time expiry'])('%s completion uses the app seam after saving', (exit) => {
    h.tournaments[0].format = exit === 'target score'
      ? { mode: 'points', target: 1 }
      : exit === 'time expiry' ? { mode: 'timed', timeLimit: 60 } : {};
    const view = renderScorer(true);
    finish(exit, view);

    expect(h.save).toHaveBeenLastCalledWith('se_football', expect.objectContaining({
      matches: [expect.objectContaining({ status: 'completed', draftState: undefined })],
    }));
    expect(h.finalize).toHaveBeenCalledOnce();
    expect(h.complete).toHaveBeenCalledExactlyOnceWith('/football/tournament/100');
    expect(h.save.mock.invocationCallOrder.at(-1)).toBeLessThan(h.complete.mock.invocationCallOrder[0]);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('replaces the scorer when rendered without an app completion provider', () => {
    const view = renderScorer(false);
    finish('manual', view);
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith('/football/tournament/100', { replace: true });
  });

  it.each(['manual', 'target score', 'time expiry'])('%s save failure keeps the scorer open', (exit) => {
    h.tournaments[0].format = exit === 'target score'
      ? { mode: 'points', target: 1 }
      : exit === 'time expiry' ? { mode: 'timed', timeLimit: 60 } : {};
    const view = renderScorer(true);
    h.save.mockReturnValue(false);
    finish(exit, view);
    expect(screen.getByText(/Save failed/)).toBeInTheDocument();
    expect(h.complete).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.finalize).not.toHaveBeenCalled();
  });
});
