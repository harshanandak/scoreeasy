import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonoQuickMatch from '../MonoQuickMatch';
import MonoSetsLiveScore from './MonoSetsLiveScore';
import MonoTennisLiveScore from './MonoTennisLiveScore';
import MonoCricketLiveScore from './MonoCricketLiveScore';
import MonoCricketTestLiveScore from './MonoCricketTestLiveScore';
import MonoGoalsLiveScore from './MonoGoalsLiveScore';
import { usePendingLiveFinalizations } from '../../../hooks/usePendingLiveFinalizations';
import { loadSession, saveSession } from '../../../lib/live/liveSession';
import { flushLiveSession } from '../../../lib/live/recovery';
import { load } from '../../../lib/live/outbox';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import { createKabaddiMatch } from '../../../utils/kabaddiQuickMatch';
import { resolveKabaddiRules } from '../../../utils/kabaddiRules';

const h = vi.hoisted(() => ({
  query: vi.fn(), create: vi.fn(), scorePoint: vi.fn(), undo: vi.fn(), finalize: vi.fn(), setVisibility: vi.fn(),
  descriptor: null, restoring: null, broadcast: null,
}));
vi.mock('convex/react', () => ({ useConvex: () => h, useMutation: name => h[name], useQuery: () => undefined }));
vi.mock('../../../../convex/_generated/api', () => ({ api: { teams: { search: 'teamsSearch' }, users: { search: 'usersSearch' }, live: {
  create: 'create', scorePoint: 'scorePoint', undo: 'undo', finalize: 'finalize',
  setVisibility: 'setVisibility', getOwnedSession: 'getOwnedSession',
} } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, cloudAuthAvailable: true, user: { _id: 'owner' } }) }));
vi.mock('../../../hooks/useMatchSync', () => ({
  buildQuickMatchClientId: (sport, id) => `quick:${sport}:${id}`,
  useMatchSync: () => ({ syncMatch: async () => {}, resetSync: () => {} }),
  enqueueQuickMatchSave: () => ({ status: 'idle' }),
}));
vi.mock('../../../hooks/useTournamentMatchSync', () => ({ useTournamentMatchSync: () => () => {} }));
vi.mock('../../../mobile/lifecycle', () => ({ addAppStateChangeListener: async () => () => {} }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));
vi.mock('../components/MatchSyncStatus', () => ({ default: () => null }));
// Keep the real scorer and live hook; expose only the bar's restore lifecycle.
vi.mock('../live/LiveBroadcastBar', () => ({ default: function RestoreBar({ broadcast, descriptor, onEnableChange }) {
  h.descriptor = descriptor;
  h.broadcast = broadcast;
  useEffect(() => {
    if (!descriptor.clientMatchId) return;
    h.restoring = broadcast.restore({ clientMatchId: descriptor.clientMatchId }).then(session => {
      if (session) onEnableChange(Boolean(session.isShared));
    });
  }, [descriptor.clientMatchId, broadcast.restore]);
  return null;
} }));

