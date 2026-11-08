import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConvexError } from 'convex/values';
import { AuthContext } from '../../../auth/AuthContext';
import { usePendingMatchSaves } from '../../../hooks/usePendingMatchSaves';
import { pendingMatchSaves } from '../../../utils/pendingMatchSaves';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import SetsScorer from './MonoSetsLiveScore';
import GoalsScorer from './MonoGoalsLiveScore';
import TennisScorer from './MonoTennisLiveScore';
import CricketScorer from './MonoCricketLiveScore';
import TestScorer from './MonoCricketTestLiveScore';
import GuidedScorer from './MonoCricketGuidedScorerRoute';
import GenericGoalsTournament from '../GenericGoalsTournament';
import GenericSetsTournament from '../GenericSetsTournament';
import MonoCricketTournament from '../MonoCricketTournament';
import MonoMatchResult from '../components/MonoMatchResult';

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => save, useConvex: () => ({}), useQuery: () => [] }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }) }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

let auth;
let sequence = 0;
beforeEach(() => {
  localStorage.clear();
  auth = { isAuthenticated: true, user: { _id: `tournament-owner-${++sequence}` } };
  save.mockReset();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Worker() { usePendingMatchSaves(); return null; }
function mount(sport = 'football', Scorer = GoalsScorer, kind) {
  const format = { type: 'best-of', sets: 3, points: 25, mode: 'timed', timeLimit: 5400, overs: 20, players: 11 };
  const set = { score1: 2, score2: 1, games1: 2, games2: 1, points1: 1, points2: 0, completed: false };
  const tournament = { id: 100, name: 'Cup', type: 'round-robin', phase: 'group', format,
    teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }], knockoutMatches: [],
    matches: [{ id: 'm1', team1Id: 'A', team2Id: 'B', status: 'in-progress', format,
      draftState: { scoringStarted: true, score1: 2, score2: 1, sets: [set], currentSet: 0, history: [] } }],
  };
  const seed = sport === 'cricket' ? cricketFinishSeed(kind || 'aggregate') : { [`se_${sport}`]: [tournament] };
  const Fixtures = sport === 'cricket' ? MonoCricketTournament : ['volleyball', 'tennis'].includes(sport) ? GenericSetsTournament : GenericGoalsTournament;
  Object.entries(seed).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  render(<AuthContext.Provider value={auth}><MemoryRouter initialEntries={[`/${sport}/tournament/100/match/m1/score`]}>
    <Worker /><Routes>
      <Route path="/:sport/tournament/:id/match/:matchId/score" element={<Scorer />} />
      <Route path="/:sport/tournament/:id" element={<Fixtures />} />
      <Route path="/:sport/tournament/:id/match/:matchId/result" element={<MonoMatchResult />} />
    </Routes>
  </MemoryRouter></AuthContext.Provider>);
}
async function finish() {
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  const dialog = screen.queryByRole('dialog');
  if (dialog) fireEvent.click(within(dialog).getByRole('button', { name: 'End match' }));
}

it.each([
  ['sets', 'volleyball', SetsScorer], ['goals', 'football', GoalsScorer], ['tennis', 'tennis', TennisScorer],
  ['aggregate cricket', 'cricket', CricketScorer, 'aggregate'], ['Test cricket', 'cricket', TestScorer, 'test-tournament'], ['guided cricket', 'cricket', GuidedScorer, 'guided'],
])('%s retains a failed tournament result with a stable identity', async (_label, sport, Scorer, kind) => {
  save.mockRejectedValue(new TypeError('Failed to fetch'));
  mount(sport, Scorer, kind);
  await finish();
  await waitFor(() => expect(pendingMatchSaves(auth.user._id)[0]).toMatchObject({
    state: 'failed', payload: { clientMatchId: `tournament:${sport}:100:m1` },
  }));
  expect(JSON.parse(localStorage.getItem(`se_${sport}`))[0].matches[0].status).toBe('completed');
  expect(await screen.findByText("Couldn't save")).toBeInTheDocument();
});

it('fixture badge clears after reconnect retries the same result id and persists confirmation', async () => {
  save.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('server-id');
  mount(); await finish();
  expect(await screen.findByText("Couldn't save")).toBeInTheDocument();
  vi.spyOn(Date, 'now').mockReturnValue(pendingMatchSaves(auth.user._id)[0].nextAttemptAt);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(pendingMatchSaves(auth.user._id)).toEqual([]));
  expect(save.mock.calls.map(([payload]) => payload.clientMatchId)).toEqual(['tournament:football:100:m1', 'tournament:football:100:m1']);
  expect(screen.queryByText("Couldn't save")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('se_football'))[0].matches[0]).toMatchObject({ syncOwnerId: auth.user._id, sync: { status: 'synced' } });
});

it('permanent rejection stays terminal across foreground, and manual Retry reuses its id', async () => {
  save.mockRejectedValueOnce(new ConvexError('Result rejected')).mockResolvedValue('server-id');
  mount(); await finish();
  expect(await screen.findByText("Couldn't save")).toBeInTheDocument();
  expect(pendingMatchSaves(auth.user._id)[0].terminal).toBe(true);
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000);
  await act(async () => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); });
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(pendingMatchSaves(auth.user._id)).toEqual([]));
  expect(save.mock.calls[1][0].clientMatchId).toBe(save.mock.calls[0][0].clientMatchId);
});

it('guest tournament results stay local with no cloud status or queue entry', async () => {
  auth = { isAuthenticated: false };
  mount(); await finish();
  await waitFor(() => expect(JSON.parse(localStorage.getItem('se_football'))[0].matches[0].status).toBe('completed'));
  expect(save).not.toHaveBeenCalled();
  expect(screen.queryByText(/Couldn't save|Waiting for connection|Saved to your account/)).not.toBeInTheDocument();
  expect(Object.keys(localStorage).filter(key => key.startsWith('se_pending_match:'))).toEqual([]);
});
