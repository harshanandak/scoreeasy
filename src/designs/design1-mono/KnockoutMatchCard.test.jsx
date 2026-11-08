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
    const totals = [...container.querySelectorAll('.text-3xl')].map(node => node.textContent);
    expect.soft(totals, 'only completed sets count toward knockout-card totals').toEqual(abandoned ? ['0', '0'] : ['2', '0']);
    expect.soft(screen.queryByText(abandoned ? 'Abandoned · no result' : 'Completed'), 'knockout-card outcome label').toBeInTheDocument();
    const chips = container.querySelectorAll('span.rounded.font-mono');
    for (const chip of chips) {
      if (abandoned) {
        expect.soft(chip, 'abandoned knockout-card chip has no winner colour').not.toHaveStyle({ background: '#dcfce7' });
        expect.soft(chip, 'abandoned knockout-card chip has no loser colour').not.toHaveStyle({ background: '#fee2e2' });
        expect.soft(chip.firstElementChild, 'abandoned knockout-card score has no winner emphasis').toHaveStyle({ fontWeight: 'normal' });
      } else {
        expect(chip, 'decided knockout-card winning sets stay green').toHaveStyle({ background: '#dcfce7' });
        expect(chip.firstElementChild).toHaveStyle({ fontWeight: '600' });
      }
    }
    expect(chips).toHaveLength(abandoned ? 1 : 2);
    if (!abandoned) {
      expect(screen.getByText('Alpha')).toHaveStyle({ color: '#111' });
      expect(screen.getByText('Beta')).toHaveStyle({ color: '#888' });
    }
  });
});
