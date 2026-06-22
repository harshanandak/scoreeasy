import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import LeaderStrip from './LeaderStrip';

function build(spec) {
  let events = [];
  for (const [team, value = 1, at] of spec) {
    events = appendPoint(events, { team, value, at });
  }
  return events;
}

afterEach(() => cleanup());

describe('LeaderStrip', () => {
  it('shows both team shares and the leader margin', () => {
    // A scores 3, B scores 1 -> A 75%, B 25%, leader A +2.
    render(<LeaderStrip events={build([['A'], ['A'], ['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    const strip = screen.getByRole('region', { name: 'Leader strip' });
    // Proportional segments carry each team's unique share percentage.
    expect(within(strip).getByText('75%')).toBeInTheDocument();
    expect(within(strip).getByText('25%')).toBeInTheDocument();
    // The leader caption names the leader and the margin.
    expect(within(strip).getByText('Reds +2')).toBeInTheDocument();
  });

  it('shows a tie when shares are even', () => {
    render(<LeaderStrip events={build([['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    expect(screen.getByText('Tied')).toBeInTheDocument();
  });
});
