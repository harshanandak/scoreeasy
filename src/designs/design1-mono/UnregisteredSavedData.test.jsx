import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoHistory from './MonoHistory';
import DashboardLanding from './landing/DashboardLanding';
import { getAppEntryTarget, loadAppEntryState, loadInProgressMatches } from '../../utils/appEntry';
import { loadData, loadQuickMatches, loadSportTournaments } from '../../utils/storage';

vi.mock('convex/react', () => ({ useQuery: () => [], useMutation: () => vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ cloudAuthAvailable: false, isAuthenticated: false, user: null }),
}));

const unregisteredSports = ['pickleball', 'squash', 'rugby', 'futsal', 'handball', 'curling'];

function seedUnsupported(sport) {
  const match = { id: sport, sport, status: 'completed', team1: 'Removed A', team2: 'Removed B',
    score1: 10, score2: 7, winner: 'Removed A', completedAt: '2026-10-22T10:00:00Z' };
  localStorage.setItem('se_quickmatches', JSON.stringify([match, null, 'broken', { sport }]));
  localStorage.setItem(`se_quickmatch_draft_${sport}`, JSON.stringify({
    ...match, phase: 'scoring', status: 'in-progress', sets: [null], gScoreHistory: [null],
  }));
  localStorage.setItem(`se_${sport}`, JSON.stringify([
    { id: 'broken', sport, teams: [null], matches: { malformed: true } },
    { id: 'cup', sport, matches: [match] },
  ]));
}

function show(Component) {
  return render(<MemoryRouter><Component /></MemoryRouter>);
}

describe('unregistered saved data is ignored at the load boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (callback) => { callback(0); return 1; });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each(unregisteredSports)('ignores %s on History and stats reads; collection saves may drop ignored rows', async (sport) => {
    seedUnsupported(sport);
    const before = { ...localStorage };
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    show(MonoHistory);
    expect(await screen.findByText('No match history yet')).toBeInTheDocument();
    expect(screen.queryByText(/Removed A|Removed B/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
    expect(screen.getByText(/No game data yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Removed A|Removed B/)).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect({ ...localStorage }).toEqual(before);
  });

  it.each(unregisteredSports)('excludes %s and malformed peers from Home', async (sport) => {
    seedUnsupported(sport);
    show(DashboardLanding);
    expect(await screen.findByText('Play your first match.')).toBeInTheDocument();
    expect(screen.queryByText(/Removed A|Removed B/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume|rematch/i })).not.toBeInTheDocument();
  });

  it.each(unregisteredSports)('does not count %s or malformed peers as returning-player state', (sport) => {
    seedUnsupported(sport);
    expect(loadInProgressMatches()).toEqual([]);
    expect(loadAppEntryState()).toEqual({ draftEntryPath: null, returningPlayerState: false });
    expect(getAppEntryTarget(loadAppEntryState())).toBe('/marketing');
  });

  it('filters a mismatched draft and mixed rows while keeping registered matches and generic data', () => {
    const active = { id: 'active', sport: 'football', status: 'completed', score1: 2, score2: 1, winner: 'A' };
    seedUnsupported('pickleball');
    localStorage.setItem('se_quickmatches', JSON.stringify([
      null, [], false, { id: 'bad', sport: { malformed: true } },
      { id: 'prototype', sport: 'toString' }, { id: 'old', sport: 'pickleball' }, active,
    ]));
    localStorage.setItem('se_quickmatch_draft_cricket', JSON.stringify({ sport: 'futsal', phase: 'scoring' }));
    localStorage.setItem('ordinary-data', JSON.stringify([null, { sport: 'pickleball' }]));
    const before = { ...localStorage };
    expect(loadData('se_quickmatches', [])).toEqual([active]);
    expect(loadQuickMatches().map((match) => match.id)).toEqual(['active']);
    expect(loadData('se_quickmatch_draft_cricket')).toBeNull();
    expect(loadData('ordinary-data')).toEqual([null, { sport: 'pickleball' }]);
    expect({ ...localStorage }).toEqual(before);
  });

  it('ignores sport-tagged legacy sessions and history without inspecting malformed payloads', () => {
    for (const key of ['gs_sessions', 'gs_history']) {
      localStorage.setItem(key, JSON.stringify(unregisteredSports.map((sport) => ({
        id: sport, sport, status: 'active', participants: null, finalScores: null,
      }))));
      expect(loadData(key, [])).toEqual([]);
    }
    expect(loadAppEntryState().returningPlayerState).toBe(false);
    show(MonoHistory);
    expect(screen.getByText('No match history yet')).toBeInTheDocument();
  });

  it('rejects invalid legacy envelopes without requiring a sport on object records', () => {
    for (const key of ['gs_sessions', 'gs_history']) {
      localStorage.setItem(key, JSON.stringify([null, [], 'broken', {}, { id: 'unknown' }]));
      expect(loadData(key, [])).toEqual([{}, { id: 'unknown' }]);
    }
  });

  it('adapts tournament formats in memory on read; collection saves may drop ignored rows', () => {
    localStorage.setItem('se_volleyball', JSON.stringify([
      { id: 'ignored', sport: 'pickleball', teams: [null], matches: { malformed: true } },
      { id: 'active', format: { type: 'single' }, teams: [], matches: [] }, null,
    ]));
    const before = localStorage.getItem('se_volleyball');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(loadSportTournaments('se_volleyball')).toEqual([
      expect.objectContaining({ id: 'active', format: expect.objectContaining({ formatMode: 'custom' }) }),
    ]);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.getItem('se_volleyball')).toBe(before);
  });
});
