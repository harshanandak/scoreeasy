import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoHistory from './MonoHistory';

const QUICK_MATCHES_KEY = 'se_quickmatches';
const OLDER_HISTORY_KEY = 'gs_history';

function seedQuickMatch() {
  globalThis.localStorage.setItem(
    QUICK_MATCHES_KEY,
    JSON.stringify([
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
    ]),
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

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
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

    const detailsButton = await screen.findByText('View details');
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
    expect(screen.getByText('Quick match restored.')).toBeInTheDocument();
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
      expect(screen.getByText('Local history cleared.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Undo clear' })).toBeInTheDocument();
  });
});
