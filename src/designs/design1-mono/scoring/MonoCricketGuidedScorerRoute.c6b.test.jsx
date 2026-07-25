import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  makeFormat,
  createInnings,
  applyDelivery,
  makeDelivery,
} from '../../../utils/cricketEngine.js';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import MonoCricketGuidedScorerRoute, {
  nextPhase,
  computeTarget,
  resolveWinner,
  mirrorAggregate,
} from './MonoCricketGuidedScorerRoute.jsx';

// Play raw delivery fields through the engine, returning the finished innings.
function play(format, deliveries, seed = {}) {
  let inn = createInnings({
    striker: 'p1',
    nonStriker: 'p2',
    bowler: 'b1',
    playersPerSide: format.playersPerSide,
    ...seed,
  });
  for (const d of deliveries) inn = applyDelivery(inn, makeDelivery(d), format);
  return inn;
}

// ============================================================
// PURE helpers — the phase state machine + target + winner
// ============================================================

describe('nextPhase (phase state machine)', () => {
  it('walks setup1 -> innings1 -> break -> innings2 -> done', () => {
    expect(nextPhase('setup1')).toBe('innings1');
    expect(nextPhase('innings1')).toBe('break');
    expect(nextPhase('break')).toBe('innings2');
    expect(nextPhase('innings2')).toBe('done');
  });

  it('saturates at done for the terminal / unknown phases', () => {
    expect(nextPhase('done')).toBe('done');
    expect(nextPhase('nonsense')).toBe('done');
  });
});

describe('computeTarget', () => {
  it('is the first-innings total plus one', () => {
    expect(computeTarget(0)).toBe(1);
    expect(computeTarget(120)).toBe(121);
  });

  it('coerces a missing total to 1', () => {
    expect(computeTarget(undefined)).toBe(1);
    expect(computeTarget(null)).toBe(1);
  });
});

describe('resolveWinner', () => {
  const base = { team1Id: 'A', team2Id: 'B', battingOrder: ['A', 'B'], format: { players: 11 } };

  it('names the chasing team + "won by wickets" when the chase succeeds', () => {
    const { winner, winDesc } = resolveWinner({
      ...base,
      team1Score: { runs: 120, wickets: 8, balls: 120, allOut: false },
      team2Score: { runs: 121, wickets: 4, balls: 118, allOut: false },
    });
    expect(winner).toBe('B');
    expect(winDesc).toBe('Won by 6 wickets');
  });

  it('names the defending team + "won by runs" when the chase falls short', () => {
    const { winner, winDesc } = resolveWinner({
      ...base,
      team1Score: { runs: 150, wickets: 6, balls: 120, allOut: false },
      team2Score: { runs: 140, wickets: 10, balls: 120, allOut: true },
    });
    expect(winner).toBe('A');
    expect(winDesc).toBe('Won by 10 runs');
  });

  it('reports a tie when the scores are level', () => {
    const { winner, winDesc } = resolveWinner({
      ...base,
      team1Score: { runs: 100, wickets: 10, balls: 120, allOut: true },
      team2Score: { runs: 100, wickets: 10, balls: 120, allOut: true },
    });
    expect(winner).toBe('tie');
    expect(winDesc).toBe('Match Tied');
  });
});

// ============================================================
// Orchestration — with the real engine + localStorage store
// ============================================================

const ROUTE = '/:sport/tournament/:id/score/:matchId';
const ENTRY = '/cricket/tournament/1/score/m1';

function seed(matchOverrides = {}, tournamentOverrides = {}) {
  saveSportTournament('se_cricket', {
    id: 1,
    name: 'Test Cup',
    format: { overs: 20, players: 11, formatMode: 'custom' },
    teams: [
      { id: 'A', name: 'Alpha', members: ['Rohit', 'Kohli', 'Gill'] },
      { id: 'B', name: 'Bravo', members: ['Bumrah', 'Shami', 'Siraj'] },
    ],
    matches: [
      {
        id: 'm1',
        team1Id: 'A',
        team2Id: 'B',
        battingOrder: ['A', 'B'],
        format: { guided: true, overs: 20, players: 11 },
        status: 'pending',
        ...matchOverrides,
      },
    ],
    knockoutMatches: [],
    ...tournamentOverrides,
  });
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={[ENTRY]}>
      <Routes>
        <Route path={ROUTE} element={<MonoCricketGuidedScorerRoute />} />
      </Routes>
    </MemoryRouter>
  );
}

const currentMatch = () => loadSportTournaments('se_cricket')[0].matches[0];

