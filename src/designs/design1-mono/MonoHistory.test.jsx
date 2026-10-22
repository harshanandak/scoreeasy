import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import MonoHistory from './MonoHistory';
import { createGameSession, createHistoryRecord, createParticipant } from '../../models/types';

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
  const participants = ['North', 'South'].map(name => createParticipant({ name }));
  const session = createGameSession({ templateId: 'preset_volleyball', name: 'Sunday Court', participants });
  session.scores[participants[0].id].total = 21;
  session.scores[participants[1].id].total = 18;
  session.winner = participants[0].id;
  globalThis.localStorage.setItem(
    OLDER_HISTORY_KEY,
    JSON.stringify([createHistoryRecord(session)]),
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

    const sheet = screen.getByRole('dialog', { name: 'Match details' });
    expect(within(sheet).getByRole('group', { name: 'Team A vs Team B' })).toBeInTheDocument();
    expect(within(sheet).getByText('25–22')).toBeInTheDocument();
    expect(within(sheet).getByText('Team A won')).toBeInTheDocument();

    // Rematch from History carries the pair to quick setup, as Home's does.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Rematch' }));
    expect(screen.getByTestId('current-route')).toHaveTextContent('/volleyball/quick');
  });

  it('closes match details without changing anything', async () => {
    seedQuickMatch();

    renderHistory();

    fireEvent.click(await screen.findByRole('button', { name: 'View details: Team A vs Team B' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Match details' })).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog', { name: 'Match details' })).not.toBeInTheDocument();
    expect(readQuickMatches()).toHaveLength(1);
  });

  it('requires confirmation before deleting a quick match and supports undo', async () => {
    seedQuickMatch();

    renderHistory();

    // Delete lives in the match's details sheet, behind a confirm.
    fireEvent.click(await screen.findByRole('button', { name: 'View details: Team A vs Team B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete match Team A vs Team B' }));

    expect(screen.getByText('Delete this quick match?')).toBeInTheDocument();
    expect(readQuickMatches()).toHaveLength(1);

    // Cancel keeps the match and returns to its details.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeInTheDocument();
    expect(readQuickMatches()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete match Team A vs Team B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(readQuickMatches()).toHaveLength(0);
    });
    expect(screen.queryByRole('dialog', { name: 'Match details' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Quick match deleted.');
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
    const sportChips = screen.getByRole('group', { name: 'Filter by sport' });
    fireEvent.click(within(sportChips).getByRole('button', { name: 'Football' }));
    expect(within(sportChips).getByRole('button', { name: 'Football' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sportChips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Result' })).getByRole('button', { name: 'Draws' }));

    expect(screen.getByRole('button', { name: 'View details: City vs United' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Riders vs Kings' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(sportChips).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(screen.getByRole('group', { name: 'Result' })).getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('button', { name: 'View details: Falcons vs Sharks' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Riders vs Kings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: City vs United' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Sort' })).getByRole('button', { name: 'Oldest' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const types = screen.getByRole('group', { name: 'Match type' });
    expect(within(types).getByRole('button', { name: 'All 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(types).getByRole('button', { name: 'Quick 1' })).toBeInTheDocument();
    expect(within(types).getByRole('button', { name: 'Tournaments 0' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Draft A vs Draft B' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details: Ghost A vs Ghost B' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear local history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(readQuickMatches().map((match) => match.id)).toEqual(['active-draft']);
    });
  });

  it('merges stats into the same section behind a Stats tab', async () => {
    seedQuickMatch();

    renderHistory();

    // Default view is the match list.
    expect(await screen.findByRole('button', { name: 'View details: Team A vs Team B' })).toBeInTheDocument();
    const viewTabs = screen.getByRole('tablist', { name: 'History and statistics views' });
    expect(within(viewTabs).getByRole('tab', { name: 'Matches' })).toBeInTheDocument();

    // Switch to Stats: the aggregate performance view replaces the list.
    fireEvent.click(within(viewTabs).getByRole('tab', { name: 'Stats' }));

    expect(await screen.findByText('Performance')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Top team')).toBeInTheDocument();
    // The match list is hidden while viewing Stats.
    expect(screen.queryByRole('button', { name: 'View details: Team A vs Team B' })).not.toBeInTheDocument();

    // Switch back to Matches: the list is restored.
    fireEvent.click(within(viewTabs).getByRole('tab', { name: 'Matches' }));
    expect(screen.getByRole('button', { name: 'View details: Team A vs Team B' })).toBeInTheDocument();
    expect(screen.queryByText('Performance')).not.toBeInTheDocument();
  });

  it('keeps History and Profile on tokens: no raw greys (the #888 family) or any other literal', () => {
    // Kit S4: secondary text is --se-color-ink-soft / -ink-muted; the audit's #888/#bbb greys fail 4.5:1.
    const literal = /#[0-9a-f]{3,8}\b|rgba?\(/i;
    for (const file of ['MonoHistory.jsx', 'MonoProfile.jsx', 'kit/history.css']) {
      const source = readFileSync(`${import.meta.dirname}/${file}`, 'utf8');
      expect(source, file).not.toMatch(literal);
    }
  });

  it('sums the month card stack bar and legend to that month\'s list', async () => {
    const now = new Date();
    const thisMonth = (day) => new Date(now.getFullYear(), now.getMonth(), day, 12).toISOString();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10, 12).toISOString();
    seedQuickMatch([
      { id: 'a', sport: 'volleyball', team1: 'Royals', team2: 'Strikers', score1: 3, score2: 1, winner: 'Royals', completedAt: thisMonth(1) },
      { id: 'b', sport: 'volleyball', team1: 'Aces', team2: 'Royals', score1: 1, score2: 3, winner: 'Royals', completedAt: thisMonth(1) },
      { id: 'c', sport: 'cricket', team1: 'Lions', team2: 'Tigers', score1: 164, score2: 158, winner: 'Lions', completedAt: thisMonth(1) },
      { id: 'd', sport: 'football', team1: 'City', team2: 'United', score1: 2, score2: 2, winner: 'Draw', completedAt: lastMonth },
    ]);

    renderHistory();

    const monthName = now.toLocaleString('en-GB', { month: 'long' });
    const sumsToList = async (expected) => {
      // The card and this month's list section share the month's name.
      const [card, section] = await screen.findAllByRole('region', { name: monthName });
      const legend = within(card).getByRole('list', { name: `${monthName} by sport` });
      const counts = within(legend).getAllByRole('listitem').map((item) => Number(item.querySelector('b').textContent));
      const bar = [...card.querySelectorAll('.kit-stack i')].map((segment) => Number.parseFloat(segment.style.flexGrow || segment.style.flex));
      const total = counts.reduce((a, b) => a + b, 0);
      expect(counts).toEqual(expected);
      expect(bar).toEqual(counts);
      expect(card).toHaveTextContent(`${total} matches scored`);
      expect(within(section).getAllByRole('button', { name: /^View details:/ })).toHaveLength(total);
      return card;
    };

    const card = await sumsToList([2, 1]);
    expect(card).toHaveTextContent('2 sports');
    // Last month's draw is its own section, outside the card's count.
    expect(screen.getAllByRole('button', { name: /^View details:/ })).toHaveLength(4);

    // A sport chip re-scopes the card to the filtered list, and it still sums.
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter by sport' })).getByRole('button', { name: 'Volleyball' }));
    expect(await sumsToList([2])).toHaveTextContent('1 sport');
  });

  it('bolds only the winner in row titles and leaves draws plain', async () => {
    seedQuickMatch([
      { id: 'w1', sport: 'volleyball', team1: 'Royals', team2: 'Strikers', score1: 3, score2: 1, winner: 'Royals', completedAt: '2026-05-18T12:00:00.000Z' },
      { id: 'w2', sport: 'basketball', team1: 'Hoops', team2: 'Dunkers', score1: 58, score2: 64, winner: 'Dunkers', completedAt: '2026-05-17T12:00:00.000Z' },
      { id: 'd1', sport: 'football', team1: 'City', team2: 'United', score1: 2, score2: 2, winner: 'Draw', completedAt: '2026-05-16T12:00:00.000Z' },
    ]);

    renderHistory();

    const strongIn = async (name) => [...(await screen.findByRole('button', { name })).querySelectorAll('strong')].map((el) => el.textContent);
    expect(await strongIn('View details: Royals vs Strikers')).toEqual(['Royals']);
    expect(await strongIn('View details: Hoops vs Dunkers')).toEqual(['Dunkers']);
    expect(await strongIn('View details: City vs United')).toEqual([]);
  });

  it('paints the selected filter chip as an ink fill', () => {
    const css = readFileSync(`${import.meta.dirname}/kit/history.css`, 'utf8');
    const rule = /\.kit-fchip\[aria-pressed='true'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('background: var(--se-color-ink)');
    expect(rule).toContain('color: var(--se-color-on-ink)');
    expect(/\.kit-fchip\s*\{([^}]*)\}/.exec(css)?.[1]).toContain('min-height: 48px');
  });

  it('badges each row with the sport\'s hand-drawn doodle', async () => {
    seedQuickMatch();

    renderHistory();

    const row = await screen.findByRole('button', { name: 'View details: Team A vs Team B' });
    const badge = row.querySelector('.kit-badge');
    expect(badge).not.toBeNull();
    expect(badge.style.getPropertyValue('--sport-core')).not.toBe('');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('draws the empty state with the hand-drawn scorebook, never over text', () => {
    renderHistory();

    const empty = screen.getByRole('region', { name: 'No match history yet' });
    const art = empty.querySelector('svg.kit-empty-art');
    expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(art.querySelector('text')).toBeNull();
  });
});
