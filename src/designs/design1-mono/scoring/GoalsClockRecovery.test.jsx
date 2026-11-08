import { buildTournamentConvexPayload } from '../../../utils/tournamentSync';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriodMatch } from '../../../utils/goalsPeriods';

const h = vi.hoisted(() => {
  delete globalThis.ontouchstart;
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  return { tournaments: [], save: vi.fn(() => true), point: vi.fn(), finalize: vi.fn(), navigate: vi.fn() };
});
vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate, useParams: () => ({ sport: 'football', id: '100', matchId: 'm1' }) }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../utils/storage', () => ({ loadSportTournaments: () => h.tournaments, saveSportTournament: (...args) => h.save(...args) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: h.point, finalize: h.finalize }) }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));
import MonoGoalsLiveScore from './MonoGoalsLiveScore';

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); h.save.mockReturnValue(true);
  const periods = { sport: 'football', durations: [60, 60] };
  h.tournaments = [{ id: 100, teams: [{ id: 'a', name: 'Reds' }, { id: 'b', name: 'Blues' }],
    format: { mode: 'timed', timeLimit: 120, periods }, knockoutMatches: [],
    matches: [{ id: 'm1', team1Id: 'a', team2Id: 'b', draftState: { score1: 0, score2: 0, history: [], periodState: createPeriodMatch(periods, Date.now()) } }] }];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = seconds => act(() => vi.advanceTimersByTime(seconds * 1000));
const savedMatch = () => h.save.mock.calls.at(-1)[1].matches[0];
const press = key => fireEvent.keyDown(globalThis, { key });

describe('review regression: tournament clock recovery', () => {
  it('keyboard scoring after Pause preserves the paused clock and its Undo frame', () => {
    render(<MonoGoalsLiveScore />); advance(10);
    fireEvent.click(screen.getByRole('button', { name: 'Pause clock' }));
    press('q');
    expect(savedMatch().draftState.periodState).toMatchObject({ startedAt: null, elapsed: 10 });
    expect(savedMatch().draftState.periodState.history).toHaveLength(2);
    advance(20); press('u');
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:50');
    expect(savedMatch().draftState.score1).toBe(0);
    expect(screen.getByRole('button', { name: 'Resume clock' })).toBeInTheDocument();
  });
  it('keyboard score and delayed Undo after Resume keep playing time', () => {
    render(<MonoGoalsLiveScore />); advance(10);
    fireEvent.click(screen.getByRole('button', { name: 'Pause clock' })); advance(10);
    fireEvent.click(screen.getByRole('button', { name: 'Resume clock' })); advance(10);
    press('q'); advance(10); press('u');
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:30');
    expect(savedMatch().draftState.score1).toBe(0);
  });
  it('keyboard score and Undo use the advanced period instead of restoring the previous one', () => {
    render(<MonoGoalsLiveScore />); advance(60);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm period end' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start next period' })); advance(10);
    press('q');
    expect(savedMatch().draftState.periodState.periodIndex).toBe(1);
    advance(10); press('u');
    expect(screen.getByText('2nd half')).toBeInTheDocument();
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:40');
    expect(savedMatch().draftState.score1).toBe(0);
  });
  it('abandons at 30 seconds with the same frozen saved and terminal broadcast clock', () => {
    render(<MonoGoalsLiveScore />); advance(10);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Reds' })); advance(20);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(savedMatch()).toMatchObject({ resultType: 'abandoned', winner: null, elapsedSeconds: 30, periodState: { elapsed: 30, startedAt: null } });
    expect(buildTournamentConvexPayload({ sportId: 'football', tournament: h.tournaments[0], match: savedMatch() })).toMatchObject({ duration: 30, detail: { periodState: { elapsed: 30, startedAt: null } } });
    expect(h.finalize.mock.calls.at(-1)[0]).toMatchObject({ resultType: 'abandoned', snapshot: { pointsA: 1, periodClock: { elapsed: 30, startedAt: null, playedSeconds: 30 } } });
  });
  it('sums actual early-ended period time when abandoning the next period', () => {
    render(<MonoGoalsLiveScore />); advance(10);
    fireEvent.click(screen.getByRole('button', { name: 'End half' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm period end' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start next period' })); advance(10);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(savedMatch()).toMatchObject({ elapsedSeconds: 20, resultType: 'abandoned', periodState: { elapsedByPeriod: [10, 10] } });
  });
});


it('keyboard scoring uses the current broadcast callback after sharing state changes', () => {
  const previousPoint = h.point;
  try {
    const view = render(<MonoGoalsLiveScore />);
    h.point = vi.fn();
    view.rerender(<MonoGoalsLiveScore />);
    press('q');
    expect(h.point).toHaveBeenCalledWith(expect.objectContaining({ snapshot: expect.objectContaining({ pointsA: 1 }) }));
    expect(previousPoint).not.toHaveBeenCalled();
  } finally { h.point = previousPoint; }
});
