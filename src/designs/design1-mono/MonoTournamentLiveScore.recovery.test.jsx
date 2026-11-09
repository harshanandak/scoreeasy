import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonoTournamentLiveScore from './MonoTournamentLiveScore';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
// A started fixture whose draft makes the sets scorer throw while rendering.
vi.mock('./scoring/MonoSetsLiveScore', () => ({
  default: () => { throw new Error('corrupt draftState'); },
}));

function seedTournament() {
  localStorage.setItem('se_volleyball', JSON.stringify([{
    id: 't1', name: 'Club Cup', teams: [{ id: 'a', name: 'Aces' }, { id: 'b', name: 'Bees' }, { id: 'c', name: 'Cats' }],
    matches: [
      { id: 'm1', team1Id: 'a', team2Id: 'b', status: 'in-progress', draftState: { sets: [null] } },
      { id: 'm2', team1Id: 'a', team2Id: 'c', status: 'in-progress', draftState: { vScore1: 2, vScore2: 1 } },
    ],
  }]));
}

describe('a crashed tournament scorer can discard its own fixture', () => {
  let assign;
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    assign = vi.fn();
    vi.stubGlobal('location', { ...globalThis.location, assign, reload: vi.fn() });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('offers Discard; confirming resets only that fixture and goes Home', () => {
    seedTournament();
    render(<MemoryRouter initialEntries={['/volleyball/tournament/t1/match/m1/score']}>
      <Routes><Route path="/:sport/tournament/:id/match/:matchId/score" element={<MonoTournamentLiveScore />} /></Routes>
    </MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Scoring screen crashed');
    fireEvent.click(screen.getByRole('button', { name: /^Discard this match.*Aces v Bees/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    const [tournament] = JSON.parse(localStorage.getItem('se_volleyball'));
    expect(tournament.matches[0]).toEqual(expect.objectContaining({ id: 'm1', status: 'pending' }));
    expect(tournament.matches[0].draftState).toBeUndefined();
    expect(tournament.matches[1]).toEqual(expect.objectContaining({ id: 'm2', status: 'in-progress', draftState: { vScore1: 2, vScore2: 1 } }));
    expect(assign).toHaveBeenCalledWith('/app');
  });
});
