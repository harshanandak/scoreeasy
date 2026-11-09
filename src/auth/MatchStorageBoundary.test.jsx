import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { AuthContext, LocalAuthProvider } from './AuthContext';
import MatchStorageBoundary from './MatchStorageBoundary';
import { loadData, saveData } from '../utils/storage';
import { setMatchStorageScope } from '../utils/accountStorage';
import { useState } from 'react';
import { LAST_ACCOUNT, rememberSignedInAccount } from './localAccount';
import { getAuthBootstrapMode, shouldUseCloudAuthRoot } from './bootstrap';

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

it('revokes and switches a mounted local account on marker storage events', () => {
  setMatchStorageScope('clerk-X');
  saveData('se_quickmatch_draft_football_live', 8);
  setMatchStorageScope('clerk-Y');
  saveData('se_quickmatch_draft_football_live', 3);
  setMatchStorageScope(null);
  rememberSignedInAccount('clerk-X');
  render(<LocalAuthProvider reason="offline"><MatchStorageBoundary><Board /></MatchStorageBoundary></LocalAuthProvider>);
  expect(screen.getByRole('button', { name: 'Score 8' })).toBeInTheDocument();
  rememberSignedInAccount(null);
  fireEvent(window, new StorageEvent('storage', { key: LAST_ACCOUNT, oldValue: 'clerk-X', newValue: null }));
  expect(screen.getByRole('button', { name: 'Score 0' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Score 0' }));
  rememberSignedInAccount('clerk-Y');
  fireEvent(window, new StorageEvent('storage', { key: LAST_ACCOUNT, oldValue: null, newValue: 'clerk-Y' }));
  expect(screen.getByRole('button', { name: 'Score 3' })).toBeInTheDocument();
  rememberSignedInAccount(null);
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('button', { name: 'Score 1' })).toBeInTheDocument();
  rememberSignedInAccount('clerk-X');
  fireEvent(window, new Event('focus'));
  expect(screen.getByRole('button', { name: 'Score 8' })).toBeInTheDocument();
});

it.each([false, true])('offline cold start after sign-in keeps account scoring (explicit sign-out: %s)', signedOut => {
  rememberSignedInAccount('clerk-X');
  setMatchStorageScope('clerk-X');
  saveData('se_quickmatch_draft_football_live', 8);
  if (signedOut) rememberSignedInAccount(null);
  setMatchStorageScope(null);
  const bootstrap = getAuthBootstrapMode({ clerkPublishableKey: 'pk_test_fixture', convexUrl: 'https://example.convex.cloud', isOnline: false });
  expect(bootstrap.mode).toBe('local');
  render(<LocalAuthProvider reason={bootstrap.reason}><MatchStorageBoundary><Board /></MatchStorageBoundary></LocalAuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: `Score ${signedOut ? 0 : 8}` }));
  expect(screen.getByRole('button', { name: `Score ${signedOut ? 1 : 9}` })).toBeInTheDocument();
  setMatchStorageScope('clerk-X');
  expect(loadData('se_quickmatch_draft_football_live')).toBe(signedOut ? 8 : 9);
  setMatchStorageScope(null);
  expect(loadData('se_quickmatch_draft_football_live', 0)).toBe(signedOut ? 1 : 0);
});

it.each([false, true])('native cloud-probe failure on a scoring route retains the local identity (explicit sign-out: %s)', signedOut => {
  rememberSignedInAccount('clerk-X');
  setMatchStorageScope('clerk-X');
  saveData('se_quickmatch_draft_football_live', 8);
  if (signedOut) rememberSignedInAccount(null);
  setMatchStorageScope(null);
  expect(shouldUseCloudAuthRoot({ authMode: 'cloud', shouldProbeNativeCloud: true, nativeProbeStatus: 'retrying', pathname: '/quick-match' })).toBe(false);
  render(<LocalAuthProvider reason="native-offline" cloudAuthAvailable><MatchStorageBoundary><Board /></MatchStorageBoundary></LocalAuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: `Score ${signedOut ? 0 : 8}` }));
  setMatchStorageScope('clerk-X');
  expect(loadData('se_quickmatch_draft_football_live')).toBe(signedOut ? 8 : 9);
});
