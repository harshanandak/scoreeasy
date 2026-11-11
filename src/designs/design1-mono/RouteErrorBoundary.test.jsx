import { matchStorageKey } from '../../utils/accountStorage';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import RouteErrorBoundary from './RouteErrorBoundary';
import { CHUNK_RELOAD_KEY } from '../../utils/chunkReload';
import { loadInProgressMatches } from '../../utils/appEntry';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const DRAFT_KEY = 'se_quickmatch_draft_volleyball_abc';

function Thrower({ message = 'corrupt draft' }) {
  throw new Error(message);
}

function crashAt(path, message, state) {
  const [pathname, search = ''] = path.split('?');
  return render(
    <MemoryRouter initialEntries={[{ pathname, search: search && `?${search}`, state }]}>
      <RouteErrorBoundary><Thrower message={message} /></RouteErrorBoundary>
    </MemoryRouter>,
  );
}

function seedQuickMatch() {
  localStorage.setItem(matchStorageKey(DRAFT_KEY), JSON.stringify({
    sport: 'volleyball', quickMatchId: 'abc', phase: 'scoring', team1Name: 'Royals', team2Name: 'Strikers',
    vScore1: 12, vScore2: 9, sets: [{ score1: 12, score2: 9, completed: false }], currentSet: 0,
    format: { type: 'single', target: 25 }, updatedAt: '2026-11-09',
  }));
}

describe('RouteErrorBoundary: discarding a kept match from the crash screen', () => {
  let assign;
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    assign = vi.fn();
    vi.stubGlobal('location', { ...globalThis.location, assign, reload: vi.fn() });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it('offers a quiet third action on a scoring route with a kept entry, and keeps the others', () => {
    seedQuickMatch();
    crashAt('/volleyball/quick?resume=abc');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This screen hit a problem');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /^Discard this match.*Royals v Strikers/ })).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('Discard asks first, naming the match and score; Keep match leaves the entry alone', () => {
    seedQuickMatch();
    crashAt('/volleyball/quick?resume=abc');
    fireEvent.click(screen.getByRole('button', { name: /^Discard this match/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Discard match?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Royals v Strikers');
    expect(dialog).toHaveTextContent('12–9');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep match' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(matchStorageKey(DRAFT_KEY))).not.toBeNull();
    expect(loadInProgressMatches()).toHaveLength(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it('confirming removes the kept entry and goes Home', () => {
    seedQuickMatch();
    crashAt('/volleyball/quick?resume=abc');
    fireEvent.click(screen.getByRole('button', { name: /^Discard this match/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    expect(localStorage.getItem(matchStorageKey(DRAFT_KEY))).toBeNull();
    expect(loadInProgressMatches()).toEqual([]);
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('is not offered on the new-version screen', () => {
    seedQuickMatch();
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now() - 2000));
    crashAt('/volleyball/quick?resume=abc', 'Failed to fetch dynamically imported module: /assets/Old-deadbeef.js');
    expect(screen.getByRole('alert')).toHaveTextContent('A new version of Score Easy is ready');
    expect(screen.queryByRole('button', { name: /Discard this match/ })).not.toBeInTheDocument();
  });

  it('is not offered on a non-scoring route, even when a match is kept', () => {
    seedQuickMatch();
    crashAt('/history');
    expect(screen.getByRole('alert')).toHaveTextContent('This screen hit a problem');
    expect(screen.queryByRole('button', { name: /Discard this match/ })).not.toBeInTheDocument();
  });

  it('is not offered on a scoring route that has no kept entry', () => {
    crashAt('/volleyball/quick?resume=nothing-here');
    expect(screen.queryByRole('button', { name: /Discard this match/ })).not.toBeInTheDocument();
  });

  it('is not offered when the scorer deliberately skipped restoring (setup opened with newMatch state)', () => {
    seedQuickMatch();
    crashAt('/volleyball/quick', undefined, { newMatch: true });
    expect(screen.getByRole('alert')).toHaveTextContent('This screen hit a problem');
    expect(screen.queryByRole('button', { name: /Discard this match/ })).not.toBeInTheDocument();
  });

  it('is not offered when setup was opened with teams in state', () => {
    seedQuickMatch();
    crashAt('/volleyball/quick', undefined, { teams: [{ name: 'A' }, { name: 'B' }] });
    expect(screen.queryByRole('button', { name: /Discard this match/ })).not.toBeInTheDocument();
  });

  it('is not offered on a completed-match result URL, and never deletes the unrelated draft', () => {
    seedQuickMatch();
    crashAt('/volleyball/quick?result=finished-1');
    expect(screen.queryByRole('button', { name: /Discard this match/ })).not.toBeInTheDocument();
    expect(localStorage.getItem(matchStorageKey(DRAFT_KEY))).not.toBeNull();
  });

  it('on the bare quick URL offers the draft the scorer restores: the newest one', () => {
    seedQuickMatch();
    localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball_old'), JSON.stringify({
      sport: 'volleyball', quickMatchId: 'old', phase: 'scoring', team1Name: 'Lions', team2Name: 'Tigers',
      vScore1: 1, vScore2: 0, updatedAt: '2020-01-01',
    }));
    crashAt('/volleyball/quick');
    expect(screen.getByRole('button', { name: /^Discard this match.*Royals v Strikers/ })).toBeInTheDocument();
  });

  it('still offers Discard when the score data is damaged, naming the match from its team names', () => {
    localStorage.setItem(matchStorageKey('se_tennis_quick_draft_t1'), JSON.stringify({
      id: 't1', status: 'in-progress', team1Name: 'Ace', team2Name: 'Bee', sets: [null], updatedAt: '2026-11-09',
    }));
    crashAt('/tennis/quick/live/t1');
    fireEvent.click(screen.getByRole('button', { name: /^Discard this match.*Ace v Bee/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Ace v Bee');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    expect(localStorage.getItem(matchStorageKey('se_tennis_quick_draft_t1'))).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
  });
});
