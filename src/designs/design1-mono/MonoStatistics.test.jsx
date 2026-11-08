import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MonoStatisticsPanel } from './MonoStatistics';

const QUICK_MATCHES_KEY = 'se_quickmatches';
const FOOTBALL_KEY = 'se_football';

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

function seedFootballCup() {
  globalThis.localStorage.setItem(FOOTBALL_KEY, JSON.stringify([{
    id: 'cup',
    name: 'City Cup',
    format: { mode: 'timed' },
    teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }],
    knockoutMatches: [],
    matches: [{ id: 'm1', team1Id: 'A', team2Id: 'B', status: 'completed', winner: 'A', score1: 3, score2: 1 }],
  }]));
}

function readQuickMatches() {
  const raw = globalThis.localStorage.getItem(QUICK_MATCHES_KEY);
  return raw ? JSON.parse(raw) : [];
}

function renderStatistics() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <Routes>
        <Route path="/history" element={<MonoStatisticsPanel />} />
        <Route path="/play" element={<p>Play hub</p>} />
      </Routes>
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

  it('opens the Play hub (not a fixed sport) from the empty-state quick-match CTA', async () => {
    renderStatistics();
    fireEvent.click(await screen.findByRole('button', { name: 'Start quick match' }));
    expect(screen.getByText('Play hub')).toBeInTheDocument();
  });

  it('leads the empty Stats view with one Kit empty state and a single start action', async () => {
    // No quick matches and no tournaments seeded → no-data state.
    renderStatistics();

    // Action-first: one title, one CTA, no second button and no tab row to switch between nothing.
    expect(await screen.findByRole('heading', { name: 'No stats yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start quick match' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create tournament' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    // The zero-value Performance/Records/Totals grids must NOT render.
    expect(screen.queryByText('Performance')).not.toBeInTheDocument();
    expect(screen.queryByText('Records')).not.toBeInTheDocument();
    expect(screen.queryByText('Totals')).not.toBeInTheDocument();
    expect(screen.queryByText('Tournaments')).not.toBeInTheDocument();
    expect(screen.queryByText('Top team')).not.toBeInTheDocument();
  });

  it('switches between Overview, sports and Quick with Kit filter chips that carry the selection', async () => {
    seedQuickMatches();
    seedFootballCup();
    renderStatistics();

    const tablist = await screen.findByRole('tablist', { name: 'Statistics categories' });
    const overview = within(tablist).getByRole('tab', { name: 'Overview' });
    expect(overview).toHaveClass('kit-fchip');
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Football', 'Quick']);

    fireEvent.click(within(tablist).getByRole('tab', { name: 'Football' }));
    expect(within(tablist).getByRole('tab', { name: 'Football' })).toHaveAttribute('aria-selected', 'true');
    expect(within(tablist).getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: 'Football' })).toBeInTheDocument();
  });

  it('opens a sport tab from its By sport row on the Overview', async () => {
    seedQuickMatches();
    seedFootballCup();
    renderStatistics();

    fireEvent.click(await screen.findByRole('button', { name: /^Football/ }));
    expect(screen.getByRole('tab', { name: 'Football' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: 'Football team statistics' })).toBeInTheDocument();
  });

  it('lists the last five winners newest first', async () => {
    seedQuickMatches();
    renderStatistics();

    const form = await screen.findByRole('list', { name: 'Last 5 form' });
    expect(within(form).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Falcons', 'Falcons', 'Sharks', 'Draw']);
  });

  it('keeps every sport-tab stat, with Win% last, in an accessible table that fits a phone', async () => {
    seedFootballCup();
    renderStatistics();
    fireEvent.click(await screen.findByRole('tab', { name: 'Football' }));

    const table = screen.getByRole('table', { name: 'Football team statistics' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent))
      .toEqual(['Team', 'Played', 'Won', 'Lost', 'For', 'Against', 'Avg margin', 'Win rate']);
    const alpha = within(table).getByRole('row', { name: /^Alpha/ });
    expect(within(alpha).getByRole('rowheader')).toHaveTextContent('Alpha');
    const cells = within(alpha).getAllByRole('cell');
    expect(cells).toHaveLength(7);
    expect(cells[6].textContent).toMatch(/^\d+%$/);
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
    expect(screen.getByRole('status')).toHaveTextContent('Quick stat restored.');

    fireEvent.click(screen.getByRole('button', { name: 'Clear all quick stats' }));
    expect(screen.getByText('Clear all quick stats?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    await waitFor(() => {
      expect(readQuickMatches()).toHaveLength(0);
    });
    expect(screen.getByRole('tab', { name: 'Quick' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo clear' })).toBeInTheDocument();
  });

  it('reconciles overview counters with completed quick and tournament records only', async () => {
    globalThis.localStorage.setItem(
      QUICK_MATCHES_KEY,
      JSON.stringify([
        {
          id: 'active-draft',
          sport: 'football',
          sportName: 'Football',
          team1: 'Draft A',
          team2: 'Draft B',
          status: 'in-progress',
          updatedAt: '2026-05-18T12:00:00.000Z',
          score1: 1,
          score2: 0,
        },
        {
          id: 'phantom-tie',
          sport: 'football',
          sportName: 'Football',
          team1: 'Ghost A',
          team2: 'Ghost B',
          status: 'completed',
          winner: 'Tie',
          score1: 0,
          score2: 0,
          completedAt: '2026-05-18T12:00:00.000Z',
        },
        {
          id: 'quick-real',
          sport: 'football',
          sportName: 'Football',
          team1: 'Quick A',
          team2: 'Quick B',
          status: 'completed',
          winner: 'Quick A',
          score1: 3,
          score2: 2,
          completedAt: '2026-05-18T12:00:00.000Z',
        },
      ]),
    );
    globalThis.localStorage.setItem(
      FOOTBALL_KEY,
      JSON.stringify([
        {
          id: 'cup',
          name: 'City Cup',
          teams: [
            { id: 't1', name: 'Tigers' },
            { id: 't2', name: 'Lions' },
            { id: 't3', name: 'Bears' },
            { id: 't4', name: 'Wolves' },
          ],
          matches: [
            { id: 'group-1', team1Id: 't1', team2Id: 't2', score1: 2, score2: 1, status: 'completed', winner: 't1' },
            { id: 'group-2', team1Id: 't3', team2Id: 't4', score1: null, score2: null, status: 'pending' },
          ],
          knockoutMatches: [
            { id: 'final', team1Id: 't1', team2Id: 't3', score1: 4, score2: 3, status: 'completed', winner: 't1' },
          ],
        },
      ]),
    );

    renderStatistics();

    expect(await screen.findByText('Tournaments')).toBeInTheDocument();
    expect(screen.getByText('Tournaments').closest('.kit-stat')).toHaveTextContent('1');
    expect(screen.getByText('Matches').closest('.kit-stat')).toHaveTextContent('3');
    expect(screen.getByText('Teams').closest('.kit-stat')).toHaveTextContent('6');
    expect(screen.queryByText('Draft A')).not.toBeInTheDocument();
    expect(screen.queryByText('Ghost A')).not.toBeInTheDocument();
  });

  it('keeps statistics visual states readable, on Kit parts and on tokens', () => {
    const source = readFileSync(`${import.meta.dirname}/MonoStatistics.jsx`, 'utf8');
    const css = readFileSync(`${import.meta.dirname}/kit/stats.css`, 'utf8');

    expect(source).not.toMatch(/[âð�]/);
    // Kit S4 rule (History and Profile): secondary text and fills come from tokens, never a literal.
    const literal = /#[0-9a-f]{3,8}\b|rgba?\(/i;
    expect(source).not.toMatch(literal);
    expect(css).not.toMatch(literal);
    // No old Mono block buttons, hard-shadow cards or emoji icons.
    expect(source).not.toMatch(/mono-(btn|card|tab|stat|table|data|divider|muted|subtle|action|score)/);
    expect(source).not.toMatch(/icon="(\p{Extended_Pictographic})/u);
    expect(source).toContain('kit/stats.css');
    expect(source).toContain('Start quick match');
  });
});
