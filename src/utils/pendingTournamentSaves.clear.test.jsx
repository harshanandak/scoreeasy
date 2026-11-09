import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { useTournamentScoreClear } from '../designs/design1-mono/hooks/useTournamentScoreClear';
import { buildTournamentConvexPayload } from './tournamentSync';
import { loadSportTournaments, saveSportTournament } from './storage';

const owner = 'clear-replay-owner';
const cases = [
  { label: 'sets', scoreKind: 'sets', sport: 'volleyball' },
  { label: 'goals', scoreKind: 'goals', sport: 'football' },
  { label: 'limited overs', scoreKind: 'cricket', sport: 'cricket' },
  { label: 'Test', scoreKind: 'cricket', sport: 'cricket', test: true },
];

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(cases)('$label Clear preserves a saved account result across reload and keeps a different replay local only', async ({ scoreKind, sport, test }) => {
  const storageKey = `se_${sport}`;
  const reference = { storageKey, tournamentId: 100, matchId: 'm1' };
  const format = scoreKind === 'cricket'
    ? { formatMode: 'custom', overs: test ? null : 20, totalInnings: test ? 4 : 2, players: 11 }
    : { formatMode: 'custom', sets: 1, type: 'single' };
  const match = {
    id: 'm1', team1Id: 'A', team2Id: 'B', status: 'completed', resultType: 'decided',
    winner: 'A', completedAt: '2026-11-09T08:00:00Z', format,
    ...(scoreKind === 'sets' ? { sets: [{ score1: 25, score2: 20, completed: true }] }
      : scoreKind === 'goals' ? { score1: 2, score2: 1 }
        : test ? { innings: [{ teamId: 'A', runs: 100, wickets: 10, balls: 120 }, { teamId: 'B', runs: 90, wickets: 10, balls: 120 }], winDesc: 'Alpha won by 10 runs' }
          : { team1Score: { runs: 100, wickets: 4, balls: 120 }, team2Score: { runs: 90, wickets: 10, balls: 120 } }),
  };
  const original = { id: 100, format, teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }], matches: [match], knockoutMatches: [] };
  saveSportTournament(storageKey, original);
  const firstPayload = buildTournamentConvexPayload({ sportId: sport, tournament: original, match });
  let queue = await import('./pendingMatchSaves');
  const first = queue.enqueueMatchSave(owner, firstPayload, undefined, reference);
  const saveFirst = vi.fn().mockResolvedValue('existing-account-match');
  expect(await queue.attemptMatchSave(first, saveFirst)).toMatchObject({ status: 'synced' });
  expect(saveFirst).toHaveBeenCalledExactlyOnceWith({ ...firstPayload, expectedOwnerId: owner });
  expect(queue.pendingMatchSaves(owner)).toEqual([]);

  // A reload leaves only the fixture's durable acknowledgement, as in the scorer's next visit.
  vi.resetModules();
  queue = await import('./pendingMatchSaves');
  expect(queue.isMatchSaveConfirmed(owner, firstPayload.clientMatchId, first.completionId)).toBe(false);
  const { result, unmount } = renderHook(() => {
    const [tournament, setTournament] = useState(() => loadSportTournaments(storageKey)[0]);
    useEffect(() => { saveSportTournament(storageKey, tournament); }, [tournament]);
    const clear = useTournamentScoreClear({ scoreKind, tournament, setTournament,
      teams: tournament.teams, tournamentScopeKey: `${sport}:100` });
    return { ...clear, tournament };
  });
  act(() => result.current.requestScoreClear(result.current.tournament.matches[0]));
  act(() => result.current.confirmScoreClear());
  const cleared = loadSportTournaments(storageKey)[0];
  expect(cleared.matches[0].status).toBe('pending');
  unmount();

  const replay = {
    ...cleared.matches[0], status: 'completed', resultType: 'decided', winner: 'B',
    completedAt: '2026-11-09T10:00:00Z',
    ...(scoreKind === 'sets' ? { sets: [{ score1: 20, score2: 25, completed: true }] }
      : scoreKind === 'goals' ? { score1: 0, score2: 3 }
        : test ? { innings: [{ teamId: 'A', runs: 80, wickets: 10, balls: 120 }, { teamId: 'B', runs: 81, wickets: 2, balls: 90 }], winDesc: 'Beta won by 8 wickets' }
          : { team1Score: { runs: 80, wickets: 10, balls: 120 }, team2Score: { runs: 81, wickets: 2, balls: 90 } }),
  };
  const replayTournament = { ...cleared, matches: [replay] };
  saveSportTournament(storageKey, replayTournament);
  const payload = buildTournamentConvexPayload({ sportId: sport, tournament: replayTournament, match: replay });
  expect(payload.clientMatchId).toBe(firstPayload.clientMatchId);
  const record = queue.enqueueMatchSave(owner, payload, undefined, reference);
  expect(record.completionId).not.toBe(first.completionId);
  const saveReplay = vi.fn().mockResolvedValue('existing-account-match');
  expect(await queue.attemptMatchSave(record, saveReplay, () => true, true)).toMatchObject({ status: 'failed' });
  expect(saveReplay).not.toHaveBeenCalled();
  expect(queue.pendingMatchSaves(owner)).toEqual([expect.objectContaining({ state: 'failed', terminal: true, priorCompletionSaved: true })]);
  expect(loadSportTournaments(storageKey)[0].matches[0]).toMatchObject({
    winner: 'B', completedAt: replay.completedAt, sync: { status: 'failed', completionId: record.completionId },
  });
  expect(queue.isMatchSaveConfirmed(owner, payload.clientMatchId, record.completionId)).toBe(false);
});