describe('MonoCricketGuidedScorerRoute — two-innings orchestration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at the opening-lineup step when no openers are seeded', () => {
    seed();
    renderRoute();
    expect(screen.getByTestId('innings-setup')).toBeInTheDocument();
    expect(screen.getByText('Opening lineup')).toBeInTheDocument();
  });

  it('innings-1 completion transitions to the break and sets target = runs + 1', () => {
    // Seed innings 1 already at the all-out boundary (2-a-side, 1 wicket) so the
    // scorer fires onComplete on mount and the route advances to the break.
    const fmt = makeFormat({ playersPerSide: 2 });
    const doneInnings = play(fmt, [
      { wicket: { type: 'bowled', out: 'p1', incoming: null } },
    ]);
    seed({
      format: { guided: true, overs: 20, players: 2 },
      status: 'in-progress',
      draftState: {
        phase: 'innings1',
        openers1: { striker: 'Rohit', nonStriker: 'Kohli', bowler: 'Bumrah' },
        guidedInnings: doneInnings,
      },
    });

    renderRoute();

    const m = currentMatch();
    expect(m.draftState.phase).toBe('break');
    // 0 runs in innings 1 -> target 1.
    expect(m.draftState.target).toBe(1);
    // Alpha (battingOrder[0]) aggregate frozen into team1Score.
    expect(m.team1Score).toEqual({ runs: 0, wickets: 1, balls: 1, allOut: true });
  });

  it('the break screen names the chasing team and the target', () => {
    seed({
      status: 'in-progress',
      team1Score: { runs: 120, wickets: 7, balls: 120, allOut: false },
      draftState: { phase: 'break', target: 121, innings1: { deliveries: [] } },
    });

    renderRoute();

    const banner = screen.getByTestId('innings-break');
    expect(banner).toHaveTextContent('Innings break');
    // Bravo (battingOrder[1]) is chasing.
    expect(banner).toHaveTextContent('Bravo');
    expect(banner).toHaveTextContent('121');
    // The innings-2 lineup step is shown below the banner.
    expect(screen.getByTestId('innings-setup')).toBeInTheDocument();
  });

  it('rehydrates a draftState.phase="innings2" into the chase with the target', () => {
    const fmt = makeFormat({ playersPerSide: 11 });
    // A dot ball keeps Bumrah on strike (a single would rotate it).
    const chaseInnings = play(
      fmt,
      [{ batsmanRuns: 0 }],
      { striker: 'Bumrah', nonStriker: 'Shami', bowler: 'Rohit', target: 121 }
    );
    seed({
      status: 'in-progress',
      team1Score: { runs: 120, wickets: 7, balls: 120, allOut: false },
      draftState: {
        phase: 'innings2',
        target: 121,
        openers2: { striker: 'Bumrah', nonStriker: 'Shami', bowler: 'Rohit' },
        guidedInnings: chaseInnings,
      },
    });

    renderRoute();

    // The chase banner (target-bearing) proves innings 2 resumed with the target.
    expect(screen.getByTestId('chase-need')).toBeInTheDocument();
    expect(screen.getByText(/Chasing 121/)).toBeInTheDocument();
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Bumrah');
  });

  it('innings-2 completion finalizes the match with a winner via resolveWinner', () => {
    // Seed innings 2 already past a target of 1 so onComplete (chased) fires on
    // mount and the match is finalized.
    const fmt = makeFormat({ playersPerSide: 11 });
    const chasedInnings = play(
      fmt,
      [{ batsmanRuns: 1 }],
      { striker: 'Bumrah', nonStriker: 'Shami', bowler: 'Rohit', target: 1 }
    );
    seed({
      status: 'in-progress',
      team1Score: { runs: 0, wickets: 1, balls: 1, allOut: true },
      draftState: {
        phase: 'innings2',
        target: 1,
        openers2: { striker: 'Bumrah', nonStriker: 'Shami', bowler: 'Rohit' },
        guidedInnings: chasedInnings,
      },
    });

    renderRoute();

    const m = currentMatch();
    expect(m.status).toBe('completed');
    // Bravo (battingOrder[1]) chased 1 and won by wickets.
    expect(m.winner).toBe('B');
    expect(m.winDesc).toContain('wicket');
    expect(m.draftState).toBeUndefined();
    // Chasing aggregate landed in team2Score.
    expect(m.team2Score.runs).toBe(1);
  });

  it('mirrorAggregate stays a pure bridge (regression with the migrated shape)', () => {
    const fmt = makeFormat({ playersPerSide: 11 });
    const innings = play(fmt, [{ batsmanRuns: 4 }, { batsmanRuns: 0 }]);
    expect(mirrorAggregate(innings, { players: 11 })).toEqual({
      runs: 4,
      wickets: 0,
      balls: 2,
      allOut: false,
    });
  });
});
