import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoHistory from './MonoHistory';
import { loadCompletedQuickMatches, saveQuickMatch, saveQuickMatches } from '../../utils/storage';
import { loadQuickStatsRecovery, removeQuickStats, restoreQuickStats } from '../../utils/quickStatsRecovery';

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
  fireEvent.click(await screen.findByRole('button', { name: 'Quick' }));
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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['delete', 'clear'])('keeps %s Undo after leaving Stats for Matches and returning', async kind => {
    await openStats();
    request(kind);
    confirm(kind);
    const views = within(screen.getByRole('tablist', { name: 'History and statistics views' }));
    fireEvent.click(views.getByRole('tab', { name: 'Matches' }));
    fireEvent.click(views.getByRole('tab', { name: 'Stats' }));
    const quick = screen.queryByRole('button', { name: 'Quick' });
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

  it('binds tab A Undo to its own operation after tab B removes a different match', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    removeQuickStats([originals[0]], 'delete');
    undo('delete');
    expect(ids(), 'tab A must restore middle, never tab B first').toEqual(['middle', 'last']);
  });

  it('offers no Undo for an operation older than 24 hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    removeQuickStats([originals[1]], 'delete');
    vi.setSystemTime(new Date('2026-11-10T10:00:00.001Z'));
    await openStats();
    expect(screen.queryByRole('button', { name: 'Undo delete' }), 'expired recovery must not offer Undo').not.toBeInTheDocument();
    expect(ids()).toEqual(['first', 'last']);
  });

  it('invalidates Stats recovery when the Matches panel deliberately clears local history', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    fireEvent.click(screen.getByRole('tab', { name: 'Matches' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear local history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Stats' }));
    expect(screen.queryByRole('button', { name: 'Undo delete' }), 'deliberately cleared history must not return through Stats Undo').not.toBeInTheDocument();
    expect(loadQuickStatsRecovery()).toBeNull();
  });

  it('keeps Undo retryable and does not report success when consuming its operation fails', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    const saveFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'se_stats_pending_undo' && value === '[]') throw new Error('cleanup failed');
      return setItem.call(this, key, value);
    });
    const removeFailure = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === 'se_stats_pending_undo') throw new Error('cleanup failed');
      return removeItem.call(this, key);
    });
    undo('delete');
    expect(screen.getByRole('status'), 'failed cleanup must not announce successful Undo').not.toHaveTextContent('Quick stat restored.');
    expect(screen.getByRole('status')).toHaveTextContent(/restored.*tidy.*retry/i);
    expect(screen.getByRole('button', { name: 'Undo delete' })).toBeInTheDocument();
    expect(ids()).toEqual(['first', 'middle', 'last']);
    saveFailure.mockRestore();
    removeFailure.mockRestore();
    undo('delete');
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(screen.queryByRole('button', { name: 'Undo delete' })).not.toBeInTheDocument();
  });

  it('reports unavailable and restores nothing if the shown operation was consumed elsewhere', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    restoreQuickStats(loadQuickStatsRecovery().id);
    saveQuickMatches([originals[2]]);
    undo('delete');
    expect(screen.getByRole('status')).toHaveTextContent('Undo is no longer available');
    expect(ids()).toEqual(['last']);
  });

  it('re-reads the latest operation on a storage event', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    removeQuickStats([originals[0]], 'clear');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'se_stats_pending_undo' })));
    expect(screen.queryByRole('button', { name: 'Undo clear' }), 'storage updates must show the latest operation').toBeInTheDocument();
  });

  it('does not clear Matches history or report success if invalidating Stats recovery fails', async () => {
    await openStats();
    request('delete');
    confirm('delete');
    fireEvent.click(screen.getByRole('tab', { name: 'Matches' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear local history' }));
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'se_stats_pending_undo') throw new Error('cannot clear recovery');
      return setItem.call(this, key, value);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      if (key === 'se_stats_pending_undo') throw new Error('cannot clear recovery');
      return removeItem.call(this, key);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(ids(), 'history must remain intact if recovery invalidation fails').toEqual(['first', 'last']);
    expect(screen.getByRole('status')).not.toHaveTextContent('Local history cleared.');
  });
});
