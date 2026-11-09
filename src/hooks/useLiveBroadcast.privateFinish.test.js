import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLiveBroadcast } from './useLiveBroadcast';
import { loadSession, saveSession } from '../lib/live/liveSession';
import { flushLiveSession } from '../lib/live/recovery';
import { load } from '../lib/live/outbox';

const h = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), scorePoint: vi.fn(), undo: vi.fn(), finalize: vi.fn(), setVisibility: vi.fn() }));
vi.mock('convex/react', () => ({ useConvex: () => h, useMutation: name => h[name] }));
vi.mock('../../convex/_generated/api', () => ({ api: { live: {
  create: 'create', scorePoint: 'scorePoint', undo: 'undo', finalize: 'finalize',
  setVisibility: 'setVisibility', getOwnedSession: 'getOwnedSession',
} } }));
const clientMatchId = 'private-finish';
const snapshot = { pointsA: 5, pointsB: 3, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 };
beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); });

it('persists explicit private evidence after create succeeds and publication fails, and finish makes no live calls', async () => {
  h.create.mockResolvedValue({ matchId: 'private-server', token: 'PRIVATE' });
  h.setVisibility.mockRejectedValue(new Error('publication failed'));
  const hook = renderHook(() => useLiveBroadcast({ enabled: true }));
  await act(async () => { await hook.result.current.goLive({ clientMatchId, sport: 'football', scorecardKind: 'goals',
    teamA: { name: 'Alpha' }, teamB: { name: 'Beta' }, snapshot }); });
  await act(async () => { await flushLiveSession(clientMatchId, h); });
  expect(hook.result.current.error?.message).toBe('publication failed');
  const privateSession = loadSession(clientMatchId);
  Object.values(h).forEach(mock => mock.mockClear());
  await act(async () => { await hook.result.current.finalize({ resultType: 'abandoned', snapshot }); });
  expect(loadSession(clientMatchId)).not.toHaveProperty('finalizeIntent');
  expect(load()).toEqual([]);
  Object.values(h).forEach(mock => expect(mock).not.toHaveBeenCalled());
  expect(privateSession).toMatchObject({ matchId: 'private-server', isShared: false });
  hook.unmount();
});

it.each([false, undefined])('stored recovery requires positive sharing evidence before finalizing (isShared: %s)', async isShared => {
  saveSession(clientMatchId, { matchId: 'private-server', seq: 1, ...(isShared === undefined ? {} : { isShared }),
    finalizeIntent: { resultType: 'abandoned' } });
  await flushLiveSession(clientMatchId, h);
  Object.values(h).forEach(mock => expect(mock).not.toHaveBeenCalled());
});
