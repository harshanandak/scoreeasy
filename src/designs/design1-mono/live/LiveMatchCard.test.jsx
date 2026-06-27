import { render, screen, within, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LiveMatchCard from './LiveMatchCard';

afterEach(cleanup);

const setsItem = {
  token: 'TOK1',
  sport: 'volleyball',
  scorecardKind: 'volleyball',
  pointsA: 18,
  pointsB: 21,
  setsA: 1,
  setsB: 0,
  servingTeam: 'A',
  periodLabel: 'SET 2',
  teamA: { name: 'Reds' },
  teamB: { name: 'Blues' },
};

describe('LiveMatchCard', () => {
  it('links to the token watch page and shows teams, score, period + LIVE badge', () => {
    render(<MemoryRouter><LiveMatchCard item={setsItem} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /Reds versus Blues/i });
    expect(link).toHaveAttribute('href', '/live/TOK1');
    expect(within(link).getByText('Reds')).toBeInTheDocument();
    expect(within(link).getByText('Blues')).toBeInTheDocument();
    expect(within(link).getByText('18')).toBeInTheDocument();
    expect(within(link).getByText('21')).toBeInTheDocument();
    expect(within(link).getByText('SET 2')).toBeInTheDocument();
    expect(within(link).getByLabelText('Live')).toBeInTheDocument();
    expect(within(link).getByLabelText('Serving')).toBeInTheDocument(); // A serving
    // Set-tally branch ON: one tally cell per team, showing the set counts.
    const sets = link.querySelectorAll('.live-card-sets');
    expect(sets).toHaveLength(2);
    expect([...sets].map((s) => s.textContent)).toEqual(['1', '0']);
  });

  it('omits the set tally for flat-point sports (goals)', () => {
    const goals = {
      token: 'TOK2',
      sport: 'football',
      scorecardKind: 'goals',
      pointsA: 3,
      pointsB: 2,
      setsA: 0,
      setsB: 0,
      teamA: { name: 'Alpha' },
      teamB: { name: 'Beta' },
    };
    render(<MemoryRouter><LiveMatchCard item={goals} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /Alpha versus Beta/i });
    expect(within(link).getByText('3')).toBeInTheDocument();
    expect(within(link).getByText('2')).toBeInTheDocument();
    expect(within(link).queryByLabelText('Serving')).not.toBeInTheDocument();
    // Set-tally branch OFF for flat-point sports — no tally cells at all.
    expect(link.querySelectorAll('.live-card-sets')).toHaveLength(0);
  });
});
