import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonoSetsLiveScore from './MonoSetsLiveScore';
import MonoTennisLiveScore from './MonoTennisLiveScore';
import MonoCricketLiveScore from './MonoCricketLiveScore';
import MonoCricketTestLiveScore from './MonoCricketTestLiveScore';
import { ScoringCompletionContext } from './scoringCompletionContext';

const h = vi.hoisted(() => ({
  sport: '', tournament: null, stored: null,
  save: vi.fn(), point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), complete: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ sport: h.sport, id: '1', matchId: 'm1' }),
  useNavigate: () => h.complete,
}));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../utils/storage', () => ({
  loadSportTournaments: () => [h.tournament],
  saveSportTournament: (...args) => h.save(...args),
  loadData: (_key, fallback) => fallback,
  saveData: vi.fn(() => true), clearData: vi.fn(), saveQuickMatch: vi.fn(() => true),
}));
vi.mock('../../../hooks/useLiveBroadcast', () => ({
  useLiveBroadcast: () => ({ point: h.point, undo: h.undo, finalize: h.finalize }),
}));
vi.mock('../../../lib/live/liveSession', () => ({ getConsent: () => 'accepted' }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.stored = null;
  h.save.mockImplementation((_key, tournament) => { h.stored = structuredClone(tournament); return true; });
});

it.each([false, true])('Test cricket commits the winning ball before finalizing (retry: %s)', (retry) => {
  h.sport = 'cricket';
  const innings = [
    { teamId: 'a', runs: 1, balls: 1, wickets: 0, declared: true },
    { teamId: 'b', runs: 0, balls: 1, wickets: 0, declared: true },
    { teamId: 'a', runs: 0, balls: 1, wickets: 0, declared: true },
    { teamId: 'b', runs: 0, balls: 0, wickets: 0 },
  ];
  h.tournament = { id: 1, teams: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
    matches: [{ id: 'm1', team1Id: 'a', team2Id: 'b',
      format: { preset: 'test', totalInnings: 4, players: 11, overs: null, declaration: true },
      draftState: { innings, currentInningsIndex: 3,
        history: [{ innings: structuredClone(innings), currentInningsIndex: 3 }] } }], knockoutMatches: [] };
  render(<MonoCricketTestLiveScore />);
  if (retry) h.save.mockReturnValueOnce(false);
  const undo = screen.getByRole('button', { name: 'Undo last action' });
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: '2 runs' }));
    fireEvent.click(undo);
  });
  if (retry) {
    expect(h.finalize).not.toHaveBeenCalled();
    expect(h.complete).not.toHaveBeenCalled();
    expect(h.stored.matches[0].draftState.innings[3].runs).toBe(2);
    expect(screen.getByRole('button', { name: 'Save & Return' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Return' }));
  }
  expect(h.stored?.matches[0]).toMatchObject({ status: 'completed', winner: 'b', draftState: undefined });
  expect(h.stored.matches[0].innings[3].runs).toBe(2);
  expect(h.finalize).toHaveBeenCalledOnce();
  expect(h.undo).not.toHaveBeenCalled();
  expect(h.point.mock.calls.at(-1)[0].snapshot).toMatchObject({ pointsA: 1, pointsB: 2 });
  expect(h.save.mock.invocationCallOrder.at(-1)).toBeLessThan(h.finalize.mock.invocationCallOrder[0]);
  const saves = h.save.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Save & Return' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save & Return' }));
  act(() => vi.advanceTimersByTime(350));
  expect(h.save).toHaveBeenCalledTimes(saves);
  expect(h.finalize).toHaveBeenCalledOnce();
  expect(h.complete).toHaveBeenCalledOnce();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const cases = [
  { name: 'sets', sport: 'volleyball', Component: MonoSetsLiveScore,
    format: { type: 'single', sets: 1, points: 2 },
    draft: { currentSet: 0, sets: [{ score1: 2, score2: 0, completed: true }],
      history: [{ currentSet: 0, sets: [{ score1: 1, score2: 0, completed: false }] }] } },
  { name: 'tennis', sport: 'tennis', Component: MonoTennisLiveScore,
    format: { sets: 1 },
    draft: { sets: [{ games1: 6, games2: 0, points1: 0, points2: 0, completed: true }],
      history: [{ currentSet: 0, sets: [{ games1: 5, games2: 0, points1: 40, points2: 0, completed: false }] }] } },
  { name: 'cricket', sport: 'cricket', Component: MonoCricketLiveScore,
    format: { preset: 'custom', overs: 0, trackOvers: false, playersPerSide: 11 },
    draft: { innings: 2, battingTeam: 2, scores: {
      team1: { runs: 1, balls: 1, wickets: 0 }, team2: { runs: 2, balls: 1, wickets: 0 } },
      history: [{ innings: 2, battingTeam: 2, scores: {
        team1: { runs: 1, balls: 1, wickets: 0 }, team2: { runs: 0, balls: 0, wickets: 0 } } }] } },
];

describe.each(cases)('$name completion transaction', ({ sport, Component, format, draft }) => {
  beforeEach(() => {
    h.sport = sport;
    h.tournament = { id: 1, format, teams: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
      matches: [{ id: 'm1', team1Id: 'a', team2Id: 'b', status: 'in-progress', draftState: draft }], knockoutMatches: [] };
  });

  it('cannot undo, score, correct or finish twice after the first Finish', () => {
    render(<ScoringCompletionContext.Provider value={h.complete}><Component /></ScoringCompletionContext.Provider>);
    const finish = screen.getByRole('button', { name: /Finish/ });
    fireEvent.click(finish);
    const finished = structuredClone(h.stored.matches[0]);
    expect(finished.status).toBe('completed');
    expect(finished.draftState).toBeUndefined();
    const saves = h.save.mock.calls.length;
    act(() => { vi.advanceTimersByTime(160); });
    fireEvent.click(screen.getByRole('button', { name: /Undo(?: last action)?$/ }));
    for (const button of screen.getAllByRole('button')) {
      if (/Add.*point|Correct|^\+?[1246]$/.test(button.getAttribute('aria-label') || button.textContent)) fireEvent.click(button);
    }
    fireEvent.click(finish);
    act(() => { vi.advanceTimersByTime(500); });
    expect(h.stored.matches[0]).toEqual(finished);
    expect(h.save).toHaveBeenCalledTimes(saves);
    expect(h.undo).not.toHaveBeenCalled();
    expect(h.point).not.toHaveBeenCalled();
    expect(h.finalize).toHaveBeenCalledOnce();
    expect(h.complete).toHaveBeenCalledOnce();
  });

  it('keeps the scorer open and allows a failed final save to be retried', () => {
    render(<ScoringCompletionContext.Provider value={h.complete}><Component /></ScoringCompletionContext.Provider>);
    h.save.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    expect(h.finalize).not.toHaveBeenCalled();
    expect(h.complete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Finish/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    act(() => { vi.advanceTimersByTime(350); });
    expect(h.stored.matches[0].status).toBe('completed');
    expect(h.finalize).toHaveBeenCalledOnce();
    expect(h.complete).toHaveBeenCalledOnce();
  });
});
