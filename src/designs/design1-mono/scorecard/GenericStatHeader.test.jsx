import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import GenericStatHeader from './GenericStatHeader';

/** Builds a point stream from [team, value?, at?] tuples. */
function build(spec) {
  let events = [];
  for (const [team, value = 1, at] of spec) {
    events = appendPoint(events, { team, value, at });
  }
  return events;
}

afterEach(() => cleanup());

describe('GenericStatHeader', () => {
  it('names the leader and shows the margin', () => {
    render(<GenericStatHeader events={build([['A'], ['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    const header = screen.getByRole('region', { name: 'Match stat header' });
    expect(within(header).getByText('Reds')).toBeInTheDocument();
    expect(within(header).getByText('leads by', { exact: false })).toBeInTheDocument();
    // margin 2-1 -> +1
    expect(within(header).getByText('1', { selector: 'span' })).toBeInTheDocument();
  });

  it('renders the live tabular score', () => {
    render(<GenericStatHeader events={build([['A'], ['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    const header = screen.getByRole('region', { name: 'Match stat header' });
    // Score line "2 – 1" is split across text nodes; match the paragraph by its
    // combined textContent.
    expect(
      within(header).getByText((_, el) => el?.tagName === 'P' && el.textContent === '2 – 1'),
    ).toBeInTheDocument();
  });

  it('shows a tie when scores are level', () => {
    render(<GenericStatHeader events={build([['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    expect(screen.getByText('Tied')).toBeInTheDocument();
  });

  it('surfaces lead-change and biggest-run stats with the right team', () => {
    // A leads, B ties then leads: one lead change. B then goes on a 3-run.
    render(
      <GenericStatHeader
        events={build([['A'], ['B'], ['B'], ['B'], ['B']])}
        teamA="Reds"
        teamB="Blues"
      />,
    );

    const header = screen.getByRole('region', { name: 'Match stat header' });
    expect(within(header).getByText('Lead changes')).toBeInTheDocument();
    // Biggest run is Blues' run; the cell text includes the team name.
    expect(within(header).getByText(/Blues 4-0/)).toBeInTheDocument();
  });
});