const shared = { matchId: 'live-match', token: 'SHARE', lastSeq: 7, isShared: true };
const blankSet = { score1: 0, score2: 0, completed: false };
const tennisSet = { games1: 5, games2: 0, points1: 3, points2: 0, completed: false };
const cases = [
  { name: 'quick best-of sets', sport: 'volleyball', quick: true, Component: MonoQuickMatch, tap: 'Add point for Alpha',
    draft: { format: { type: 'best-of', sets: 3, target: 25, winBy: 2 }, sets: [{ ...blankSet, score1: 3 }], currentSet: 0 }, expected: { pointsA: 4, pointsB: 0 } },
  { name: 'quick single game', sport: 'badminton', quick: true, Component: MonoQuickMatch, tap: 'Add point for Alpha',
    draft: { format: { type: 'single', sets: 1, target: 21 }, vScore1: 3, vScore2: 0 }, expected: { pointsA: 4, pointsB: 0 } },
  { name: 'quick cricket winning ball', sport: 'cricket', quick: true, Component: MonoQuickMatch, tap: 'Four runs', auto: true,
    draft: { innings: 2, battingTeam: 2, cricketHistory: [], scores: {
      team1: { runs: 1, balls: 6, wickets: 0 }, team2: { runs: 1, balls: 1, wickets: 0 },
    } }, expected: { pointsA: 1, pointsB: 5, currentUnit: 2 } },
  { name: 'quick flat goals', sport: 'football', quick: true, Component: MonoQuickMatch, tap: 'Add 1 to Alpha',
    draft: { format: { mode: 'points', target: 10 }, gScore1: 3, gScore2: 0 }, expected: { pointsA: 4, pointsB: 0 } },
  { name: 'quick kabaddi', sport: 'kabaddi', quick: true, Component: MonoQuickMatch, kabaddi: true,
    expected: { pointsA: 1, pointsB: 0, kabaddi: expect.any(Object) } },
  { name: 'tournament sets', sport: 'volleyball', Component: MonoSetsLiveScore, tap: 'Add point for Alpha',
    format: { type: 'single', sets: 1, points: 25 }, draft: { sets: [{ ...blankSet, score1: 3 }], currentSet: 0 }, expected: { pointsA: 4, pointsB: 0 } },
  { name: 'tournament tennis winning point', sport: 'tennis', Component: MonoTennisLiveScore, tap: /^Alpha:/,
    format: { sets: 1 }, draft: { sets: [tennisSet], currentSet: 0 }, expected: { pointsA: 6, pointsB: 0, setsA: 1 } },
  { name: 'quick tennis winning point', sport: 'tennis', quick: true, Component: MonoTennisLiveScore, tap: /^Alpha:/,
    format: { sets: 1 }, draft: { sets: [tennisSet], currentSet: 0 }, expected: { pointsA: 6, pointsB: 0, setsA: 1 } },
  { name: 'tournament limited cricket', sport: 'cricket', Component: MonoCricketLiveScore, tap: '4',
    format: { preset: 'custom', overs: 1, players: 11, trackOvers: true }, draft: { innings: 2, battingTeam: 2, scores: {
      team1: { runs: 10, balls: 6, wickets: 0 }, team2: { runs: 0, balls: 0, wickets: 0 },
    } }, expected: { pointsA: 10, pointsB: 4, currentUnit: 2 } },
  ...['test-tournament', 'test-quick'].map(mode => ({ name: mode, mode, sport: 'cricket', Component: MonoCricketTestLiveScore,
    quick: mode === 'test-quick', tap: '2 runs', auto: true, expected: { pointsA: 1, pointsB: 2, currentUnit: 4 } })),
  { name: 'tournament flat goals winning point', sport: 'football', Component: MonoGoalsLiveScore, tap: 'Add 1 point to Alpha', auto: true,
    format: { mode: 'points', target: 4 }, draft: { score1: 3, score2: 0 }, expected: { pointsA: 4, pointsB: 0 } },
];

