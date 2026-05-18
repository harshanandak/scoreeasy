import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoHistory from './MonoHistory';

const QUICK_MATCHES_KEY = 'se_quickmatches';

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
    globalThis.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 1;
    });
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
    expect(JSON.parse(globalThis.localStorage.getItem(QUICK_MATCHES_KEY))).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(JSON.parse(globalThis.localStorage.getItem(QUICK_MATCHES_KEY))).toHaveLength(0);
    });
    expect(screen.getByRole('button', { name: 'Undo delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));

    await waitFor(() => {
      expect(JSON.parse(globalThis.localStorage.getItem(QUICK_MATCHES_KEY))).toHaveLength(1);
    });
    expect(screen.getByText('Quick match restored.')).toBeInTheDocument();
  });
});
