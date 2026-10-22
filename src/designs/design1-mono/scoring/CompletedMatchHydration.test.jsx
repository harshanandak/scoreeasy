import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MonoGoalsLiveScore from './MonoGoalsLiveScore';
import MonoSetsLiveScore from './MonoSetsLiveScore';
import MonoTennisLiveScore from './MonoTennisLiveScore';
import MonoCricketLiveScore from './MonoCricketLiveScore';
import MonoCricketGuidedScorerRoute from './MonoCricketGuidedScorerRoute';
import MonoQuickMatch from '../MonoQuickMatch';
import { loadSportTournaments, saveQuickMatch } from '../../../utils/storage';

const live = vi.hoisted(() => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => live }));
vi.mock('../../../lib/live/liveSession', () => ({ getConsent: () => 'accepted' }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));
vi.mock('../utils/confetti', () => ({ triggerConfetti: vi.fn() }));

function Location() {
  const location = useLocation();
  return <output aria-label="Hydrated route">{location.pathname}</output>;
}

const cases = [
  { name: 'goals', sport: 'football', Component: MonoGoalsLiveScore },
  { name: 'sets', sport: 'volleyball', Component: MonoSetsLiveScore, result: true },
  { name: 'tennis tournament', sport: 'tennis', Component: MonoTennisLiveScore },
  { name: 'limited cricket', sport: 'cricket', Component: MonoCricketLiveScore },
  { name: 'guided cricket', sport: 'cricket', Component: MonoCricketGuidedScorerRoute },
  { name: 'tennis quick', sport: 'tennis', Component: MonoTennisLiveScore, quick: true },
  { name: 'tennis quick without its removed draft', sport: 'tennis', Component: MonoTennisLiveScore, quick: true, withoutDraft: true },
  { name: 'quick goals', sport: 'football', Component: MonoQuickMatch, quick: true },
  { name: 'quick sets', sport: 'volleyball', Component: MonoQuickMatch, quick: true },
  { name: 'quick cricket', sport: 'cricket', Component: MonoQuickMatch, quick: true },
];

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());

describe.each(cases)('persisted completion: $name', ({ sport, Component, result, quick, withoutDraft }) => {
  it('keeps the persisted completed result authoritative during hydration', async () => {
    const match = {
      id: 300, sport, team1Id: 'A', team2Id: 'B', team1: 'Alpha', team2: 'Beta',
      team1Name: 'Alpha', team2Name: 'Beta', status: 'completed', winner: 'A',
      score1: 1, score2: 0, completedAt: '2026-10-22T10:00:00Z',
      sets: [{ score1: 1, score2: 0, completed: true }],
      team1Score: { runs: 1, balls: 1, wickets: 0 }, team2Score: { runs: 0, balls: 1, wickets: 0 },
      format: { type: 'single', sets: 1, points: 25, preset: 'custom', overs: 1, players: 11 },
    };
    const draft = {
      id: 300, quickMatchId: 300, sport, phase: 'scoring', status: 'in-progress',
      team1Name: 'Alpha', team2Name: 'Beta', gScore1: 0, gScore2: 0,
      scores: { team1: { runs: 0, balls: 0, wickets: 0 }, team2: { runs: 0, balls: 0, wickets: 0 } },
      sets: [{ score1: 0, score2: 0, games1: 0, games2: 0, points1: 0, points2: 0, completed: false }],
      currentSet: 0, innings: 1, battingTeam: 1, history: [],
      format: match.format,
    };
    const tournament = {
      id: 100, format: match.format, teams: [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Beta' }],
      matches: [{ ...match, id: 'm1', draftState: { ...draft, score1: 0, score2: 0 } }], knockoutMatches: [],
    };
    if (quick) {
      saveQuickMatch(match);
      if (!withoutDraft) localStorage.setItem(sport === 'tennis' ? 'se_tennis_quick_draft_300' : `se_quickmatch_draft_${sport}`, JSON.stringify(draft));
    } else {
      localStorage.setItem(`se_${sport}`, JSON.stringify([tournament]));
      loadSportTournaments(`se_${sport}`);
    }
    const key = quick ? 'se_quickmatches' : `se_${sport}`;
    const persisted = JSON.parse(localStorage.getItem(key));
    const start = quick ? (sport === 'tennis' ? '/tennis/quick/live/300' : `/${sport}/quick`) : `/${sport}/tournament/100/match/m1/score`;
    const destination = quick ? '/history' : `/${sport}/tournament/100${result ? '/match/m1/result' : ''}`;
    render(
      <MemoryRouter initialEntries={[start]}>
        <Location />
        <Routes>
          <Route path="/:sport/tournament/:id/match/:matchId/score" element={<Component />} />
          <Route path="/:sport/quick/live/:matchId" element={<Component storageMode="quick" />} />
          <Route path="/:sport/quick" element={<Component />} />
          <Route path={destination} element={<h1>Saved result</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Hydrated route').textContent).toBe(destination));
    fireEvent.keyDown(globalThis, { key: 'q' });
    fireEvent.keyDown(globalThis, { key: '4' });
    expect(JSON.parse(localStorage.getItem(key))).toEqual(persisted);
    expect(live.point).not.toHaveBeenCalled();
    expect(live.undo).not.toHaveBeenCalled();
    expect(live.finalize).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Add.*point|Four runs|Finish/ })).not.toBeInTheDocument();
  });
});
