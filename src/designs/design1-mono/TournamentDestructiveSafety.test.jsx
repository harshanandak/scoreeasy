import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MonoTournamentList from './MonoTournamentList';
import GenericGoalsTournament from './GenericGoalsTournament';
import GenericSetsTournament from './GenericSetsTournament';
import MonoCricketTournament from './MonoCricketTournament';
import MonoTournamentSetup from './MonoTournamentSetup';

const VOLLEYBALL_KEY = 'se_volleyball';
const FOOTBALL_KEY = 'se_football';

function seedStorage(key, tournaments) {
  globalThis.localStorage.setItem(key, JSON.stringify(tournaments));
}

function readTournaments(key) {
  const raw = globalThis.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function clickButton(name) {
  fireEvent.click(screen.getByRole('button', { name }));
}

async function expectButtonRemovedAfterClick(clickName, removedName) {
  clickButton(clickName);
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: removedName })).not.toBeInTheDocument();
  });
}

function baseTeams() {
  return [
    { id: 'team-a', name: 'Team A' },
    { id: 'team-b', name: 'Team B' },
  ];
}

function pendingMatch(overrides = {}) {
  return {
    id: 'match-1',
    team1Id: 'team-a',
    team2Id: 'team-b',
    status: 'pending',
    ...overrides,
  };
}

function completedSetsMatch(overrides = {}) {
  return pendingMatch({
    status: 'completed',
    winner: 'team-a',
    sets: [{ score1: 25, score2: 20, completed: true }],
    ...overrides,
  });
}

function completedGoalsMatch(overrides = {}) {
  return pendingMatch({
    status: 'completed',
    winner: 'team-a',
    score1: 3,
    score2: 1,
    ...overrides,
  });
}

function tournament(overrides = {}) {
  return {
    id: 'tour-1',
    mode: 'tournament',
    name: 'League Night',
    teams: baseTeams(),
    matches: [pendingMatch()],
    ...overrides,
  };
}

function renderRoute(initialEntry, routePath, element) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderRouteWithLocation(initialEntry, routePath, element) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderRouteWithJump({ element, initialEntry, label, routePath, to }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RouteJump label={label} to={to} />
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function RouteJump({ label, to }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      {label}
    </button>
  );
}

RouteJump.propTypes = {
  label: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
};

