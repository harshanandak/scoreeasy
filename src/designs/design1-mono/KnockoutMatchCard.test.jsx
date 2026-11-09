import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KnockoutMatchCard from './KnockoutMatchCard';

describe('knockout card set outcomes', () => {
  it.each(['abandoned', 'decided'])('renders a %s volleyball result without inventing a won set', (resultType) => {
    const abandoned = resultType === 'abandoned';
    const match = {
      id: 'semi-1', label: 'Semi-final', team1Id: 1, team2Id: 2,
      status: 'completed', resultType, winner: abandoned ? null : 1,
      sets: abandoned ? [{ score1: 2, score2: 1, completed: false }]
        : [{ score1: 25, score2: 23, completed: true }, { score1: 25, score2: 20, completed: true }],
    };
    const { container } = render(<KnockoutMatchCard match={match} tournament={{ format: { type: 'best-of', sets: 3 } }} sport="volleyball" id="1" engine="sets" navigate={vi.fn()} getTeamName={id => id === 1 ? 'Alpha' : 'Beta'} />);
    const totals = [...container.querySelectorAll('.kit-fx-score')].map(node => node.textContent);
    expect.soft(totals, 'only completed sets count toward knockout-card totals').toEqual(abandoned ? ['0', '0'] : ['2', '0']);
    expect.soft(screen.queryByText(abandoned ? 'Abandoned · no result' : 'Completed'), 'knockout-card outcome label').toBeInTheDocument();
    const chips = container.querySelectorAll('.kit-fx-set');
    for (const chip of chips) {
      if (abandoned) {
        expect.soft(chip, 'abandoned knockout-card chip has no winner colour').not.toHaveClass('is-won');
        expect.soft(chip, 'abandoned knockout-card chip has no loser colour').not.toHaveClass('is-lost');
        expect.soft(chip.querySelector('b'), 'abandoned knockout-card score has no winner emphasis').toBeNull();
      } else {
        expect(chip, 'decided knockout-card winning sets stay won').toHaveClass('is-won');
        expect(chip.querySelector('b')).toHaveTextContent('25');
      }
    }
    expect(chips).toHaveLength(abandoned ? 1 : 2);
    if (!abandoned) {
      expect(screen.getByText('Alpha').closest('.kit-last-team')).toHaveClass('is-winner');
      expect(screen.getByText('Beta').closest('.kit-last-team')).toHaveClass('is-loser');
    }
  });
});

describe('cricket knockout card display', () => {
  const names = (id) => (id === 'A' ? 'Alpha' : 'Beta');
  const renderCard = (match, tournament) => render(
    <KnockoutMatchCard match={match} tournament={tournament} sport="cricket" id="1" engine="custom-cricket" navigate={vi.fn()} getTeamName={names} />,
  );

  it('shows the innings lines and result of a completed Test knockout whose team scores were never set', () => {
    // Knockouts start with team1Score and team2Score null, and the Test scorer saves innings, winner and
    // winDesc without setting them.
    const match = {
      id: 'final', round: 'final', label: 'Final', team1Id: 'A', team2Id: 'B', status: 'completed',
      winner: 'A', winDesc: 'Won by 56 runs', team1Score: null, team2Score: null,
      innings: [
        { teamId: 'A', runs: 243, wickets: 10, balls: 300, allOut: true },
        { teamId: 'B', runs: 187, wickets: 6, balls: 250, declared: true },
      ],
    };
    renderCard(match, { format: { preset: 'test', overs: null, totalInnings: 4 } });
    expect(screen.getByText('243/all')).toBeInTheDocument();
    expect(screen.getByText('187/6d')).toBeInTheDocument();
    expect(screen.getByText('Won by 56 runs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Score' })).toBeInTheDocument();
  });

  it('counts a knockout innings in balls when the knockout format tracks balls and the group format tracks overs', () => {
    // The scorer falls back to knockoutConfig.format for a knockout match without its own format.
    const match = {
      id: 'final', round: 'final', label: 'Final', team1Id: 'A', team2Id: 'B', status: 'completed', winner: 'A',
      winDesc: 'Won by 5 runs', team1Score: { runs: 40, wickets: 2, balls: 30 }, team2Score: { runs: 35, wickets: 3, balls: 30 },
    };
    const tournament = {
      format: { preset: 'custom', overs: 5, trackOvers: true },
      knockoutConfig: { teamsAdvancing: 2, format: { preset: 'custom', overs: 5, trackOvers: false } },
    };
    renderCard(match, tournament);
    expect(screen.getAllByText('30 balls')).toHaveLength(2);
    expect(screen.queryByText('5 ov')).not.toBeInTheDocument();
  });
});
