import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonoHistory from './MonoHistory';
import { loadQuickMatches, saveQuickMatches } from '../../utils/storage';
import { removeMatchHistory, restoreMatchHistory } from '../../utils/matchHistoryRecovery';
import { createGameSession, createHistoryRecord, createParticipant } from '../../models/types';

const RECOVERY_KEY = 'se_matches_pending_undo';
const completed = id => ({
  id, sport: 'football', status: 'completed', team1: id, team2: 'Away',
  score1: 2, score2: 1, winner: id, completedAt: '2026-11-01T12:00:00Z',
});
const ids = () => loadQuickMatches().map(match => match.id);
const legacy = () => JSON.parse(localStorage.getItem('gs_history') || '[]');
function olderMatch(name) {
  const participants = ['North', 'South'].map(value => createParticipant({ name: value }));
  const session = createGameSession({ templateId: 'preset_volleyball', name, participants });
  session.winner = participants[0].id;
  return createHistoryRecord(session);
}
const mount = () => render(<MemoryRouter><MonoHistory /></MemoryRouter>);
function clear() {
  fireEvent.click(screen.getByRole('button', { name: 'Clear local history' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
}
function remove(id = 'middle') {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id} .*View details$`) }));
  fireEvent.click(screen.getByRole('button', { name: `Delete match ${id} vs Away` }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
}
function failWrites(key) {
  const setItem = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key) throw new Error('storage write failed');
    return setItem.call(this, name, value);
  });
}

describe('Matches operation-bound Undo', () => {
  beforeEach(() => {
    localStorage.clear();
    saveQuickMatches(['first', 'middle', 'last'].map(completed));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('merges cleared matches with a later completion in original order', () => {
    mount();
    clear();
    saveQuickMatches([completed('later')]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(ids()).toEqual(['first', 'middle', 'last', 'later']);
    expect(screen.getByRole('status')).toHaveTextContent('History restored.');
    expect(screen.getByRole('button', { name: /^later .*View details$/ })).toBeInTheDocument();
  });

  it('restores only the deleted id, preserving a later completion and independent deletion', () => {
    mount();
    remove();
    saveQuickMatches([completed('last'), completed('later')]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));
    expect(ids()).toEqual(['middle', 'last', 'later']);
  });

  it('keeps the current version of a restored id without duplicating it', () => {
    mount();
    remove();
    const changed = { ...completed('middle'), score1: 5 };
    saveQuickMatches([completed('first'), changed, completed('last')]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(loadQuickMatches()[1].score1).toBe(5);
  });

  it.each(['clear', 'delete'])('refuses an expired %s operation', kind => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
    mount();
    if (kind === 'clear') clear(); else remove();
    const before = loadQuickMatches();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    fireEvent.click(screen.getByRole('button', { name: `Undo ${kind}` }));
    expect(loadQuickMatches()).toEqual(before);
    expect(screen.getByRole('status')).toHaveTextContent('Undo is no longer available');
  });

  it.each(['clear', 'delete'])('refuses a %s operation consumed elsewhere instead of choosing a newer one', kind => {
    mount();
    if (kind === 'clear') clear(); else remove();
    localStorage.setItem(RECOVERY_KEY, JSON.stringify([{
      id: 'different-operation', kind: 'delete', createdAt: Date.now(),
      items: [{ match: completed('unrelated'), index: 0 }], order: ['unrelated'],
    }]));
    const before = loadQuickMatches();
    fireEvent.click(screen.getByRole('button', { name: `Undo ${kind}` }));
    expect(loadQuickMatches()).toEqual(before);
    expect(screen.getByRole('status')).toHaveTextContent('Undo is no longer available');
  });

  it.each(['clear', 'delete'])('does not announce %s success when the match write fails', kind => {
    mount();
    failWrites('se_quickmatches');
    if (kind === 'clear') clear(); else remove();
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    expect(screen.queryByRole('button', { name: `Undo ${kind}` })).not.toBeInTheDocument();
  });

  it.each(['clear', 'delete'])('keeps failed %s Undo retryable without reporting success', kind => {
    mount();
    if (kind === 'clear') clear(); else remove();
    const before = loadQuickMatches();
    const failure = failWrites('se_quickmatches');
    fireEvent.click(screen.getByRole('button', { name: `Undo ${kind}` }));
    expect(loadQuickMatches()).toEqual(before);
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: `Undo ${kind}` }));
    expect(ids()).toEqual(['first', 'middle', 'last']);
  });

  it('merges older history too and preserves its current records', () => {
    const old = olderMatch('Old court');
    localStorage.setItem('gs_history', JSON.stringify([old]));
    mount();
    clear();
    const later = olderMatch('Later court');
    localStorage.setItem('gs_history', JSON.stringify([later]));
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(legacy().map(match => match.id)).toEqual([old.id, later.id]);
    expect(screen.getByText('Later court')).toBeInTheDocument();
  });

  it('does not announce clear or restore success after an older-history write fails', () => {
    const old = olderMatch('Old court');
    localStorage.setItem('gs_history', JSON.stringify([old]));
    mount();
    const failure = failWrites('gs_history');
    clear();
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    expect(legacy()).toEqual([old]);
    expect(ids()).toEqual(['first', 'middle', 'last']);
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const restoreFailure = failWrites('gs_history');
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    restoreFailure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(legacy()).toEqual([old]);
    expect(ids()).toEqual(['first', 'middle', 'last']);
  });

  it('keeps quick and older-history records with the same id distinct', () => {
    const old = { ...olderMatch('Old court'), id: 'middle' };
    localStorage.setItem('gs_history', JSON.stringify([old]));
    mount();
    clear();
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(legacy()).toEqual([old]);
  });

  it('does not remove matches if recovery cannot be persisted', () => {
    mount();
    failWrites(RECOVERY_KEY);
    clear();
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    expect(screen.queryByRole('button', { name: 'Undo clear' })).not.toBeInTheDocument();
  });

  it('does not report success if consuming recovery fails, and retry does not duplicate matches', () => {
    mount();
    clear();
    const failure = failWrites(RECOVERY_KEY);
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(screen.getByRole('status')).toHaveTextContent('History restored.');
  });

  it('retains durable recovery and offers Undo when clearing older history and rollback both fail', () => {
    const old = olderMatch('Old court');
    localStorage.setItem('gs_history', JSON.stringify([old]));
    mount();
    const setItem = Storage.prototype.setItem;
    let olderFailed = false;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'gs_history') {
        olderFailed = true;
        throw new Error('older write failed');
      }
      if (key === 'se_quickmatches' && olderFailed) throw new Error('rollback failed');
      return setItem.call(this, key, value);
    });
    clear();
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    expect(JSON.parse(localStorage.getItem(RECOVERY_KEY))).toHaveLength(1);
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Undo clear' }));
    expect(ids()).toEqual(['first', 'middle', 'last']);
    expect(legacy()).toEqual([old]);
  });

  it('keeps all five original recoveries and a partial sixth Clear restorable after both writes fail', () => {
    const operations = Array.from({ length: 5 }, (_, index) => {
      const match = completed(`capacity-${index}`);
      saveQuickMatches([...loadQuickMatches(), match]);
      return removeMatchHistory(match.id, 'delete');
    });
    const old = olderMatch('Old court');
    localStorage.setItem('gs_history', JSON.stringify([old]));
    mount();
    const setItem = Storage.prototype.setItem;
    let olderFailed = false;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'gs_history') {
        olderFailed = true;
        throw new Error('older write failed');
      }
      if (key === 'se_quickmatches' && olderFailed) throw new Error('rollback failed');
      return setItem.call(this, key, value);
    });
    clear();
    expect(screen.getByRole('status')).toHaveTextContent(/Could not/);
    failure.mockRestore();
    const stored = JSON.parse(localStorage.getItem(RECOVERY_KEY));
    const partial = stored.at(-1);
    const results = operations.map(operation => restoreMatchHistory(operation.id));
    results.push(restoreMatchHistory(partial.id));
    expect(results, 'every original operation and partial Clear must remain restorable').toEqual(Array(6).fill(true));
    const expected = ['first', 'middle', 'last', ...operations.map((_, index) => `capacity-${index}`)];
    expect(new Set(ids())).toEqual(new Set(expected));
    expect(ids()).toHaveLength(expected.length);
    expect(legacy()).toEqual([old]);
    expect(stored.map(operation => operation.id)).toEqual([...operations.map(operation => operation.id), partial.id]);
  });

  it('revokes earlier Matches Undo operations after a successful deliberate Matches Clear', () => {
    const removed = removeMatchHistory('middle', 'delete');
    const cleared = removeMatchHistory(null, 'clear');
    expect(restoreMatchHistory(removed.id)).toBe('unavailable');
    expect(ids()).toEqual([]);
    expect(restoreMatchHistory(cleared.id)).toBe(true);
    expect(ids()).toEqual(['first', 'last']);
  });
});
