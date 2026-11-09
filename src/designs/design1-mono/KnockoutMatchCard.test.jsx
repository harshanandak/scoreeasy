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
