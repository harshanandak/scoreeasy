import { useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { useLiveBroadcast } from './hooks/useLiveBroadcast';
import { useTournamentScoreClear } from './designs/design1-mono/hooks/useTournamentScoreClear';
import { load } from './lib/live/outbox';
import { loadSession } from './lib/live/liveSession';

const h = vi.hoisted(() => ({
  create: vi.fn(), scorePoint: vi.fn(), undo: vi.fn(), finalize: vi.fn(),
  setVisibility: vi.fn(), query: vi.fn(), nativeForeground: null,
}));
vi.mock('convex/react', () => ({
  useConvex: () => h,
  useMutation: (name) => h[name],
}));
vi.mock('../convex/_generated/api', () => ({ api: { live: {
  create: 'create', scorePoint: 'scorePoint', undo: 'undo', finalize: 'finalize',
  setVisibility: 'setVisibility', getOwnedSession: 'getOwnedSession',
} } }));
vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { _id: 'owner' }, clerkUser: { id: 'owner' } }) }));
vi.mock('./hooks/usePendingMatchSaves', () => ({ usePendingMatchSaves: () => {} }));
vi.mock('./mobile/lifecycle', () => ({ addAppStateChangeListener: async (callback) => {
  h.nativeForeground = callback;
  return () => { h.nativeForeground = null; };
} }));
vi.mock('./designs/design1-mono/index', () => ({ default: TestRoutes }));

const GO = {
  clientMatchId: 'volleyball:7:m1', sport: 'volleyball', scorecardKind: 'volleyball',
  teamA: { name: 'Alpha' }, teamB: { name: 'Beta' }, visibility: 'public',
  snapshot: { pointsA: 0, pointsB: 0, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 },
};
const terminal = { ...GO.snapshot, pointsA: 5, pointsB: 3 };

function Scorer() {
  const broadcast = useLiveBroadcast();
  const navigate = useNavigate();
  useEffect(() => { void broadcast.restore(GO); }, [broadcast.restore]);
  return <>
    <button onClick={() => { void broadcast.goLive(GO); }}>Share</button>
    <button onClick={() => { void broadcast.point({ team: 'A', at: 1 }); }}>Point</button>
    <button onClick={() => {
      void broadcast.finalize({ resultType: 'abandoned', snapshot: terminal });
      navigate('/result');
    }}>Finish</button>
    {broadcast.error && <p role="alert">{broadcast.error.message}</p>}
  </>;
}

function ClearFixture() {
  const [tournament, setTournament] = useState({ matches: [{ id: 'm1', status: 'completed' }], teams: [] });
  const clear = useTournamentScoreClear({ scoreKind: 'sets', tournament, setTournament, teams: [], tournamentScopeKey: 'volleyball:7' });
  const navigate = useNavigate();
  return <>
    <button onClick={() => clear.requestScoreClear(tournament.matches[0])}>Clear score</button>
    <button onClick={clear.confirmScoreClear}>Confirm clear</button>
    <button onClick={() => navigate('/score')}>Reopen</button>
  </>;
}

function TestRoutes() {
  const navigate = useNavigate();
  return <Routes>
    <Route path="/score" element={<Scorer />} />
    <Route path="/result" element={<><p>Saved result</p><button onClick={() => navigate('/tournament')}>Tournament</button></>} />
    <Route path="/tournament" element={<ClearFixture />} />
  </Routes>;
}

function mount(path = '/score') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  Object.values(h).filter(value => typeof value?.mockReset === 'function').forEach(value => value.mockReset());
  h.query.mockResolvedValue(null);
  h.create.mockResolvedValue({ matchId: 'old-live', token: 'OLD' });
  h.setVisibility.mockResolvedValue({ ok: true });
  h.scorePoint.mockResolvedValue({});
  h.finalize.mockResolvedValue({ archived: true });
});

async function offlineFinish() {
  await screen.findByRole('button', { name: 'Share' });
  await act(async () => { fireEvent.click(screen.getByText('Share')); });
  h.scorePoint.mockRejectedValue(new Error('offline'));
  await act(async () => { fireEvent.click(screen.getByText('Point')); });
  await act(async () => { fireEvent.click(screen.getByText('Finish')); });
  expect(screen.getByText('Saved result')).toBeVisible();
  expect(screen.queryByText('Point')).not.toBeInTheDocument();
  expect(load()).toHaveLength(2);
  expect(h.finalize).not.toHaveBeenCalled();
}

