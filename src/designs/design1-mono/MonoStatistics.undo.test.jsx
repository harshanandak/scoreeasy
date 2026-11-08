import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoHistory from './MonoHistory';
import { loadCompletedQuickMatches, saveQuickMatch, saveQuickMatches } from '../../utils/storage';

const match = (id, day) => ({
  id, sport: 'volleyball', team1: `Team ${id}`, team2: 'Visitors',
  score1: 25, score2: 20, winner: `Team ${id}`,
  completedAt: `2026-05-${day}T12:00:00.000Z`,
});
const originals = [match('first', '18'), match('middle', '17'), match('last', '16')];
const ids = () => loadCompletedQuickMatches().map(item => item.id);

async function openStats() {
  render(<MemoryRouter><MonoHistory /></MemoryRouter>);
  fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
  fireEvent.click(await screen.findByRole('tab', { name: 'Quick' }));
}

function request(kind, id = 'middle') {
  fireEvent.click(screen.getByRole('button', {
    name: kind === 'delete' ? new RegExp(`^Delete match Team ${id} vs Visitors,`) : 'Clear all quick stats',
  }));
}

function confirm(kind) {
  fireEvent.click(screen.getByRole('button', { name: kind === 'delete' ? 'Delete' : 'Clear all' }));
}

const undo = kind => fireEvent.click(screen.getByRole('button', { name: `Undo ${kind}` }));

describe('Stats recovery against current storage', () => {
  beforeEach(() => {
    localStorage.clear();
    saveQuickMatches(originals);
  });

  it.each(['delete', 'clear'])('keeps %s Undo after leaving Stats for Matches and returning', async kind => {
    await openStats();
    request(kind);
    confirm(kind);
    const views = within(screen.getByRole('tablist', { name: 'History and statistics views' }));
    fireEvent.click(views.getByRole('tab', { name: 'Matches' }));
    fireEvent.click(views.getByRole('tab', { name: 'Stats' }));
    const quick = screen.queryByRole('tab', { name: 'Quick' });
    expect(quick, 'a pending recovery must keep the Quick tab reachable after remount').toBeInTheDocument();
    fireEvent.click(quick);
    expect(screen.queryByRole('button', { name: `Undo ${kind}` }), 'confirmed recovery must survive panel unmount').toBeInTheDocument();
    undo(kind);
    expect(ids()).toEqual(['first', 'middle', 'last']);
  });

  it('keeps a later completion when undoing one deletion and restores the original position', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    saveQuickMatch(match('later', '19'));
    undo('delete');
    expect(ids(), 'Undo must merge into current storage instead of replacing completed matches').toEqual(['first', 'middle', 'last', 'later']);
  });

  it('clears only displayed matches and restores only those matches in order around later completions', async () => {
    await openStats();
    request('clear');
    saveQuickMatch(match('during-confirm', '19'));
    confirm('clear');
    expect(ids(), 'Clear must leave a completion outside the displayed snapshot alone').toEqual(['during-confirm']);
    saveQuickMatch(match('after-clear', '20'));
    undo('clear');
    expect(ids()).toEqual(['first', 'middle', 'last', 'during-confirm', 'after-clear']);
  });

  it.each(['delete', 'clear'])('keeps the first Undo after a second %s confirmation is cancelled', async second => {
    await openStats();
    request('delete');
    confirm('delete');
    request(second, 'first');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Undo delete' }), 'cancelling must retain the previously confirmed recovery').toBeInTheDocument();
    undo('delete');
    expect(ids()).toEqual(['first', 'middle', 'last']);
  });

  it('skips an id already restored elsewhere and preserves its current contents', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    saveQuickMatch({ ...originals[1], score1: 30 });
    undo('delete');
    expect(loadCompletedQuickMatches().filter(item => item.id === 'middle')).toEqual([
      expect.objectContaining({ id: 'middle', score1: 30 }),
    ]);
  });
});
