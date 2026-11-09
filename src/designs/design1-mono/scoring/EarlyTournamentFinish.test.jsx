import { matchStorageKey } from '../../../utils/accountStorage';
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SetsScorer from './MonoSetsLiveScore';
import GoalsScorer from './MonoGoalsLiveScore';
import TennisScorer from './MonoTennisLiveScore';
import CricketScorer from './MonoCricketLiveScore';
import TestScorer from './MonoCricketTestLiveScore';
import GuidedScorer from './MonoCricketGuidedScorerRoute';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import { loadSportTournaments, loadQuickMatches } from '../../../utils/storage';

vi.mock('convex/react', () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }) }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

beforeEach(() => { cleanup(); localStorage.clear(); });

const cases = [
  ['volleyball', SetsScorer], ['badminton', SetsScorer], ['tabletennis', SetsScorer],
  ['tennis', TennisScorer], ['football', GoalsScorer], ['basketball', GoalsScorer],
  ['hockey', GoalsScorer], ['kabaddi', GoalsScorer], ['cricket', CricketScorer],
];

it.each(cases)('tournament %s: cancelling Finish keeps scoring, confirming records no winner', async (sport, Scorer) => {
  const format = { type: 'best-of', sets: 3, points: 25, mode: 'timed', timeLimit: 5400, overs: 20, players: 11, totalInnings: 2 };
  const set = { score1: 2, score2: 1, games1: 2, games2: 1, points1: 1, points2: 0, completed: false };
  const tournament = { id: 100, name: 'Cup', type: 'round-robin', format,
    teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }], knockoutMatches: [],
    matches: [{ id: 'm1', team1Id: 'A', team2Id: 'B', status: 'in-progress', format,
      draftState: { scoringStarted: true, score1: 2, score2: 1, sets: [set], currentSet: 0, history: [], innings: 1, battingTeam: 1,
        scores: { team1: { runs: 13, wickets: 1, balls: 6 }, team2: { runs: 0, wickets: 0, balls: 0 } } } }],
  };
  localStorage.setItem(matchStorageKey(`se_${sport}`), JSON.stringify([tournament]));
  render(<MemoryRouter initialEntries={[`/${sport}/tournament/100/match/m1/score`]}><Routes>
    <Route path="/:sport/tournament/:id/match/:matchId/score" element={<Scorer />} />
    <Route path="/:sport/tournament/:id" element={<h1>Saved</h1>} />
    <Route path="/:sport/tournament/:id/match/:matchId/result" element={<h1>Saved</h1>} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  expect(screen.getByRole('dialog')).toHaveTextContent(/abandoned.*no result/i);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Keep scoring' }));
  expect(loadSportTournaments(`se_${sport}`)[0].matches[0].status).toBe('in-progress');
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
  await waitFor(() => expect(loadSportTournaments(`se_${sport}`)[0].matches[0]).toMatchObject({ status: 'completed', resultType: 'abandoned', winner: null }));
});

it.each(['test-tournament', 'test-quick', 'guided'])('%s abandons an undecided finish instead of inventing a draw or defending win', async kind => {
  const seed = cricketFinishSeed(kind);
  if (kind.startsWith('test')) {
    const match = kind === 'test-quick' ? seed.se_quickmatches[0] : seed.se_cricket[0].matches[0];
    match.draftState.currentInningsIndex = 0;
    match.draftState.innings = [{ teamId: 'A', runs: 13, wickets: 1, balls: 6 }, { teamId: 'B', runs: 0, wickets: 0, balls: 0 }, { teamId: 'A', runs: 0, wickets: 0, balls: 0 }, { teamId: 'B', runs: 0, wickets: 0, balls: 0 }];
  } else {
    seed.se_cricket[0].matches[0].draftState.phase = 'innings1';
  }
  for (const [key, value] of Object.entries(seed)) localStorage.setItem(matchStorageKey(key), JSON.stringify(value));
  const quick = kind === 'test-quick';
  const Scorer = kind === 'guided' ? GuidedScorer : TestScorer;
  const path = quick ? '/cricket/quick/test-match/300' : '/cricket/tournament/100/match/m1/score';
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/:sport/tournament/:id/match/:matchId/score" element={<Scorer />} />
    <Route path="/:sport/quick/test-match/:matchId" element={<Scorer storageMode="quick" />} />
    <Route path="/:sport/tournament/:id" element={<h1>Saved</h1>} />
    <Route path="/:sport/quick" element={<h1>Saved</h1>} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
  await waitFor(() => expect(quick ? loadQuickMatches()[0] : loadSportTournaments('se_cricket')[0].matches[0]).toMatchObject({ resultType: 'abandoned', status: 'completed', winner: null }));
});
