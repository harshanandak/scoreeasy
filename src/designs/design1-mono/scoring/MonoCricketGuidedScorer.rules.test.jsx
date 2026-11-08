import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { applyDelivery, createInnings, makeDelivery, makeFormat } from '../../../utils/cricketEngine';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import MonoCricketGuidedScorer from './MonoCricketGuidedScorer';
import MonoCricketGuidedScorerRoute from './MonoCricketGuidedScorerRoute';

const tap = name => fireEvent.click(screen.getByRole('button', { name }));
function scorer(format, props = {}) {
  return render(<MonoCricketGuidedScorer format={format} striker="A" nonStriker="B" bowler="C" {...props} />);
}

describe('guided setup rules', () => {
  beforeEach(() => localStorage.clear());

  it('honours the setup free-hit choice instead of the engine default', () => {
    scorer({ overs: 5, players: 6, freeHit: false });
    tap('No-ball');
    expect(screen.queryByTestId('freehit-badge')).not.toBeInTheDocument();
  });

  it('ends at the configured player count', () => {
    const onComplete = vi.fn();
    scorer({ overs: 5, players: 2 }, { onComplete });
    tap('Wicket'); tap('Bowled');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ reason: 'allout', wkts: 1 }));
  });

  it('lets the last batter continue, then ends on the final wicket', () => {
    const onComplete = vi.fn();
    scorer({ overs: 5, players: 2, lastManStands: true }, { onComplete });
    tap('Wicket'); tap('Bowled');
    expect(screen.queryByRole('dialog', { name: 'New batter' })).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    tap('Single');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('1/1');
    tap('Wicket'); tap('Bowled');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ reason: 'allout', wkts: 2 }));
  });

  it.each([
    [{ overs: 1, players: 11, ballsPerOver: 2 }, 2],
    [{ trackOvers: false, maxBalls: 2, players: 11 }, 2],
  ])('ends on the configured legal-ball limit: %j', (format, balls) => {
    const onComplete = vi.fn();
    scorer(format, { onComplete });
    tap('Wide');
    for (let i = 0; i < balls; i++) tap('Dot');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ reason: 'overs', legalBalls: balls }));
  });

  it('undoes the innings-ending ball from the break and survives refresh', () => {
    const format = makeFormat({ oversPerInnings: 1, ballsPerOver: 2 });
    let innings = createInnings({ striker: 'A', nonStriker: 'B', bowler: 'C' });
    for (let i = 0; i < 2; i++) innings = applyDelivery(innings, makeDelivery({ batsmanRuns: 1 }), format);
    saveSportTournament('se_cricket', {
      id: 1, teams: [{ id: 'a', name: 'Royals' }, { id: 'b', name: 'Strikers' }],
      matches: [{ id: 'm', team1Id: 'a', team2Id: 'b', format,
        status: 'in-progress', draftState: { phase: 'break', innings1: innings, target: 3,
          openers1: { striker: 'A', nonStriker: 'B', bowler: 'C' } } }],
    });
    const route = () => render(<MemoryRouter initialEntries={['/cricket/tournament/1/score/m']}>
      <Routes><Route path="/:sport/tournament/:id/score/:matchId" element={<MonoCricketGuidedScorerRoute />} /></Routes>
    </MemoryRouter>);
    let view = route();
    tap('Undo last ball');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('1/0');
    const saved = loadSportTournaments('se_cricket')[0].matches[0];
    expect(saved.draftState.phase).toBe('innings1');
    expect(saved.draftState.target).toBeNull();
    expect(saved.team1Score).toMatchObject({ runs: 1, balls: 1, allOut: false });
    view.unmount(); view = route();
    expect(screen.getByTestId('hero-score')).toHaveTextContent('1/0');
    view.unmount();
  });
});
