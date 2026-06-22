import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import GoalsTimeline from './GoalsTimeline';

// Builds an event stream. Each spec row is [team, value?, at?, meta?]; `at` is
// SECONDS, `meta` carries the sport subtype (e.g. { type: 'try' }).
function build(spec) {
  let events = [];
  for (const [team, value = 1, at, meta] of spec) {
    events = appendPoint(events, { team, value, at, meta });
  }
  return events;
}

// Football: two 45-minute (2700s) halves.
const FOOTBALL = {
  periods: [
    { label: '1H', durationSec: 2700 },
    { label: '2H', durationSec: 2700 },
  ],
};

// Rugby: two 40-minute (2400s) halves.
const RUGBY = {
  periods: [
    { label: 'H1', durationSec: 2400 },
    { label: 'H2', durationSec: 2400 },
  ],
};

afterEach(() => cleanup());

describe('GoalsTimeline', () => {
  it('renders one football goal per scoring event with running totals', () => {
    // 34' A goal (at 2040), 50' B goal (2nd half, at 3000), 70' A goal (at 4200).
    const events = build([
      ['A', 1, 2040],
      ['B', 1, 3000],
      ['A', 1, 4200],
    ]);
    render(
      <GoalsTimeline
        events={events}
        config={FOOTBALL}
        teamA="Reds"
        teamB="Blues"
        defaultNewestFirst={false}
      />,
    );

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getAllByText('Reds').length).toBeGreaterThan(0);
    // Running totals appear (1-0, 1-1, 2-1).
    expect(within(list).getByText('2-1')).toBeInTheDocument();
    // Minute (34') derived from the seconds clock, not ms.
    expect(within(list).getByText(/34/)).toBeInTheDocument();
  });

  it('renders a rugby +5 / +2 / +3 row with the scoring TYPE and running score', () => {
    // TRY +5 (5-0), CON +2 (7-0), PEN +3 to B (7-3).
    const events = build([
      ['A', 5, 720, { type: 'try' }],
      ['A', 2, 840, { type: 'conversion' }],
      ['B', 3, 1680, { type: 'penalty' }],
    ]);
    render(
      <GoalsTimeline
        events={events}
        config={RUGBY}
        teamA="Reds"
        teamB="Blues"
        defaultNewestFirst={false}
      />,
    );

    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    // First row: TRY +5 → 5-0.
    expect(within(items[0]).getByText('try')).toBeInTheDocument();
    expect(within(items[0]).getByText('+5')).toBeInTheDocument();
    expect(within(items[0]).getByText('5-0')).toBeInTheDocument();
    // Second row: CON +2 → 7-0.
    expect(within(items[1]).getByText('conversion')).toBeInTheDocument();
    expect(within(items[1]).getByText('+2')).toBeInTheDocument();
    // Third row: PEN +3 to B → 7-3.
    expect(within(items[2]).getByText('penalty')).toBeInTheDocument();
    expect(within(items[2]).getByText('7-3')).toBeInTheDocument();
  });

  it('flags the row where the lead changes', () => {
    // A leads (1-0), B ties (1-1), B leads (1-2) -> lead change on the 3rd row.
    const events = build([
      ['A', 1, 600],
      ['B', 1, 1200],
      ['B', 1, 1800],
    ]);
    render(
      <GoalsTimeline
        events={events}
        config={FOOTBALL}
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
    const events = build([['A', 1, 600], ['B', 1, 1200]]);
    render(<GoalsTimeline events={events} config={FOOTBALL} teamA="Reds" teamB="Blues" />);

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveTextContent(/Newest first/i);
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent(/Oldest first/i);
  });

  it('shows an empty state when there is no scoring', () => {
    render(<GoalsTimeline events={[]} config={FOOTBALL} teamA="Reds" teamB="Blues" />);

    expect(screen.getByText('No scoring yet.')).toBeInTheDocument();
  });
});