it('recovers offline finish after navigation unmounts the scorer, publishing terminal scores first', async () => {
  mount();
  await offlineFinish();
  const order = [];
  h.scorePoint.mockImplementation(async ({ snapshot }) => { order.push(snapshot ? 'terminal' : 'point'); });
  h.finalize.mockImplementation(async () => { order.push('finalize'); });
  await act(async () => { globalThis.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(h.finalize).toHaveBeenCalledTimes(1));
  expect(order).toEqual(['point', 'terminal', 'finalize']);
  expect(load()).toEqual([]);
});

it('recovers after reload directly onto the result route without calling board restore', async () => {
  const first = mount();
  await offlineFinish();
  first.unmount();
  h.query.mockClear();
  mount('/result');
  await screen.findByText('Saved result');
  h.scorePoint.mockClear().mockResolvedValue({});
  await act(async () => { globalThis.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(h.finalize).toHaveBeenCalledTimes(1));
  expect(h.query).not.toHaveBeenCalled();
  expect(h.scorePoint).toHaveBeenLastCalledWith(expect.objectContaining({ matchId: 'old-live', snapshot: terminal }));
  expect(loadSession(GO.clientMatchId)).not.toHaveProperty('finalizeIntent');
});

it('still recovers an unfinished live match\'s queued points on reconnect', async () => {
  mount();
  await screen.findByRole('button', { name: 'Share' });
  await act(async () => { fireEvent.click(screen.getByText('Share')); });
  h.scorePoint.mockRejectedValue(new Error('offline'));
  await act(async () => { fireEvent.click(screen.getByText('Point')); });
  expect(load()).toHaveLength(1);
  h.scorePoint.mockClear().mockResolvedValue({});
  await act(async () => { globalThis.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(load()).toEqual([]));
  expect(h.scorePoint).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ matchId: 'old-live' }));
  expect(h.finalize).not.toHaveBeenCalled();
});

it.each(['match_not_found', 'not_authorized'])('cancels a rejected session with queued scores and stops reconnect/foreground retries: %s', async (code) => {
  mount();
  await offlineFinish();
  localStorage.setItem('se_local_result', JSON.stringify(terminal));
  h.scorePoint.mockClear().mockRejectedValue(Object.assign(new Error('Server Error'), { data: { code } }));
  await act(async () => { globalThis.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(load()).toEqual([]));
  expect(loadSession(GO.clientMatchId)).not.toHaveProperty('finalizeIntent');
  expect(screen.getByRole('alert')).toBeVisible();
  const calls = h.scorePoint.mock.calls.length;
  await act(async () => {
    globalThis.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    h.nativeForeground?.({ isActive: true });
  });
  expect(h.scorePoint).toHaveBeenCalledTimes(calls);
  expect(h.finalize).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('se_local_result'))).toEqual(terminal);
});

it('score clear creates a new live generation before reopening the fixture', async () => {
  mount();
  await offlineFinish();
  fireEvent.click(screen.getByText('Tournament'));
  fireEvent.click(screen.getByText('Clear score'));
  fireEvent.click(screen.getByText('Confirm clear'));
  h.query.mockImplementation(async (_name, { clientMatchId }) => clientMatchId === GO.clientMatchId
    ? { matchId: 'old-live', token: 'OLD', lastSeq: 2, isShared: true } : null);
  h.create.mockImplementation(async ({ clientMatchId }) => ({ matchId: clientMatchId === GO.clientMatchId ? 'old-live' : 'new-live', token: 'NEW' }));
  h.scorePoint.mockResolvedValue({});
  await act(async () => { fireEvent.click(screen.getByText('Reopen')); });
  expect(h.query.mock.calls.at(-1)[1].clientMatchId).not.toBe(GO.clientMatchId);
  await act(async () => { globalThis.dispatchEvent(new Event('online')); });
  await act(async () => { fireEvent.click(screen.getByText('Share')); });
  await act(async () => { fireEvent.click(screen.getByText('Point')); });
  expect(h.create.mock.calls.at(-1)[0].clientMatchId).not.toBe(GO.clientMatchId);
  expect(h.scorePoint).toHaveBeenLastCalledWith(expect.objectContaining({ matchId: 'new-live' }));
  expect(h.finalize.mock.calls.every(([args]) => args.matchId === 'old-live')).toBe(true);
});
