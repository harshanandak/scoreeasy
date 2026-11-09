import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { AuthContext } from './AuthContext';
import MatchStorageBoundary from './MatchStorageBoundary';
import { loadData, saveData } from '../utils/storage';
import { setMatchStorageScope } from '../utils/accountStorage';
import { useState } from 'react';

function Board() {
  const [score, setScore] = useState(() => loadData('se_quickmatch_draft_football_live', 0));
  return <button onClick={() => { saveData('se_quickmatch_draft_football_live', score + 1); setScore(score + 1); }}>Score {score}</button>;
}
const view = (clerkUser, isAuthenticated = Boolean(clerkUser)) => <AuthContext.Provider value={{ clerkUser, isAuthenticated, authMode: 'cloud', isLoading: false }}><MatchStorageBoundary><Board /></MatchStorageBoundary></AuthContext.Provider>;
beforeEach(() => { localStorage.clear(); setMatchStorageScope(null); });
afterEach(() => setMatchStorageScope(null));

it('sign-out mid-match hides the board, preserves the account point, and returns it only to the same account', () => {
  const { rerender } = render(view({ id: 'clerk-X' }));
  fireEvent.click(screen.getByRole('button', { name: 'Score 0' }));
  expect(screen.getByRole('button', { name: 'Score 1' })).toBeInTheDocument();
  rerender(view(null));
  expect(screen.getByRole('button', { name: 'Score 0' })).toBeInTheDocument();
  rerender(view({ id: 'clerk-Y' }));
  expect(screen.getByRole('button', { name: 'Score 0' })).toBeInTheDocument();
  rerender(view({ id: 'clerk-X' }));
  expect(screen.getByRole('button', { name: 'Score 1' })).toBeInTheDocument();
});

it('retains the Clerk account namespace when Convex authentication is temporarily offline', () => {
  const { rerender } = render(view({ id: 'clerk-X' }));
  fireEvent.click(screen.getByRole('button', { name: 'Score 0' }));
  rerender(view({ id: 'clerk-X' }, false));
  expect(screen.getByRole('button', { name: 'Score 1' })).toBeInTheDocument();
});
