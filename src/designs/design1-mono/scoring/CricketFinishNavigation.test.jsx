import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import { ScoringCompletionContext } from './scoringCompletionContext';
import MonoCricketLiveScore from './MonoCricketLiveScore';
import MonoCricketTestLiveScore from './MonoCricketTestLiveScore';
import MonoCricketGuidedScorerRoute from './MonoCricketGuidedScorerRoute';

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

const tournamentPath = '/cricket/tournament/100';
const quickCompletionPath = '/history';
const cases = ['limited', 'test-tournament', 'test-quick', 'guided'];

function CompletionDestination() {
  const navigate = useNavigate();
  return <><h1>Completion destination</h1><button onClick={() => navigate(-1)}>Back</button></>;
}

function seed(kind) {
  Object.entries(cricketFinishSeed(kind)).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
}

function renderScorer(kind, complete) {
  const quick = kind === 'test-quick';
  const scorer = kind === 'limited' ? <MonoCricketLiveScore />
    : kind === 'guided' ? <MonoCricketGuidedScorerRoute />
      : <MonoCricketTestLiveScore storageMode={quick ? 'quick' : undefined} />;
  return render(
    <MemoryRouter initialEntries={['/app', quick ? '/cricket/quick/test-match/300' : `${tournamentPath}/match/m1/score`]}>
      <ScoringCompletionContext.Provider value={complete}>
        <Routes>
          <Route path="/:sport/tournament/:id/match/:matchId/score" element={scorer} />
          <Route path="/:sport/quick/test-match/:matchId" element={scorer} />
          <Route path={tournamentPath} element={<CompletionDestination />} />
          <Route path={quickCompletionPath} element={<CompletionDestination />} />
          <Route path="/app" element={<h1>Prior page</h1>} />
        </Routes>
      </ScoringCompletionContext.Provider>
    </MemoryRouter>,
  );
}

