import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import GenericTimeline from './GenericTimeline';

function build(spec) {
  let events = [];
  for (const [team, value = 1, at] of spec) {
    events = appendPoint(events, { team, value, at });
  }
  return events;
}

afterEach(() => cleanup());

describe('GenericTimeline', () => {
  it('renders one row per point with running totals and team names', () => {
    render(
      <GenericTimeline
        events={build([['A'], ['B'], ['A']])}
        teamA="Reds"
        teamB="Blues"
        defaultNewestFirst={false}
      />,
    );

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getAllByText('Reds').length).toBeGreaterThan(0);
    // Running totals appear (e.g. "1-0", "1-1", "2-1").
    expect(within(list).getByText('2-1')).toBeInTheDocument();
  });

  it('flags the row where the lead changes', () => {
    // 1-0 (A), 1-1 (tie), 1-2 (B leads -> lead change on this row).
    render(
      <GenericTimeline
        events={build([['A'], ['B'], ['B']])}
        teamA="Reds"
        teamB="Blues"
        defaultNewestFirst={false}
      />,
    );

    const list = screen.getByRole('list');
    const changeRows = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('data-lead-change') === 'true');
    expect(changeRows).toHaveLength(1);
    expect(within(changeRows[0]).getByText(/Lead change/i)).toBeInTheDocument();
  });

  it('toggles ordering between newest-first and oldest-first', () => {
    render(<GenericTimeline events={build([['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveTextContent(/Newest first/i);
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent(/Oldest first/i);
  });

  it('shows an empty state when there are no points', () => {
    render(<GenericTimeline events={[]} teamA="Reds" teamB="Blues" />);

    expect(screen.getByText('No points yet.')).toBeInTheDocument();
  });
});
