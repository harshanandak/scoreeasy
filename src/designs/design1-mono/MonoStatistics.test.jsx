import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoStatistics from './MonoStatistics';

const QUICK_MATCHES_KEY = 'se_quickmatches';

function seedQuickMatches() {
  globalThis.localStorage.setItem(
    QUICK_MATCHES_KEY,
    JSON.stringify([
      {
        id: 'match-1',
        sport: 'volleyball',
        sportName: 'Volleyball',
        team1: 'Falcons',
        team2: 'Sharks',
        score1: 25,
        score2: 20,
        winner: 'Falcons',
        completedAt: '2026-05-18T12:00:00.000Z',
      },
      {
        id: 'match-2',
        sport: 'volleyball',
        sportName: 'Volleyball',
        team1: 'Falcons',
        team2: 'Sharks',
        score1: 25,
        score2: 23,
        winner: 'Falcons',
        completedAt: '2026-05-17T12:00:00.000Z',
      },
      {
        id: 'match-3',
        sport: 'volleyball',
        sportName: 'Volleyball',
        team1: 'Sharks',
        team2: 'Falcons',
        score1: 25,
        score2: 18,
        winner: 'Sharks',
        completedAt: '2026-05-16T12:00:00.000Z',
      },
      {
        id: 'match-4',
        sport: 'football',
        sportName: 'Football',
        team1: 'City',
        team2: 'United',
        score1: 2,
        score2: 2,
        winner: 'Draw',
        completedAt: '2026-05-15T12:00:00.000Z',
      },
    ]),
  );
}

function readQuickMatches() {
  const raw = globalThis.localStorage.getItem(QUICK_MATCHES_KEY);
  return raw ? JSON.parse(raw) : [];
}

function renderStatistics() {
  return render(
    <MemoryRouter initialEntries={['/statistics']}>
      <MonoStatistics />
    </MemoryRouter>,
  );
}

describe('MonoStatistics', () => {
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

  it('summarizes quick-match performance with team, streak, rivalry, and sport insights', async () => {
    seedQuickMatches();

    renderStatistics();

    expect(await screen.findByText('Falcons 2W / 67%')).toBeInTheDocument();
    expect(screen.getByText('Falcons W2')).toBeInTheDocument();
    expect(screen.getByText('Falcons vs Sharks (3 matches)')).toBeInTheDocument();
    expect(screen.getByText('Volleyball (3 matches)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Quick' }));

    expect(screen.getByRole('heading', { name: 'Quick team form' })).toBeInTheDocument();
    const falconsRow = screen.getByRole('row', { name: /Falcons/ });
    expect(falconsRow).toHaveTextContent('67%');
    expect(within(falconsRow).getByText('2')).toBeInTheDocument();
  });

  it('confirms quick stat deletion and clear-all with undo recovery', async () => {
    seedQuickMatches();

    renderStatistics();
    fireEvent.click(await screen.findByRole('tab', { name: 'Quick' }));

    fireEvent.click(screen.getAllByRole('button', { name: /Delete match Falcons vs Sharks/ })[0]);

    expect(screen.getByText('Delete this quick stat?')).toBeInTheDocument();
    expect(readQuickMatches()).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(readQuickMatches()).toHaveLength(3);
    });
    expect(screen.getByRole('button', { name: 'Undo delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));

    await waitFor(() => {
      expect(readQuickMatches()).toHaveLength(4);
    });
    expect(screen.getByText('Quick stat restored.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all quick stats' }));
    expect(screen.getByText('Clear all quick stats?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() => {
      expect(readQuickMatches()).toHaveLength(0);
    });
    expect(screen.getByRole('button', { name: 'Undo clear' })).toBeInTheDocument();
  });
});
