import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import { deriveTeamColours } from '../../../lib/teamColour';
import Limited from './MonoCricketLiveScore';
import Test from './MonoCricketTestLiveScore';

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, point: vi.fn(), undo: vi.fn(), finalize: vi.fn() }) }));
vi.mock('../../../lib/live/liveSession', () => ({ getConsent: () => 'declined' }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));

function mount(test = false, amend = () => {}) {
  const data = cricketFinishSeed(test ? 'test-tournament' : 'tournament');
  const match = data.se_cricket[0].matches[0];
  match.team1Color = '#2563eb';
  match.team2Color = '#fbbf24';
  if (test) {
    match.draftState.currentInningsIndex = 2;
    match.draftState.innings[0].runs = 200;
    match.draftState.innings[1].runs = 150;
    Object.assign(match.draftState.innings[2], { runs: 20, wickets: 0, balls: 3, allOut: false });
  } else {
    match.format.overs = 20;
    Object.assign(match.draftState.scores.team1, { runs: 164, balls: 120 });
    Object.assign(match.draftState.scores.team2, { runs: 80, balls: 75 });
  }
  amend(match);
  Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  return render(<MemoryRouter initialEntries={['/cricket/tournament/100/match/m1/score']}><Routes><Route path="/:sport/tournament/:id/match/:matchId/score" element={test ? <Test /> : <Limited />} /></Routes></MemoryRouter>);
}

beforeEach(() => { localStorage.clear(); });

describe('aggregate cricket boards', () => {
  it('keeps tournament controls lean and colours the batting side from saved identity', async () => {
    const { container } = mount();
    await screen.findByText('Beta batting');
    expect(container.querySelector('[data-cricket-board]')).toHaveAttribute('data-batting', 'b');
    expect(container.querySelector('[data-cricket-board]')).toHaveStyle({ '--team-b-core': deriveTeamColours('#2563eb', '#fbbf24').B.core });
    expect(container.querySelector('.cricket-mark')).toBeInTheDocument();
    expect(container.querySelector('.ck-players')).not.toBeInTheDocument();
    expect(container.querySelector('.mono-over-strip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wide (+1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No Ball (+1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('shows a tournament undo hint from the stored snapshot and restores the same score', async () => {
    mount(false, match => {
      match.draftState.history = [{ scores: structuredClone(match.draftState.scores), battingTeam: 2, innings: 2, freeHit: false }];
      match.draftState.scores.team2 = { ...match.draftState.scores.team2, runs: 84, balls: 76 };
    });
    await screen.findByText(/Back to 12.3 · 80\/0/);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/Target: 165/)).toHaveTextContent('Need 85');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it.each([{ first: 200, second: 150, label: 'Lead by 70 runs' }, { first: 100, second: 200, label: 'Trail by 80 runs' }])('renders Test innings and $label without a lead colour', async ({ first, second, label }) => {
    mount(true, match => { match.draftState.innings[0].runs = first; match.draftState.innings[1].runs = second; });
    await screen.findByText('3rd Innings');
    expect(screen.getByText(label)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    expect(screen.getByRole('menuitem', { name: 'Declare innings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'End as draw' })).toBeInTheDocument();
  });
});