function seed(c) {
  const base = { phase: 'scoring', sport: c.sport, quickMatchId: 300, team1Name: 'Alpha', team2Name: 'Beta',
    scoringStarted: true, format: c.format, ...c.draft };
  if (c.kabaddi) {
    base.format = { kabaddiRules: resolveKabaddiRules('quick') };
    base.kabaddi = createKabaddiMatch({ format: base.format, names: ['Alpha', 'Beta'], colours: [undefined, undefined] });
  }
  if (c.mode) {
    Object.entries(cricketFinishSeed(c.mode)).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  } else if (c.quick) {
    const key = c.sport === 'tennis' ? 'se_tennis_quick_draft_300' : `se_quickmatch_draft_${c.sport}_300`;
    localStorage.setItem(key, JSON.stringify({ id: 300, ...base }));
  } else {
    localStorage.setItem(`se_${c.sport}`, JSON.stringify([{ id: 100, format: c.format,
      teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }], knockoutMatches: [],
      matches: [{ id: 'm1', team1Id: 'A', team2Id: 'B', status: 'in-progress', draftState: c.draft }],
    }]));
  }
  return c.quick ? (c.sport === 'tennis' ? '/tennis/quick/live/300' : c.mode ? '/cricket/quick/test-match/300' : `/${c.sport}/quick?resume=300`)
    : `/${c.sport}/tournament/100/match/m1/score`;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  h.descriptor = null; h.restoring = null; h.broadcast = null;
  h.scorePoint.mockResolvedValue({}); h.finalize.mockResolvedValue({ archived: true });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe.each(cases)('$name terminal broadcast', c => {
  it.each(['restoring', 'online'])('publishes the committed terminal score then finalizes once while %s', async state => {
    const path = seed(c);
    let resolveRestore;
    const pending = new Promise(resolve => { resolveRestore = resolve; });
    h.query.mockReturnValue(pending);
    const Component = c.Component;
    const board = render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/:sport/quick" element={<Component />} />
      <Route path="/:sport/quick/live/:matchId" element={<Component storageMode="quick" />} />
      <Route path="/:sport/quick/test-match/:matchId" element={<Component storageMode="quick" />} />
      <Route path="/:sport/tournament/:id/match/:matchId/score" element={<Component />} />
      <Route path="*" element={<p>Saved result</p>} />
    </Routes></MemoryRouter>);
    await waitFor(() => expect(h.descriptor?.clientMatchId).toBeTruthy());
    const clientMatchId = h.descriptor.clientMatchId;
    saveSession(clientMatchId, { ...shared, seq: 7 });
    if (state === 'online') await act(async () => { resolveRestore(shared); await h.restoring; });
    if (c.kabaddi) {
      fireEvent.click(screen.getByRole('button', { name: 'Raid by Alpha' }));
      fireEvent.click(screen.getByRole('button', { name: '+1' }));
    } else fireEvent.click(screen.getByRole('button', { name: c.tap }));
    await act(async () => { await flushLiveSession(clientMatchId, h); });
    // Auto-completion replaces the scoring surface, so its bar retains the
    // pre-winning snapshot. The saved result is the authority for that path.
    const committed = c.auto ? null : JSON.parse(JSON.stringify(h.descriptor.snapshot));
    if (committed) expect(committed).toMatchObject(c.expected);
    if (c.auto) {
      const saved = JSON.parse(localStorage.getItem(c.quick ? 'se_quickmatches' : `se_${c.sport}`));
      const result = c.quick ? saved[0] : saved[0].matches[0];
      expect(result.status).toBe('completed');
      if (c.mode) expect(result.innings[3].runs).toBe(c.expected.pointsB);
      else if (c.sport === 'cricket') expect(result.team2Score.runs).toBe(c.expected.pointsB);
      else expect(result.score1).toBe(c.expected.pointsA);
    }
    if (state === 'restoring') expect(h.scorePoint).not.toHaveBeenCalled();
    if (!c.auto) {
      fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
      const confirm = screen.queryByRole('button', { name: 'End match' });
      if (confirm) fireEvent.click(confirm);
    }
    if (state === 'restoring') {
      expect(loadSession(clientMatchId)).toHaveProperty('finalizeIntent');
      expect(load().at(-1).snapshot).toMatchObject(c.expected);
      board.unmount();
      h.query.mockResolvedValue(shared);
      await act(async () => { resolveRestore(shared); await h.restoring; });
    }
    const root = render(<Recovery />);
    await act(async () => { await flushLiveSession(clientMatchId, h); });
    await waitFor(() => expect(h.finalize).toHaveBeenCalledTimes(1));
    const terminalCall = h.scorePoint.mock.calls.at(-1)[0];
    expect(terminalCall).toMatchObject({ value: 0, type: 'correction', snapshot: c.expected });
    if (committed) expect(terminalCall.snapshot).toMatchObject(committed);
    expect(h.scorePoint.mock.invocationCallOrder.at(-1)).toBeLessThan(h.finalize.mock.invocationCallOrder[0]);
    expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
    await act(async () => {
      globalThis.dispatchEvent(new Event('online'));
      globalThis.dispatchEvent(new Event('focus'));
      await flushLiveSession(clientMatchId, h);
    });
    expect(h.finalize).toHaveBeenCalledTimes(1);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.setVisibility).not.toHaveBeenCalled();
    root.unmount();
  });
});

function Recovery() { usePendingLiveFinalizations(); return null; }
