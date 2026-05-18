import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonoTournamentList from './MonoTournamentList';
import GenericGoalsTournament from './GenericGoalsTournament';
import GenericSetsTournament from './GenericSetsTournament';

const VOLLEYBALL_KEY = 'se_volleyball';
const FOOTBALL_KEY = 'se_football';

function seedStorage(key, tournaments) {
  globalThis.localStorage.setItem(key, JSON.stringify(tournaments));
}

function readTournaments(key) {
  const raw = globalThis.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function baseTeams() {
  return [
    { id: 'team-a', name: 'Team A' },
    { id: 'team-b', name: 'Team B' },
  ];
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
    seedStorage(VOLLEYBALL_KEY, [
      {
        id: 'tour-1',
        mode: 'tournament',
        name: 'League Night',
        teams: baseTeams(),
        matches: [{ id: 'match-1', team1Id: 'team-a', team2Id: 'team-b', status: 'pending' }],
      },
    ]);

    renderRoute('/volleyball/tournament', '/:sport/tournament', <MonoTournamentList />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete League Night tournament' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete League Night tournament' }));

    await waitFor(() => {
      expect(readTournaments(VOLLEYBALL_KEY)).toHaveLength(0);
    });
    expect(screen.getByRole('button', { name: 'Undo delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));

    await waitFor(() => {
      expect(readTournaments(VOLLEYBALL_KEY)).toHaveLength(1);
    });
    expect(screen.getByText('League Night')).toBeInTheDocument();
  });

  it('confirms and undoes clearing a sets tournament score', async () => {
    seedStorage(VOLLEYBALL_KEY, [
      {
        id: 'tour-1',
        name: 'Sets League',
        teams: baseTeams(),
        format: { sets: 3 },
        matches: [
          {
            id: 'match-1',
            team1Id: 'team-a',
            team2Id: 'team-b',
            status: 'completed',
            winner: 'team-a',
            sets: [{ score1: 25, score2: 20, completed: true }],
          },
        ],
      },
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

  it('confirms and undoes clearing a goals tournament score', async () => {
    seedStorage(FOOTBALL_KEY, [
      {
        id: 'tour-1',
        name: 'Goals League',
        teams: baseTeams(),
        matches: [
          {
            id: 'match-1',
            team1Id: 'team-a',
            team2Id: 'team-b',
            status: 'completed',
            winner: 'team-a',
            score1: 3,
            score2: 1,
          },
        ],
      },
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