describe('tournament destructive safety', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores a deleted tournament from the tournament list', async () => {
    seedStorage(VOLLEYBALL_KEY, [tournament()]);

    renderRoute('/volleyball/tournament', '/:sport/tournament', <MonoTournamentList />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete League Night tournament' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete League Night tournament' }));

    await waitFor(() => {
      expect(readTournaments(VOLLEYBALL_KEY)).toHaveLength(0);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Deleted League Night.');
    expect(screen.getByRole('button', { name: 'Undo delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));

    await waitFor(() => {
      expect(readTournaments(VOLLEYBALL_KEY)).toHaveLength(1);
    });
    expect(screen.getByText('League Night')).toBeInTheDocument();
  });

  it('scores the next ready tournament match directly from the tournament list', async () => {
    seedStorage(VOLLEYBALL_KEY, [
      tournament({
        matches: [
          completedSetsMatch({ id: 'match-1' }),
          pendingMatch({ id: 'match-2', sets: [] }),
        ],
      }),
    ]);

    renderRouteWithLocation('/volleyball/tournament', '/:sport/tournament', <MonoTournamentList />);

    fireEvent.click(await screen.findByRole('button', { name: 'Score next match - League Night' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/volleyball/tournament/tour-1/match/match-2/score');
  });

  it('uses saved team names or team objects in the next-match label', async () => {
    seedStorage(VOLLEYBALL_KEY, [
      tournament({
        teams: [{ id: 'team-b', name: 'Bravo' }],
        matches: [
          pendingMatch({
            id: 'match-2',
            team1Id: undefined,
            team2Id: undefined,
            team1: 'Alpha',
            team2: { id: 'team-b', name: 'Bravo' },
            sets: [],
          }),
        ],
      }),
    ]);

    renderRouteWithLocation('/volleyball/tournament', '/:sport/tournament', <MonoTournamentList />);

    expect(await screen.findByText('Next: Alpha vs Bravo')).toBeInTheDocument();
  });

  it('opens tournament results when every tournament match is complete', async () => {
    seedStorage(VOLLEYBALL_KEY, [
      tournament({
        matches: [completedSetsMatch({ id: 'match-1' })],
      }),
    ]);

    renderRouteWithLocation('/volleyball/tournament', '/:sport/tournament', <MonoTournamentList />);

    fireEvent.click(await screen.findByRole('button', { name: 'View results - League Night' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/volleyball/tournament/tour-1');
  });

  it('shows waiting brackets as incomplete instead of complete', async () => {
    seedStorage(VOLLEYBALL_KEY, [
      tournament({
        matches: [],
        knockoutMatches: [
          pendingMatch({
            id: 'final',
            label: 'Final',
            team1Id: undefined,
            team2Id: undefined,
            sets: [],
          }),
        ],
      }),
    ]);

    renderRouteWithLocation('/volleyball/tournament', '/:sport/tournament', <MonoTournamentList />);

    const waitingLabel = await screen.findByText('Bracket waiting for teams');
    expect(waitingLabel).toHaveStyle({ color: '#92400e' });
    expect(screen.getByRole('button', { name: 'View bracket - League Night' })).toBeInTheDocument();
  });

  it('creates a single-elimination tournament with a seeded bracket', async () => {
    renderRoute('/volleyball/tournament/new', '/:sport/tournament/new', <MonoTournamentSetup />);

    fireEvent.change(await screen.findByLabelText('Tournament name'), {
      target: { value: 'Elimination Night' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Elimination' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Match Rules' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Name Teams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Review & Start' }));

    expect(screen.getByText('Single elimination')).toBeInTheDocument();
    expect(screen.getByText('Semi-final 1')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start Tournament' }));

    await waitFor(() => {
      const [saved] = readTournaments(VOLLEYBALL_KEY);
      expect(saved).toMatchObject({
        name: 'Elimination Night',
        type: 'knockout',
        phase: 'knockout',
        winnerMode: 'knockouts',
      });
      expect(saved.matches).toHaveLength(0);
      expect(saved.knockoutMatches).toHaveLength(3);
      expect(saved.knockoutMatches[0]).toMatchObject({
        label: 'Semi-final 1',
        team1Id: expect.any(String),
        team2Id: expect.any(String),
      });
    });
  });

  it('clears playoff rule overrides when switching to elimination', async () => {
    renderRoute('/volleyball/tournament/new', '/:sport/tournament/new', <MonoTournamentSetup />);

    fireEvent.change(await screen.findByLabelText('Tournament name'), {
      target: { value: 'Clean Elimination' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Group + Playoffs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Match Rules' }));
    fireEvent.click(screen.getByLabelText('Use different rules for playoffs'));
    fireEvent.click(screen.getByRole('button', { name: 'Single set' }));
    fireEvent.click(screen.getByRole('button', { name: '10 pts' }));

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Elimination' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Match Rules' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Name Teams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Review & Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Tournament' }));

    await waitFor(() => {
      const [saved] = readTournaments(VOLLEYBALL_KEY);
      expect(saved).toMatchObject({
        name: 'Clean Elimination',
        type: 'knockout',
        phase: 'knockout',
      });
      expect(saved.knockoutConfig.format).toEqual(saved.format);
      expect(saved.knockoutConfig.format).not.toMatchObject({ type: 'single', points: 10 });
    });
  });

  it('resets hidden elimination bracket size before saving round-robin playoffs', async () => {
    renderRoute('/volleyball/tournament/new', '/:sport/tournament/new', <MonoTournamentSetup />);

    fireEvent.change(await screen.findByLabelText('Tournament name'), {
      target: { value: 'Clamped Playoffs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Elimination' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Round-robin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Match Rules' }));
    fireEvent.click(screen.getByRole('button', { name: 'Playoffs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Name Teams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Review & Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Tournament' }));

    await waitFor(() => {
      const [saved] = readTournaments(VOLLEYBALL_KEY);
      expect(saved).toMatchObject({
        name: 'Clamped Playoffs',
        type: 'round-robin',
        winnerMode: 'knockouts',
      });
      expect(saved.knockoutConfig).toMatchObject({
        mode: 'group-playoff',
        teamsAdvancing: 2,
      });
    });
  });

  it('shows recovery actions when a cricket tournament link is stale', async () => {
    renderRoute('/cricket/tournament/missing', '/:sport/tournament/:id', <MonoCricketTournament />);

    expect(await screen.findByText('Tournament not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tournaments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('drops tournament delete undo state when switching sports', async () => {
    seedStorage(VOLLEYBALL_KEY, [tournament()]);
    seedStorage(FOOTBALL_KEY, []);

    renderRouteWithJump({
      element: <MonoTournamentList />,
      initialEntry: '/volleyball/tournament',
      label: 'Switch sport',
      routePath: '/:sport/tournament',
      to: '/football/tournament',
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete League Night tournament' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete League Night tournament' }));
    expect(screen.getByRole('button', { name: 'Undo delete' })).toBeInTheDocument();

    await expectButtonRemovedAfterClick('Switch sport', 'Undo delete');
    expect(readTournaments(FOOTBALL_KEY)).toHaveLength(0);
  });

  it('confirms and undoes clearing a sets tournament score', async () => {
    seedStorage(VOLLEYBALL_KEY, [
      tournament({
        name: 'Sets League',
        format: { sets: 3 },
        matches: [completedSetsMatch()],
      }),
    ]);

    renderRoute('/volleyball/tournament/tour-1', '/:sport/tournament/:id', <GenericSetsTournament />);

    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));

    expect(screen.getByText('Clear the saved score for Team A vs Team B?')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear score for Team A vs Team B' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Undo clear score' })).toBeInTheDocument();
    });
    expect(readTournaments(VOLLEYBALL_KEY)[0].matches[0].sets).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Undo clear score' }));

    await waitFor(() => {
      expect(readTournaments(VOLLEYBALL_KEY)[0].matches[0].sets).toHaveLength(1);
    });
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('drops score-clear undo state when switching tournament ids', async () => {
    seedStorage(VOLLEYBALL_KEY, [
      tournament({
        name: 'Sets League',
        format: { sets: 3 },
        matches: [completedSetsMatch()],
      }),
      tournament({
        id: 'tour-2',
        name: 'Second League',
        format: { sets: 3 },
        matches: [pendingMatch({ sets: [] })],
      }),
    ]);

    renderRouteWithJump({
      element: <GenericSetsTournament />,
      initialEntry: '/volleyball/tournament/tour-1',
      label: 'Switch tournament',
      routePath: '/:sport/tournament/:id',
      to: '/volleyball/tournament/tour-2',
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear score for Team A vs Team B' }));
    expect(screen.getByRole('button', { name: 'Undo clear score' })).toBeInTheDocument();

    await expectButtonRemovedAfterClick('Switch tournament', 'Undo clear score');
    expect(screen.getByText('Second League')).toBeInTheDocument();
  });

  it('confirms and undoes clearing a goals tournament score', async () => {
    seedStorage(FOOTBALL_KEY, [
      tournament({
        name: 'Goals League',
        matches: [completedGoalsMatch()],
      }),
    ]);

    renderRoute('/football/tournament/tour-1', '/:sport/tournament/:id', <GenericGoalsTournament />);

    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear score for Team A vs Team B' }));

    await waitFor(() => {
      expect(readTournaments(FOOTBALL_KEY)[0].matches[0].score1).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Undo clear score' }));

    await waitFor(() => {
      expect(readTournaments(FOOTBALL_KEY)[0].matches[0].score1).toBe(3);
    });
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
