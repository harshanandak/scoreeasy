import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { contrastReport, deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { isTeamColourTournamentSport } from '../../../models/sportRegistry';

const h = vi.hoisted(() => ({
  sport: 'volleyball', navigate: vi.fn(), save: vi.fn(() => Promise.resolve()),
  live: { point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), isLive: true },
  bar: null,
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ sport: h.sport, id: '1', matchId: 'm1' }), useNavigate: () => h.navigate }));
vi.mock('convex/react', () => ({ useMutation: () => h.save }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => h.live }));
vi.mock('../../../lib/live/liveSession', () => ({ getConsent: () => 'accepted' }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: (props) => { h.bar = props; return <button>Broadcast controls</button>; } }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));
import MonoSetsLiveScore from './MonoSetsLiveScore';

const set = (score1, score2, completed = false) => ({ score1, score2, completed });
function seed({ sets = [set(0, 0)], currentSet = 0, history = [], knockout = false, teams, mode = 'rally' } = {}) {
  const match = { id: 'm1', team1Id: 1, team2Id: 2, status: 'in-progress',
    draftState: { sets, currentSet, history, servingTeam: 1, scoringMode: mode } };
  saveSportTournament(`se_${h.sport}`, { id: 1, name: 'Club Cup',
    teams: teams || [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
    format: { type: 'best-of', sets: 3, points: 25, scoringModes: ['rally', 'side-out'] },
    matches: knockout ? [] : [match], knockoutMatches: knockout ? [match] : [],
    knockoutConfig: { format: { type: 'best-of', sets: 3, points: 25 } },
  });
}
const saved = () => loadSportTournaments(`se_${h.sport}`)[0];
const key = (name = 'Alpha') => screen.getByRole('button', { name: `Add point for ${name}` });
const tap = (name) => { act(() => { vi.advanceTimersByTime(160); fireEvent.click(key(name)); }); };
const options = () => fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); h.sport = 'volleyball';
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00Z')); seed();
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('tournament team-colour presentation', () => {
  it('opts only volleyball tournaments in independently of quick matches', () => {
    expect(isTeamColourTournamentSport('volleyball')).toBe(true);
    for (const sport of ['badminton', 'tabletennis', 'tennis', '__proto__', 'unknown']) expect(isTeamColourTournamentSport(sport)).toBe(false);
  });
  it('scores, autosaves real tournament storage, broadcasts and restores after remount', () => {
    const view = render(<MonoSetsLiveScore />);
    expect(document.querySelector('[data-team-board]')).toBeTruthy();
    tap();
    expect(saved().matches[0].draftState.sets).toEqual([set(1, 0)]);
    expect(h.live.point).toHaveBeenCalledWith(expect.objectContaining({ value: 1, snapshot: expect.objectContaining({ pointsA: 1 }) }));
    expect(screen.getByText('back to 0–0 · Set 1')).toBeTruthy();
    view.unmount(); render(<MonoSetsLiveScore />);
    expect(key().textContent).toContain('1');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(saved().matches[0].draftState.sets).toEqual([set(0, 0)]);
    expect(h.live.undo).toHaveBeenCalledWith(expect.objectContaining({ snapshot: expect.objectContaining({ pointsA: 0 }) }));
  });
  it('advances a won set and undo restores the winning-point snapshot, including after refresh', () => {
    seed({ sets: [set(24, 20)] });
    const view = render(<MonoSetsLiveScore />);
    expect(screen.getByText('Set point · Alpha')).toBeTruthy();
    tap();
    expect(saved().matches[0].draftState.sets).toEqual([set(25, 20, true), set(0, 0)]);
    expect(screen.getByText('Set 2 of 3')).toBeTruthy();
    expect(screen.getByText('back to 24–20 · Set 1')).toBeTruthy();
    view.unmount(); render(<MonoSetsLiveScore />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(saved().matches[0].draftState).toMatchObject({ currentSet: 0, sets: [set(24, 20)] });
    expect(screen.getByText('Set 1 of 3')).toBeTruthy();
  });
  it('preserves knockout completion, explicit Finish, sync and result navigation', () => {
    seed({ knockout: true, currentSet: 1, sets: [set(25, 12, true), set(24, 20)] });
    render(<MonoSetsLiveScore />);
    expect(screen.getByText('Match point · Alpha')).toBeTruthy(); tap();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(key().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(saved().knockoutMatches[0]).toMatchObject({ status: 'completed', winner: 1, setsWon1: 2, setsWon2: 0 });
    expect(saved().knockoutMatches[0].draftState).toBeUndefined();
    expect(h.save).toHaveBeenCalledTimes(1); expect(h.live.finalize).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith('/volleyball/tournament/1/match/m1/result', { replace: true });
  });
  it('can undo a match-winning point before Finish', () => {
    seed({ currentSet: 1, sets: [set(25, 12, true), set(24, 20)] }); render(<MonoSetsLiveScore />); tap();
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expect(key().disabled).toBe(false);
    expect(saved().matches[0].draftState.sets[1]).toEqual(set(24, 20));
  });
  it('Finish on an unfinished match keeps the draft and returns to the tournament', () => {
    render(<MonoSetsLiveScore />); tap(); fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(saved().matches[0]).toMatchObject({ status: 'in-progress', draftState: { sets: [set(1, 0)] } });
    expect(h.navigate).toHaveBeenCalledWith('/volleyball/tournament/1');
    expect(h.live.finalize).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
  });
  it('uses the same colour fallback and honours existing tournament team colours with mark contrast', () => {
    const teams = [{ id: 1, name: 'Alpha', color: '#facc15' }, { id: 2, name: 'Beta', color: '#1d4ed8' }];
    seed({ teams }); render(<MonoSetsLiveScore />);
    const colours = deriveTeamColours(teams[0].color, teams[1].color);
    expect(document.querySelector('[data-team-board]').style.getPropertyValue('--team-a-core')).toBe(teamColourVars(colours)['--team-a-core']);
    expect(contrastReport(colours).every(([, ratio, minimum]) => ratio >= minimum)).toBe(true);
  });
  it('uses the quick board default pair when tournament teams have no colour', () => {
    render(<MonoSetsLiveScore />);
    const defaults = teamColourVars(deriveTeamColours());
    const style = document.querySelector('[data-team-board]').style;
    for (const [token, value] of Object.entries(defaults)) expect(style.getPropertyValue(token)).toBe(value);
    expect(contrastReport(deriveTeamColours()).every(([, ratio, minimum]) => ratio >= minimum)).toBe(true);
  });
  it('keeps the tournament win-by-two rule beyond 30 and derives its cue from that rule', () => {
    seed({ sets: [set(29, 29)] }); render(<MonoSetsLiveScore />); tap();
    expect(saved().matches[0].draftState.sets).toEqual([set(30, 29)]);
    expect(screen.getByText('Set point · Alpha')).toBeTruthy();
    tap(); expect(saved().matches[0].draftState.sets).toEqual([set(31, 29, true), set(0, 0)]);
  });
  it('keeps mode, serve switches, corrections, swaps, Live and discard reachable', () => {
    const view = render(<MonoSetsLiveScore />); options();
    expect(screen.getByRole('button', { name: 'Broadcast controls' })).toBeTruthy();
    fireEvent.click(screen.getByTitle('Toggle scoring model'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' })); tap('Beta');
    expect(h.live.point).toHaveBeenLastCalledWith(expect.objectContaining({ value: 0, type: 'serve_change', snapshot: expect.objectContaining({ servingTeam: 'B' }) }));
    tap('Beta'); options();
    act(() => vi.advanceTimersByTime(160));
    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Beta' }));
    expect(saved().matches[0].draftState.sets[0]).toEqual(set(0, 0));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect(document.querySelector('.tsb-key').dataset.team).toBe('b');
    options(); fireEvent.click(screen.getByRole('button', { name: 'Discard match' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(key().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    expect(key().disabled).toBe(false);
    options(); fireEvent.click(screen.getByRole('button', { name: 'Discard match' }));
    // Real route navigation unmounts the scorer before another autosave effect.
    h.navigate.mockImplementationOnce(() => view.unmount());
    fireEvent.click(screen.getByRole('button', { name: 'Discard', exact: true }));
    expect(saved().matches[0].draftState).toBeUndefined();
    expect(h.navigate).toHaveBeenCalledWith('/volleyball/tournament/1');
  });
  it.each(['badminton', 'tabletennis'])('keeps %s on the original tournament board', sport => {
    h.sport = sport; seed(); render(<MonoSetsLiveScore />);
    expect(document.querySelector('[data-team-board]')).toBeNull();
    expect(document.querySelectorAll('.mono-arena-half')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Swap' })).toBeTruthy();
  });
});
