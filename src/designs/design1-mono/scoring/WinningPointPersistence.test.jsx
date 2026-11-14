import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { loadData, saveData, loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { getSportById } from '../../../models/sportRegistry';
import MonoTennisLiveScore from './MonoTennisLiveScore';
import MonoSetsLiveScore from './MonoSetsLiveScore';
import MonoGoalsLiveScore from './MonoGoalsLiveScore';
import MonoCricketLiveScore from './MonoCricketLiveScore';

vi.mock('convex/react', () => ({ useConvex: () => ({ query: async () => null }), useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn() }) }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

function seed(sport, format, draftState) {
  const tournament = {
    id: 1, format, type: 'round-robin',
    teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }],
    matches: [{ id: 'm1', team1Id: 'A', team2Id: 'B', status: 'in-progress', format, draftState }],
    knockoutMatches: [],
  };
  expect(saveSportTournament(getSportById(sport).storageKey, tournament)).toBe(true);
}
const stored = sport => loadSportTournaments(getSportById(sport).storageKey)[0].matches[0];
function mount(sport, Scorer, quick = false) {
  return render(<MemoryRouter initialEntries={[`/${sport}/1/m1`]}>
    <Routes><Route path="/:sport/:id/:matchId" element={<Scorer storageMode={quick ? 'quick' : 'tournament'} />} /></Routes>
  </MemoryRouter>);
}
const tennisSet = overrides => ({ games1: 0, games2: 0, points1: 0, points2: 0, isDeuce: false,
  advantage: null, isTiebreak: false, tiebreakPoints1: 0, tiebreakPoints2: 0, completed: false, ...overrides });

describe('SA-04 winning point survives leaving the scorer before Finish', () => {
  it.each(['quick', 'tournament'])('tennis %s restores the winning point and can undo it after reload', mode => {
    const sets = [tennisSet({ games1: 5, games2: 4, points1: 3 })];
    const format = { sets: 1 };
    if (mode === 'quick') saveData('se_tennis_quick_draft_m1', {
      matchId: 'm1', sport: 'tennis', team1Name: 'Alpha', team2Name: 'Beta', format, sets,
    });
    else seed('tennis', format, { sets, currentSet: 0, history: [] });
    const read = () => mode === 'quick' ? loadData('se_tennis_quick_draft_m1') : stored('tennis');
    const first = mount('tennis', MonoTennisLiveScore, mode === 'quick');
    fireEvent.click(screen.getByRole('button', { name: /^Alpha:/ }));
    expect(screen.getByText('Match Complete')).toBeInTheDocument();
    expect(read().draftState.sets[0]).toMatchObject({ games1: 6, games2: 4, completed: true });
    first.unmount();
    mount('tennis', MonoTennisLiveScore, mode === 'quick');
    expect(screen.getByText('Match Complete')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(read().draftState.sets[0]).toMatchObject({ games1: 5, games2: 4, points1: 3, completed: false });
  });

  it.each(['volleyball', 'badminton', 'tabletennis'])('%s restores the match-winning set and undo history', sport => {
    const target = getSportById(sport).config.pointsPerSet;
    seed(sport, { type: 'single', sets: 1, points: target }, {
      sets: [{ score1: target - 1, score2: 0, completed: false }], currentSet: 0,
      history: [], servingTeam: 1, scoringMode: 'rally',
    });
    const first = mount(sport, MonoSetsLiveScore);
    fireEvent.click(screen.getByRole('button', { name: sport === 'volleyball' ? 'Add point for Alpha' : /^Alpha:/ }));
    expect(stored(sport).draftState.sets[0]).toMatchObject({ score1: target, completed: true });
    first.unmount(); mount(sport, MonoSetsLiveScore);
    expect(stored(sport).draftState.sets[0]).toMatchObject({ score1: target, completed: true });
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(stored(sport).draftState.sets[0]).toMatchObject({ score1: target - 1, completed: false });
  });

  it.each(['football', 'basketball', 'hockey', 'kabaddi'])('%s retains the last score across reload', sport => {
    seed(sport, {}, { score1: 2, score2: 1, history: [] });
    const first = mount(sport, MonoGoalsLiveScore);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 point to Alpha' }));
    expect(stored(sport).draftState.score1).toBe(3);
    first.unmount(); mount(sport, MonoGoalsLiveScore);
    expect(stored(sport).draftState.score1).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(stored(sport).draftState.score1).toBe(2);
  });

  it.each([
    { name: 'winning chase run', runs: 1, balls: 0, wickets: 0, button: '1', expected: { runs: 2, balls: 1, wickets: 0 } },
    { name: 'last legal ball', runs: 0, balls: 5, wickets: 0, button: '0', expected: { runs: 0, balls: 6, wickets: 0 } },
    { name: 'last wicket', runs: 0, balls: 0, wickets: 9, button: 'Wicket', expected: { runs: 0, balls: 1, wickets: 10 } },
  ])('cricket restores the $name before Finish', ({ runs, balls, wickets, button, expected }) => {
    seed('cricket', { preset: 'custom', overs: 1, players: 11, totalInnings: 2, trackOvers: true }, {
      innings: 2, battingTeam: 2, history: [], scores: {
        team1: { runs: 1, balls: 6, wickets: 0 }, team2: { runs, balls, wickets },
      },
    });
    const first = mount('cricket', MonoCricketLiveScore);
    fireEvent.click(screen.getByRole('button', { name: button, exact: true }));
    expect(stored('cricket').draftState.scores.team2).toMatchObject(expected);
    first.unmount(); mount('cricket', MonoCricketLiveScore);
    expect(stored('cricket').draftState.scores.team2).toMatchObject(expected);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(stored('cricket').draftState.scores.team2).toMatchObject({ runs, balls, wickets });
  });
});
