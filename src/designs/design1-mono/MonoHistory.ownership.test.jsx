import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { AuthContext } from '../../auth/AuthContext';
import MonoHistory from './MonoHistory';
import { enqueueMatchSave, hydratePendingMatchSaves, PENDING_SAVES_CHANGED } from '../../utils/pendingMatchSaves';

vi.mock('convex/react', () => ({ useConvex: () => null }));
const match = { id: 'private', sport: 'football', team1: 'Private North', team2: 'Private South', score1: 2, score2: 1, status: 'completed', completedAt: '2026-11-01' };
const row = /Private North .* Private South.*View details/;
const tree = id => <AuthContext.Provider value={{ isAuthenticated: Boolean(id), user: id ? { _id: id } : null }}><MemoryRouter><MonoHistory /></MemoryRouter></AuthContext.Provider>;
beforeEach(() => {
  localStorage.clear(); vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.setItem('se_quickmatches', JSON.stringify([match]));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('uses durable ownership across sign-out/account changes without an owner marker', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  enqueueMatchSave('X', { ...match, clientMatchId: 'quick:football:private', date: 1 }, match.id);
  await hydratePendingMatchSaves('X');
  const { rerender } = render(tree('X'));
  expect(await screen.findByRole('button', { name: row })).toBeInTheDocument();
  rerender(tree(null));
  expect(screen.queryByRole('button', { name: row })).not.toBeInTheDocument();
  rerender(tree('Y'));
  expect(screen.queryByRole('button', { name: row })).not.toBeInTheDocument();
  rerender(tree('X'));
  expect(await screen.findByRole('button', { name: row })).toBeInTheDocument();
});

it('keeps an unmarked result hidden until ownership is readable and invalidates a previous guest read', async () => {
  localStorage.setItem('se_quickmatches', JSON.stringify([{ ...match, id: 'guest-private' }]));
  const database = indexedDB;
  vi.stubGlobal('indexedDB', undefined);
  render(tree(null));
  expect(screen.queryByRole('button', { name: row })).not.toBeInTheDocument();
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(screen.queryByRole('button', { name: row })).not.toBeInTheDocument();
  vi.stubGlobal('indexedDB', database);
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(await screen.findByRole('button', { name: row })).toBeInTheDocument();
  vi.stubGlobal('indexedDB', undefined);
  await act(async () => window.dispatchEvent(new Event(PENDING_SAVES_CHANGED)));
  await waitFor(() => expect(screen.queryByRole('button', { name: row })).not.toBeInTheDocument());
});
