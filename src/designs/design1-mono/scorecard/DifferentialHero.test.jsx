import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import DifferentialHero from './DifferentialHero';

function build(spec) {
  let events = [];
  for (const [team, value = 1, at] of spec) {
    events = appendPoint(events, { team, value, at });
  }
  return events;
}

afterEach(() => cleanup());

describe('DifferentialHero', () => {
  it('renders the live +N differential and names the leader', () => {
    // A 3, B 1 -> differential +2, leader A.
    render(<DifferentialHero events={build([['A'], ['A'], ['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    const hero = screen.getByRole('region', { name: 'Differential' });
    expect(within(hero).getByText('+2')).toBeInTheDocument();
    expect(within(hero).getByText('Reds')).toBeInTheDocument();
    expect(within(hero).getByText('ahead')).toBeInTheDocument();
  });

  it('shows +0 and a tie state when level', () => {
    render(<DifferentialHero events={build([['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    const hero = screen.getByRole('region', { name: 'Differential' });
    expect(within(hero).getByText('+0')).toBeInTheDocument();
    expect(within(hero).getByText('Tied')).toBeInTheDocument();
  });

  it('uses the brutal hero shadow in the primary accent', () => {
    render(<DifferentialHero events={build([['A']])} teamA="Reds" teamB="Blues" />);

    const hero = screen.getByRole('region', { name: 'Differential' });
    expect(hero).toHaveStyle({ boxShadow: '4px 4px 0 var(--primary)' });
    expect(hero).toHaveStyle({ borderRadius: 'var(--radius)' });
  });

  it('renders +0 with no leader on an empty stream', () => {
    render(<DifferentialHero events={[]} teamA="Reds" teamB="Blues" />);

    const hero = screen.getByRole('region', { name: 'Differential' });
    expect(within(hero).getByText('+0')).toBeInTheDocument();
    expect(within(hero).getByText('Tied')).toBeInTheDocument();
  });
});
