import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../../auth/AuthContext';
import { pendingMatchSaves } from '../../../utils/pendingMatchSaves';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import SetsScorer from './MonoSetsLiveScore';
import GoalsScorer from './MonoGoalsLiveScore';
import TennisScorer from './MonoTennisLiveScore';
import CricketScorer from './MonoCricketLiveScore';
import TestScorer from './MonoCricketTestLiveScore';
import GuidedScorer from './MonoCricketGuidedScorerRoute';

// Result saves use real Convex here with no provider or sending worker.
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }) }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

const cases = [
  ['sets', 'volleyball', SetsScorer], ['goals', 'football', GoalsScorer], ['tennis', 'tennis', TennisScorer],
  ['aggregate cricket', 'cricket', CricketScorer, 'aggregate'], ['Test cricket', 'cricket', TestScorer, 'test-tournament'], ['guided cricket', 'cricket', GuidedScorer, 'guided'],
];

it.each(cases)('%s finishes without a ConvexProvider and durably queues its signed-in result', async (_label, sport, Scorer, kind) => {
  const format = { type: 'best-of', sets: 3, points: 25, mode: 'timed', timeLimit: 5400, overs: 20, players: 11 };
  const set = { score1: 2, score2: 1, games1: 2, games2: 1, points1: 1, points2: 0, completed: false };
  const tournament = { id: 100, name: 'Cup', type: 'round-robin', format,
    teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }], knockoutMatches: [],
    matches: [{ id: 'm1', team1Id: 'A', team2Id: 'B', status: 'in-progress', format,
      draftState: { scoringStarted: true, score1: 2, score2: 1, sets: [set], currentSet: 0, history: [] } }],
  };
  const seed = sport === 'cricket' ? cricketFinishSeed(kind) : { [`se_${sport}`]: [tournament] };
  Object.entries(seed).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  render(<AuthContext.Provider value={{ isAuthenticated: true, user: { _id: 'no-provider-owner' } }}>
    <MemoryRouter initialEntries={[`/${sport}/tournament/100/match/m1/score`]}><Routes>
      <Route path="/:sport/tournament/:id/match/:matchId/score" element={<Scorer />} />
      <Route path="/:sport/tournament/:id" element={<h1>Finished locally</h1>} />
      <Route path="/:sport/tournament/:id/match/:matchId/result" element={<h1>Finished locally</h1>} />
    </Routes></MemoryRouter>
  </AuthContext.Provider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  const dialog = screen.queryByRole('dialog');
  if (dialog) fireEvent.click(within(dialog).getByRole('button', { name: 'End match' }));
  await screen.findByRole('heading', { name: 'Finished locally' });
  expect(pendingMatchSaves('no-provider-owner')).toEqual([expect.objectContaining({
    state: 'pending', attempts: 0, payload: expect.objectContaining({ clientMatchId: `tournament:${sport}:100:m1` }),
  })]);
  await waitFor(() => expect(JSON.parse(localStorage.getItem(`se_${sport}`))[0].matches[0].status).toBe('completed'));
});
