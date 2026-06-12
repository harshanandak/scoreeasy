import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import MonoHistory from './MonoHistory';

const QUICK_MATCHES_KEY = 'se_quickmatches';
const OLDER_HISTORY_KEY = 'gs_history';

function seedQuickMatch(matches = [
  {
    id: 'match-1',
    sport: 'volleyball',
    team1: 'Team A',
    team2: 'Team B',
    score1: 25,
    score2: 22,
    winner: 'Team A',
    elapsedSeconds: 645,
    completedAt: '2026-05-18T12:00:00.000Z',
  },
]) {
  globalThis.localStorage.setItem(
    QUICK_MATCHES_KEY,
    JSON.stringify(matches),
  );
}

function seedOlderHistoryMatch() {
  globalThis.localStorage.setItem(
    OLDER_HISTORY_KEY,
    JSON.stringify([
      {
        id: 'older-match-1',
        gameName: 'Sunday Court',
        participants: ['North', 'South'],
        finalScores: { North: 21, South: 18 },
        winner: 'North',
        completedAt: '2026-05-18T11:00:00.000Z',
      },
    ]),
  );
}

function readQuickMatches() {
  const raw = globalThis.localStorage.getItem(QUICK_MATCHES_KEY);
  return raw ? JSON.parse(raw) : [];
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{`${location.pathname}${location.search}`}</div>;
}

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <LocationProbe />
      <MonoHistory />
    </MemoryRouter>,
  );
}