async function finish(kind) {
  if (kind === 'guided') {
    fireEvent.click(await screen.findByRole('button', { name: 'Four' }));
  } else if (kind.startsWith('test')) {
    fireEvent.click(await screen.findByRole('button', { name: 'Four runs' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Return' }));
  } else {
    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  }
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('cricket finish navigation', () => {
  it.each(['test-tournament', 'test-quick'])('%s restores a persisted draw as terminal after refreshing before Return', async (kind) => {
    seed(kind);
    const complete = vi.fn();
    const first = renderScorer(kind, complete);
    fireEvent.click(await screen.findByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'End as draw' }));
    fireEvent.click(screen.getByRole('button', { name: 'End as draw' }));
    expect(await screen.findByText('Match Drawn')).toBeInTheDocument();
    const key = kind === 'test-quick' ? 'se_quickmatches' : 'se_cricket';
    const finished = JSON.parse(localStorage.getItem(key));
    const match = kind === 'test-quick' ? finished[0] : finished[0].matches[0];
    expect(match).toMatchObject({ status: 'completed', winner: kind === 'test-quick' ? 'Draw' : 'draw' });
    expect(match.draftState).toBeUndefined();
    first.unmount();
    renderScorer(kind, complete);
    expect(await screen.findByText('Match Drawn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Four runs' })).not.toBeInTheDocument();
    fireEvent.keyDown(globalThis, { key: '4' });
    expect(JSON.parse(localStorage.getItem(key))).toEqual(finished);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Return' }));
    expect(complete).toHaveBeenCalledExactlyOnceWith(kind === 'test-quick' ? quickCompletionPath : tournamentPath);
    expect(JSON.parse(localStorage.getItem(key))).toEqual(finished);
  });

  it.each(cases)('%s exits through protected completion after saving the result', async (kind) => {
    seed(kind);
    const complete = vi.fn();
    renderScorer(kind, complete);
    await finish(kind);
    await waitFor(() => expect(complete).toHaveBeenCalledWith(kind === 'test-quick' ? quickCompletionPath : tournamentPath));
    expect(complete).toHaveBeenCalledTimes(1);
    const data = JSON.parse(localStorage.getItem(kind === 'test-quick' ? 'se_quickmatches' : 'se_cricket'));
    const match = kind === 'test-quick' ? data[0] : data[0].matches[0];
    expect(match.status).toBe('completed');
    expect(match.draftState).toBeUndefined();
    if (kind.startsWith('test')) {
      expect(match.innings).toEqual([
        expect.objectContaining({ teamId: 'A', runs: 1, balls: 6, wickets: 10 }),
        expect.objectContaining({ teamId: 'B', runs: 0, balls: 6, wickets: 10 }),
        expect.objectContaining({ teamId: 'A', runs: 0, balls: 6, wickets: 10 }),
        expect.objectContaining({ teamId: 'B', runs: 4, balls: 1, wickets: 0 }),
      ]);
    } else {
      expect(match.team1Score).toMatchObject({ runs: 1, balls: 6, wickets: 0 });
      expect(match.team2Score).toMatchObject({ runs: kind === 'guided' ? 4 : 2, balls: 1, wickets: 0 });
    }
  });

  it.each(cases)('%s can finish without a completion provider', async (kind) => {
    seed(kind);
    renderScorer(kind, null);
    await finish(kind);
    expect(await screen.findByRole('heading', { name: 'Completion destination' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Prior page' })).toBeInTheDocument();
  });

  it.each(['test-tournament', 'test-quick'])('%s also protects the Finish & save menu exit', async (kind) => {
    seed(kind);
    const complete = vi.fn();
    renderScorer(kind, complete);
    fireEvent.click(await screen.findByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Finish & save' }));
    expect(complete).toHaveBeenCalledExactlyOnceWith(kind === 'test-quick' ? quickCompletionPath : tournamentPath);
    const data = JSON.parse(localStorage.getItem(kind === 'test-quick' ? 'se_quickmatches' : 'se_cricket'));
    const saved = kind === 'test-quick' ? data[0] : data[0].matches[0];
    expect(saved).toMatchObject({ status: 'completed', winner: kind === 'test-quick' ? 'Draw' : 'draw', completedAt: expect.any(String) });
    expect(saved.innings).toHaveLength(4);
    expect(saved.draftState).toBeUndefined();
  });

  it.each(['limited', 'test-tournament', 'test-quick'])('%s retains a scoring stroke and Undo after remount, then saves the corrected innings', async (kind) => {
    const fixture = cricketFinishSeed(kind);
    if (kind === 'limited') fixture.se_cricket[0].matches[0].draftState.scores.team2 = { runs: 0, balls: 0, wickets: 0, allOut: false };
    Object.entries(fixture).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    const complete = vi.fn();
    const first = renderScorer(kind, complete);
    const runButton = kind === 'limited' ? '1' : '1 run';
    fireEvent.click(await screen.findByRole('button', { name: runButton, exact: true }));
    const storageKey = kind === 'test-quick' ? 'se_quickmatches' : 'se_cricket';
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      expect((kind === 'test-quick' ? saved[0] : saved[0].matches[0]).draftState.history).toHaveLength(1);
    });
    first.unmount();
    renderScorer(kind, complete);
    fireEvent.click(await screen.findByRole('button', { name: kind === 'limited' ? 'Undo' : 'Undo last action' }));
    if (kind === 'limited') fireEvent.click(screen.getByRole('button', { name: '4', exact: true }));
    await finish(kind);
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    const data = JSON.parse(localStorage.getItem(storageKey));
    const saved = kind === 'test-quick' ? data[0] : data[0].matches[0];
    expect(saved.status).toBe('completed');
    expect(kind === 'limited' ? saved.team2Score : saved.innings[3]).toMatchObject({ runs: 4, balls: 1, wickets: 0 });
  });
});
