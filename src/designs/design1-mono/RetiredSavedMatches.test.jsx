import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoHistory from './MonoHistory';
import { getAppEntryTarget, loadAppEntryState, loadInProgressMatches } from '../../utils/appEntry';

export const retiredDraft = {
  sport: 'pickleball', phase: 'scoring', team1Name: 'Dinks', team2Name: 'Lobs',
  format: { type: 'single', target: 11 }, vScore1: 10, vScore2: 7,
  currentSet: 0, servingTeam: 2,
  vScoreHistory: [{ vScore1: 9, vScore2: 7, team: 1 }],
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function seedTournament(sport = 'pickleball', match = {}) {
  localStorage.setItem(`se_${sport}`, JSON.stringify([{
    id: 'cup', name: 'Saved Cup', format: { type: 'best-of', sets: 3 },
    teams: [{ id: 'a', name: 'Dinks' }, { id: 'b', name: 'Lobs' }],
    matches: [{ id: 'm1', team1Id: 'a', team2Id: 'b', currentSet: 1,
      sets: [{ score1: 11, score2: 8, completed: true }, { score1: 10, score2: 7 }],
      scoreHistory: [{ currentSet: 1, sets: [{ score1: 11, score2: 8, completed: true }, { score1: 9, score2: 7 }] }],
      ...match }],
  }]));
}

function renderHistory(path = '/history') {
  return render(<MemoryRouter initialEntries={[path]}><MonoHistory /></MemoryRouter>);
}

describe('retired saved matches', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (callback) => { callback(0); return 1; });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('shows an old stranded draft at its saved 10–7 score without scoring, expiry or writes', async () => {
    localStorage.setItem('se_quickmatch_draft_pickleball', JSON.stringify(retiredDraft));
    const before = { ...localStorage };
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    renderHistory();
    const group = await screen.findByRole('region', { name: 'Unfinished, retired sport' });
    const row = within(group).getByRole('button', { name: 'View details: Dinks vs Lobs' });
    expect(row).toHaveTextContent('10 - 7');
    fireEvent.click(row);
    expect(screen.getByText('This sport is retired; scoring is off')).toBeInTheDocument();
    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.getByText('Serving: Lobs')).toBeInTheDocument();
    expect(screen.getByText('9 - 7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume|Rematch|Undo|Delete|score a point/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect({ ...localStorage }).toEqual(before);
    expect(loadInProgressMatches()).toEqual([]);
  });

  it('shows unfinished retired tournament sets and history without migrating old-format storage', async () => {
    seedTournament();
    const before = localStorage.getItem('se_pickleball');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    renderHistory();
    const group = await screen.findByRole('region', { name: 'Unfinished, retired sport' });
    fireEvent.click(within(group).getByRole('button', { name: 'View details: Dinks vs Lobs' }));
    expect(screen.getByText('Set 2')).toBeInTheDocument();
    expect(screen.getByText('11 - 8')).toBeInTheDocument();
    expect(screen.getAllByText('10 - 7').length).toBeGreaterThan(0);
    expect(screen.getByText('9 - 7')).toBeInTheDocument();
    expect(screen.queryByText(/won$/)).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('se_pickleball')).toBe(before);
  });

  it('shows saved goal-sport period and score history', async () => {
    seedTournament('futsal', { sets: undefined, currentSet: undefined, score1: 2, score2: 1,
      currentPeriod: 2, scoreHistory: [{ score1: 1, score2: 1 }] });
    renderHistory();
    fireEvent.click(await screen.findByRole('button', { name: 'View details: Dinks vs Lobs' }));
    expect(screen.getByText('Period 2')).toBeInTheDocument();
    expect(screen.getByText('1 - 1')).toBeInTheDocument();
  });

  it('counts retired-only tournament history for signed-out entry without resuming it or writing', () => {
    seedTournament('pickleball', { status: 'completed', winner: 'a' });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const state = loadAppEntryState();
    expect(state).toEqual({ draftEntryPath: null, returningPlayerState: true });
    expect(getAppEntryTarget({ ...state, isAuthenticated: false })).toBe('/app');
    expect(loadInProgressMatches()).toEqual([]);
    expect(write).not.toHaveBeenCalled();
  });

  it('counts a retired-only old draft as saved data without making it resumable', () => {
    localStorage.setItem('se_quickmatch_draft_pickleball', JSON.stringify(retiredDraft));
    expect(loadAppEntryState()).toEqual({ draftEntryPath: null, returningPlayerState: true });
    expect(loadInProgressMatches()).toEqual([]);
  });

  it('keeps retired shared records intact while clearing active quick history', async () => {
    const retired = { id: 'archived', sport: 'pickleball', team1: 'Old A', team2: 'Old B',
      score1: 11, score2: 7, winner: 'Old A', completedAt: '2026-01-01T10:00:00.000Z' };
    const draft = { id: 'archived-draft', sport: 'squash', status: 'in-progress',
      team1: 'Squash A', team2: 'Squash B', score1: 10, score2: 7, updatedAt: '2026-01-01T10:00:00.000Z' };
    localStorage.setItem('se_quickmatches', JSON.stringify([retired, draft, {
      id: 'active-sport', sport: 'football', team1: 'Reds', team2: 'Blues', score1: 2, score2: 1,
      winner: 'Reds', status: 'completed', completedAt: '2026-10-01T10:00:00.000Z',
    }]));
    renderHistory();
    fireEvent.click(await screen.findByRole('button', { name: 'Clear local history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual([retired, draft]);
    fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Quick', exact: true }));
    expect(screen.getByText('Old A vs Old B')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete match Old A/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all quick stats' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('se_quickmatches'))).toEqual([retired, draft]);
  });

  it('reads a single-set tournament score and a goals draft history as persisted', async () => {
    seedTournament('pickleball', { currentSet: 0, format: { type: 'single' },
      sets: [{ score1: 10, score2: 7 }] });
    localStorage.setItem('se_quickmatch_draft_futsal', JSON.stringify({
      sport: 'futsal', phase: 'scoring', team1Name: 'Goal A', team2Name: 'Goal B',
      gScore1: 3, gScore2: 1, vScoreHistory: [], gScoreHistory: [{ team: 1, value: 1 }],
    }));
    renderHistory();
    const row = await screen.findByRole('button', { name: 'View details: Dinks vs Lobs' });
    expect(row).toHaveTextContent('10 - 7');
    fireEvent.click(screen.getByRole('button', { name: 'View details: Goal A vs Goal B' }));
    expect(screen.getByText('Goal A +1')).toBeInTheDocument();
  });

  it('reads tournament draftState ahead of the last finished-set snapshot', async () => {
    seedTournament('pickleball', {
      currentSet: undefined, sets: [{ score1: 11, score2: 8, completed: true }],
      scoreHistory: undefined,
      draftState: { currentSet: 1, servingTeam: 1,
        sets: [{ score1: 11, score2: 8, completed: true }, { score1: 10, score2: 7, completed: false }],
        history: [{ currentSet: 1, sets: [{ score1: 11, score2: 8, completed: true }, { score1: 9, score2: 7 }] }],
      },
    });
    const saved = localStorage.getItem('se_pickleball');
    renderHistory();
    const row = await screen.findByRole('button', { name: 'View details: Dinks vs Lobs' });
    expect(row).toHaveTextContent('10 - 7');
    fireEvent.click(row);
    expect(screen.getByText('Set 2')).toBeInTheDocument();
    expect(screen.getByText('9 - 7')).toBeInTheDocument();
    expect(localStorage.getItem('se_pickleball')).toBe(saved);
  });

  it.each(['pickleball', 'squash', 'rugby', 'futsal', 'handball'])('reads %s tournament progress without storage writes or resume', async (sport) => {
    const setsSport = sport === 'pickleball' || sport === 'squash';
    seedTournament(sport, { status: 'in-progress', sets: undefined, currentSet: undefined,
      draftState: setsSport
        ? { currentSet: 0, sets: [{ score1: 10, score2: 7 }], history: [] }
        : { score1: 10, score2: 7, history: [] },
    });
    const before = { ...localStorage };
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    renderHistory();
    const row = await screen.findByRole('button', { name: 'View details: Dinks vs Lobs' });
    expect(row).toHaveTextContent('10 - 7');
    fireEvent.click(row);
    expect(screen.getByText('This sport is retired; scoring is off')).toBeInTheDocument();
    expect(loadInProgressMatches()).toEqual([]);
    expect(getAppEntryTarget(loadAppEntryState())).toBe('/app');
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect({ ...localStorage }).toEqual(before);
  });
});
