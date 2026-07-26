import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { makeFormat, createInnings, applyDelivery, makeDelivery } from '../../../utils/cricketEngine.js';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import MonoCricketGuidedScorerRoute, { mirrorAggregate } from './MonoCricketGuidedScorerRoute.jsx';

// Play a sequence of raw delivery fields through the engine, returning the innings.
function play(format, deliveries) {
  let inn = createInnings({
    striker: 'p1',
    nonStriker: 'p2',
    bowler: 'b1',
    playersPerSide: format.playersPerSide,
  });
  for (const d of deliveries) inn = applyDelivery(inn, makeDelivery(d), format);
  return inn;
}

describe('mirrorAggregate (pure persistence bridge)', () => {
  it('maps runs, wickets, and legal balls from a played innings', () => {
    const fmt = makeFormat({ playersPerSide: 11 });
    // single, four, dot, wide(1). Wide is NOT a legal ball.
    const innings = play(fmt, [
      { batsmanRuns: 1 },
      { batsmanRuns: 4 },
      { batsmanRuns: 0 },
      { extras: [{ type: 'wide', runs: 1 }] },
    ]);
    // fmt here is the migrateCricketFormat shape ({ players } not { playersPerSide }).
    expect(mirrorAggregate(innings, { players: 11 })).toEqual({
      runs: 6,
      wickets: 0,
      balls: 3,
      allOut: false,
    });
  });

  it('flags allOut at (players - 1) wickets', () => {
    const fmt = makeFormat({ playersPerSide: 3 });
    // 3-a-side => all out at 2 wickets.
    const innings = play(fmt, [
      { wicket: { type: 'bowled', out: 'p1', incoming: 'p3' } },
      { wicket: { type: 'bowled', out: 'p3', incoming: null } },
    ]);
    const agg = mirrorAggregate(innings, { players: 3 });
    expect(agg.wickets).toBe(2);
    expect(agg.balls).toBe(2);
    expect(agg.allOut).toBe(true);
  });

  it('does NOT flag allOut at (players - 1) when lastManStands is set', () => {
    const fmt = makeFormat({ playersPerSide: 3 });
    const innings = play(fmt, [
      { wicket: { type: 'bowled', out: 'p1', incoming: 'p3' } },
      { wicket: { type: 'bowled', out: 'p3', incoming: null } },
    ]);
    // lastManStands raises the all-out threshold to `players` (3), so 2 wkts is not out.
    const agg = mirrorAggregate(innings, { players: 3, lastManStands: true });
    expect(agg.wickets).toBe(2);
    expect(agg.allOut).toBe(false);
  });

  it('honors playersPerSide fallback when the migrated shape is absent', () => {
    const fmt = makeFormat({ playersPerSide: 2 });
    const innings = play(fmt, [{ wicket: { type: 'bowled', out: 'p1', incoming: null } }]);
    // engine-shape format ({ playersPerSide: 2 }) => all out at 1 wicket.
    expect(mirrorAggregate(innings, { playersPerSide: 2 }).allOut).toBe(true);
  });
});

describe('MonoCricketGuidedScorerRoute (render + persistence smoke)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function seedTournament() {
    saveSportTournament('se_cricket', {
      id: 1,
      name: 'Test Cup',
      format: { overs: 20, players: 11, formatMode: 'custom' },
      matches: [
        {
          id: 'm1',
          team1Id: 'A',
          team2Id: 'B',
          format: { guided: true, overs: 20, players: 11 },
          status: 'pending',
          striker: 'Rohit',
          nonStriker: 'Kohli',
          bowler: 'Bumrah',
        },
      ],
      knockoutMatches: [],
    });
  }

  function renderRoute() {
    return render(
      <MemoryRouter initialEntries={['/cricket/tournament/1/score/m1']}>
        <Routes>
          <Route
            path="/:sport/tournament/:id/score/:matchId"
            element={<MonoCricketGuidedScorerRoute />}
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders the guided scorer for a seeded match at 0/0', () => {
    seedTournament();
    renderRoute();
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/0');
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Rohit');
  });

  it('persists guidedInnings + the batting aggregate after a scored ball', () => {
    seedTournament();
    renderRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));

    const match = loadSportTournaments('se_cricket')[0].matches[0];
    expect(match.status).toBe('in-progress');
    expect(match.draftState.guidedInnings).toBeTruthy();
    expect(match.draftState.guidedInnings.deliveries).toHaveLength(1);
    // team1 (A) is batting (innings 1) => team1Score mirrors the aggregate.
    expect(match.team1Score).toEqual({ runs: 4, wickets: 0, balls: 1, allOut: false });
  });

  it('shows the recovery fallback when the match is missing', () => {
    // No seed -> tournament/match not found.
    renderRoute();
    expect(screen.getByText('Match not found')).toBeInTheDocument();
  });
});
