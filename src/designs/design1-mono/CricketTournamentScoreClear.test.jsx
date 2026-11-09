import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonoCricketTournament from './MonoCricketTournament';
import { liveClientMatchId } from '../../lib/live/liveSession';

const storageKey = 'se_cricket';
const teams = ['A', 'B', 'C', 'D'].map(id => ({ id, name: `Team ${id}` }));
const format = { formatMode: 'custom', overs: 20, players: 11, ballsPerOver: 6 };
const saved = () => JSON.parse(localStorage.getItem(storageKey))[0];
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));

function result(test = false, overrides = {}) {
  return {
    id: 'm1', team1Id: 'A', team2Id: 'B', status: 'completed', resultType: 'decided',
    winner: 'A', winDesc: test ? 'Team A won by 10 runs' : 'Team A won by 5 runs',
    completedAt: '2026-11-09T08:00:00Z', startedAt: '2026-11-09T07:00:00Z',
    endedAt: '2026-11-09T08:00:00Z', elapsedSeconds: 3600,
    score1: 100, score2: 95,
    team1Score: test ? null : { runs: 100, wickets: 4, balls: 120 },
    team2Score: test ? null : { runs: 95, wickets: 10, balls: 117 },
    innings: test ? [
      { teamId: 'A', runs: 100, wickets: 10, balls: 120 },
      { teamId: 'B', runs: 90, wickets: 10, balls: 115 },
      { teamId: 'A', runs: 80, wickets: 10, balls: 100 },
      { teamId: 'B', runs: 80, wickets: 10, balls: 99 },
    ] : null,
    guidedInnings: test ? null : [{ deliveries: [{ batsmanRuns: 4 }] }, { deliveries: [] }],
    currentInningsIndex: test ? 3 : 1, followOnEnforced: test,
    superOver: { team1: { runs: 8, balls: 6 }, team2: { runs: 7, balls: 6 } },
    draftState: { phase: 'result', history: [{ runs: 94 }] },
    clientMatchId: 'old-completion', syncOwnerId: 'scorer',
    sync: { status: 'synced', completionId: 'old-result' },
    format: test ? { ...format, totalInnings: 4 } : format,
    ...overrides,
  };
}

function mount(matches, overrides = {}) {
  const tournament = {
    id: 'tour-1', name: 'Cricket Cup', mode: 'tournament', type: 'round-robin',
    format, teams, matches, phase: 'group', winnerMode: 'table-topper',
    knockoutConfig: null, knockoutMatches: [], ...overrides,
  };
  localStorage.setItem(storageKey, JSON.stringify([tournament]));
  return render(<MemoryRouter initialEntries={['/cricket/tournament/tour-1']}>
    <Routes><Route path="/:sport/tournament/:id" element={<MonoCricketTournament />} /></Routes>
  </MemoryRouter>);
}

function expectCleared(match) {
  expect(match).toMatchObject({
    status: 'pending', winner: null, score1: null, score2: null,
    team1Score: null, team2Score: null, innings: null, guidedInnings: null,
    followOnEnforced: false, superOver: null,
  });
  for (const field of [
    'resultType', 'winDesc', 'completedAt', 'startedAt', 'endedAt', 'elapsedSeconds',
    'draftState', 'currentInningsIndex', 'clientMatchId', 'syncOwnerId', 'sync',
  ]) expect(match[field], field).toBeUndefined();
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('cricket tournament Clear safety', () => {
  it.each([false, true])('confirms, cancels, clears and restores the exact finished result (Test=%s)', async test => {
    const match = result(test);
    mount([match]);
    const original = saved();
    const baseId = 'cricket:tour-1:m1';
    const originalLiveId = liveClientMatchId(baseId);

    click('Clear');
    expect(screen.getByRole('alert')).toHaveTextContent('Clear the saved score for Team A vs Team B?');
    expect(saved()).toEqual(original);
    expect(liveClientMatchId(baseId)).toBe(originalLiveId);
    click('Cancel');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(saved()).toEqual(original);
    expect(liveClientMatchId(baseId)).toBe(originalLiveId);

    click('Clear');
    click('Confirm clear score for Team A vs Team B');
    await waitFor(() => expectCleared(saved().matches[0]));
    expect(liveClientMatchId(baseId)).not.toBe(originalLiveId);
    expect(screen.getByRole('status')).toHaveTextContent('Cleared the saved score for Team A vs Team B.');
    click('Undo clear score');
    await waitFor(() => expect(saved()).toEqual(original));
    expect(screen.queryByRole('button', { name: 'Undo clear score' })).not.toBeInTheDocument();
  });

  it.each([false, true])('clears and reseeds the pending knockout bracket on Undo (source links=%s)', async linked => {
    const semi1 = result(false, { id: 'semi-1', label: 'Semi-final 1', round: 'semi-1' });
    const semi2 = result(false, { id: 'semi-2', label: 'Semi-final 2', round: 'semi-2', team1Id: 'C', team2Id: 'D', winner: 'D' });
    const sources = linked ? { sourceMatchIds: ['semi-1', 'semi-2'], sourceSlots: ['team1Id', 'team2Id'] } : {};
    mount([], {
      type: 'knockout', phase: 'knockout', winnerMode: 'knockouts',
      knockoutConfig: { teamsAdvancing: 4, thirdPlaceMatch: true, format },
      knockoutMatches: [semi1, semi2,
        { id: 'final', round: 'final', label: 'Final', team1Id: 'A', team2Id: 'D', status: 'pending', team1Score: null, team2Score: null, ...sources },
        { id: 'third', round: 'third-place', label: '3rd Place', team1Id: 'B', team2Id: 'C', status: 'pending', team1Score: null, team2Score: null, ...sources },
      ],
    });
    const original = saved();
    const semiCard = screen.getByText('Semi-final 1').closest('.kit-fx');
    fireEvent.click(within(semiCard).getByRole('button', { name: 'Clear', exact: true }));
    click('Confirm clear score for Team A vs Team B');
    await waitFor(() => {
      const bracket = saved().knockoutMatches;
      expectCleared(bracket[0]);
      expect(bracket[1]).toEqual(semi2);
      expect(bracket.slice(2).map(m => [m.team1Id, m.team2Id])).toEqual([[null, null], [null, null]]);
    });
    click('Undo clear score');
    await waitFor(() => expect(saved()).toEqual(original));
    expect(liveClientMatchId('cricket:tour-1:semi-1')).toContain(':generation:');
  });
});
