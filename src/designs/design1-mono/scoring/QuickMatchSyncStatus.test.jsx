import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../../auth/AuthContext';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import { ScoringCompletionContext } from './scoringCompletionContext';
import MonoCricketTestLiveScore from './MonoCricketTestLiveScore';
import MonoTennisLiveScore from './MonoTennisLiveScore';
import MonoQuickMatch from '../MonoQuickMatch';
import MonoHistory from '../MonoHistory';

const { save, live } = vi.hoisted(() => ({
  save: vi.fn(), live: { point: vi.fn(), undo: vi.fn(), finalize: vi.fn() },
}));
vi.mock('convex/react', () => ({ useMutation: () => save, useQuery: () => [], useConvex: () => ({ query: async () => null }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => live }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));

let auth;
let owner = 0;
beforeEach(() => {
  localStorage.clear();
  save.mockReset();
  auth = { isAuthenticated: true, user: { _id: `status-owner-${++owner}` }, cloudAuthAvailable: true };
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function blockQueueAndMetadataWrites() {
  const write = Storage.prototype.setItem;
  let resultWritten = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key.startsWith('se_pending_match:') || (resultWritten && key === 'se_quickmatches')) {
      throw new DOMException('Full', 'QuotaExceededError');
    }
    const result = write.call(this, key, value);
    if (key === 'se_quickmatches' && JSON.parse(value).some((match) => match.status === 'completed')) resultWritten = true;
    return result;
  });
}

function mountTest() {
  const seed = cricketFinishSeed('test-quick');
  Object.entries(seed).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/cricket/quick/test-match/300']}>
        <ScoringCompletionContext.Provider value={vi.fn()}>
          <Routes><Route path="/:sport/quick/test-match/:matchId" element={<MonoCricketTestLiveScore storageMode="quick" />} /></Routes>
        </ScoringCompletionContext.Provider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

it.each(['failed', 'offline', 'acknowledged', 'volatile'])('shows %s cloud status on quick Test cricket Match Complete', async (mode) => {
  if (mode === 'offline') Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  if (mode === 'acknowledged') save.mockResolvedValue('server-id');
  else save.mockRejectedValue(new Error('Result rejected'));
  mountTest();
  if (mode === 'volatile') blockQueueAndMetadataWrites();
  fireEvent.click(screen.getByRole('button', { name: '2 runs' }));
  expect(await screen.findByText('Match Complete')).toBeInTheDocument();
  const label = mode === 'offline' ? 'Waiting for connection' : mode === 'acknowledged' ? 'Saved to your account' : mode === 'volatile' ? /Keep this screen open/ : "Couldn't save";
  expect(await screen.findByText(label)).toBeInTheDocument();
  if (mode === 'offline') expect(save).not.toHaveBeenCalled();
  if (mode === 'failed') expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

it('persists the quick Test canonical identity in the first completed write even if later writes fail', async () => {
  save.mockRejectedValue(new Error('Result rejected'));
  mountTest();
  blockQueueAndMetadataWrites();
  fireEvent.click(screen.getByRole('button', { name: '2 runs' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0].clientMatchId).toBe('cricket:quick:300');
});

it('keeps the volatile tennis warning visible on Finish and History after the result write succeeds', async () => {
  const set = { games1: 6, games2: 0, points1: 0, points2: 0, completed: true };
  const match = { id: 'tennis-status', sport: 'tennis', team1: 'Alpha', team2: 'Beta', team1Name: 'Alpha', team2Name: 'Beta', status: 'in-progress', format: { sets: 3 }, sets: [set, set, { ...set, games1: 0, completed: false }] };
  localStorage.setItem('se_quickmatches', JSON.stringify([match]));
  localStorage.setItem('se_tennis_quick_draft_tennis-status', JSON.stringify(match));
  save.mockRejectedValue(new Error('Result rejected'));
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/tennis/quick/tennis-status']}>
        <Routes>
          <Route path="/:sport/quick/:matchId" element={<MonoTennisLiveScore storageMode="quick" />} />
          <Route path="/:sport/quick" element={<MonoQuickMatch />} />
          <Route path="/history" element={<MonoHistory />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  const finish = await screen.findByRole('button', { name: 'Finish' });
  await waitFor(() => expect(finish).toBeEnabled());
  blockQueueAndMetadataWrites();
  fireEvent.click(finish);
  expect(await screen.findByText(/Keep this screen open/)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('se_quickmatches'))[0].clientMatchId).toBe('tennis:quick:tennis-status');
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByText(/Keep this screen open/)).toBeInTheDocument();
});