describe('MonoHistory', () => {
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

  it('shows an explicit match details affordance and opens details', async () => {
    seedQuickMatch();

    renderHistory();

    const detailsButton = await screen.findByRole('button', { name: 'View details: Team A vs Team B' });
    fireEvent.click(detailsButton);

    expect(screen.getByText('Match details')).toBeInTheDocument();
    expect(screen.getAllByText('Team A vs Team B').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeInTheDocument();
  });

  it('requires confirmation before deleting a quick match and supports undo', async () => {
    seedQuickMatch();

    renderHistory();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete match Team A vs Team B' }));

    expect(screen.getByText('Delete this quick match?')).toBeInTheDocument();
    expect(readQuickMatches()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(readQuickMatches()).toHaveLength(0);
    });
    expect(screen.getByRole('button', { name: 'Undo delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));

    await waitFor(() => {
      expect(readQuickMatches()).toHaveLength(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Quick match restored.');
  });

  it('uses user-facing local history language for clear-all recovery', async () => {
    seedQuickMatch();
    seedOlderHistoryMatch();

    renderHistory();

    expect(await screen.findByText('Sunday Court')).toBeInTheDocument();
    expect(screen.queryByText(/legacy/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear local history' }));

    expect(screen.getByText('Clear local history?')).toBeInTheDocument();
    expect(screen.queryByText(/legacy/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Local history cleared.');
    });
    expect(screen.getByRole('button', { name: 'Undo clear' })).toBeInTheDocument();
  });

  it('filters history by search, sport, result, and date order', async () => {
    seedQuickMatch([
      {
        id: 'match-1',
        sport: 'volleyball',
        team1: 'Falcons',
        team2: 'Sharks',
        score1: 25,
        score2: 23,
        winner: 'Falcons',
        elapsedSeconds: 645,
        completedAt: '2026-05-18T12:00:00.000Z',
      },
      {
        id: 'match-2',
        sport: 'cricket',
        team1: 'Riders',
        team2: 'Kings',
        score1: 151,
        score2: 140,
        winner: 'Riders',
        elapsedSeconds: 1800,
        completedAt: '2026-05-17T12:00:00.000Z',
      },
      {
        id: 'match-3',
        sport: 'football',
        team1: 'City',
        team2: 'United',
        score1: 2,
        score2: 2,
        winner: 'Draw',
        elapsedSeconds: 5400,
        completedAt: '2026-05-16T12:00:00.000Z',
      },
    ]);

    renderHistory();

    expect(await screen.findByRole('button', { name: 'View details: Falcons vs Sharks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details: Riders vs Kings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details: City vs United' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Find match'), { target: { value: 'riders' } });
    expect(screen.getByRole('button', { name: 'View details: Riders vs Kings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Falcons vs Sharks' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Filter by sport'), { target: { value: 'Football' } });
    fireEvent.change(screen.getByLabelText('Filter by result'), { target: { value: 'draw' } });

    expect(screen.getByRole('button', { name: 'View details: City vs United' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Riders vs Kings' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.change(screen.getByLabelText('Filter by result'), { target: { value: 'close' } });

    expect(screen.getByRole('button', { name: 'View details: Falcons vs Sharks' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Riders vs Kings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: City vs United' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.change(screen.getByLabelText('Sort by date'), { target: { value: 'oldest' } });

    const rows = screen.getAllByRole('button', { name: /^View details:/ });
    expect(rows[0]).toHaveAccessibleName('View details: City vs United');
  });

  it('shows filtered empty recovery and clears discovery filters', async () => {
    seedQuickMatch();

    renderHistory();

    expect(await screen.findByRole('button', { name: 'View details: Team A vs Team B' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Find match'), { target: { value: 'missing team' } });

    expect(screen.getByText('No matches found')).toBeInTheDocument();
    expect(screen.getByText('Try a different search, sport, result, or date filter.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('button', { name: 'View details: Team A vs Team B' })).toBeInTheDocument();
  });

  it('routes empty history to the sport chooser', async () => {
    renderHistory();

    expect(screen.getByText('No match history yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Choose a sport' }));

    expect(screen.getByTestId('current-route')).toHaveTextContent('/play');
  });

  it('keeps the empty state to a single neutral recovery action', () => {
    renderHistory();

    expect(screen.queryByRole('button', { name: /Start Cricket/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tournament' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a sport' })).toBeInTheDocument();
  });

  it('shows only completed quick results and preserves fresh drafts when clearing history', async () => {
    globalThis.localStorage.setItem(
      QUICK_MATCHES_KEY,
      JSON.stringify([
        {
          id: 'active-draft',
          sport: 'football',
          team1: 'Draft A',
          team2: 'Draft B',
          status: 'in-progress',
          updatedAt: new Date().toISOString(),
          score1: 1,
          score2: 0,
        },
        {
          id: 'phantom-tie',
          sport: 'football',
          team1: 'Ghost A',
          team2: 'Ghost B',
          status: 'completed',
          winner: 'Tie',
          score1: 0,
          score2: 0,
          completedAt: '2026-05-18T12:00:00.000Z',
        },
        {
          id: 'real-match',
          sport: 'football',
          team1: 'Real A',
          team2: 'Real B',
          status: 'completed',
          winner: 'Real A',
          score1: 2,
          score2: 1,
          completedAt: '2026-05-18T12:00:00.000Z',
        },
      ]),
    );

    renderHistory();

    expect(await screen.findByRole('button', { name: 'View details: Real A vs Real B' })).toBeInTheDocument();
    const summary = screen.getByLabelText('History summary');
    expect(within(summary).getByText('Quick').parentElement).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: 'View details: Draft A vs Draft B' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Ghost A vs Ghost B' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear local history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(readQuickMatches().map((match) => match.id)).toEqual(['active-draft']);
    });
  });

  it('keeps history rows readable instead of disabled-looking', () => {
    const source = readFileSync(`${import.meta.dirname}/MonoHistory.jsx`, 'utf8');

    expect(source).not.toContain("color: '#bbb'");
    expect(source).not.toContain("color: '#dc2626'");
    expect(source).not.toContain("borderColor: '#dc2626'");
    expect(source).not.toContain("border: '1.5px solid #dc2626'");
    expect(source).toContain('mono-muted-text');
    expect(source).toContain("var(--muted-foreground)");
    expect(source).toContain("var(--foreground)");
  });
});
