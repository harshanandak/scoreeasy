import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import LineScore from './LineScore';

// Builds an event stream. Each spec row is [team, value?, at?, meta?]; `at` is
// SECONDS (goals.js compares it against cumulative durationSec). `meta` carries
// the sport subtype, e.g. { type: 'try' }.
function build(spec) {
  let events = [];
  for (const [team, value = 1, at, meta] of spec) {
    events = appendPoint(events, { team, value, at, meta });
  }
  return events;
}

// FIBA basketball: four 10-minute (600s) quarters.
const BASKETBALL = {
  periods: [
    { label: 'Q1', durationSec: 600 },
    { label: 'Q2', durationSec: 600 },
    { label: 'Q3', durationSec: 600 },
    { label: 'Q4', durationSec: 600 },
  ],
};

afterEach(() => cleanup());

describe('LineScore', () => {
  it('renders a basketball quarter line score with data-driven column labels', () => {
    // A scores in Q1 (at 100) and Q3 (at 1300); B scores in Q2 (at 700).
    const events = build([
      ['A', 2, 100],
      ['B', 3, 700],
      ['A', 2, 1300],
    ]);
    render(<LineScore events={events} config={BASKETBALL} teamA="Reds" teamB="Blues" />);

    const table = screen.getByRole('table');
    // Period labels come straight from config, not hardcoded S1..Sn.
    expect(within(table).getByText('Q1')).toBeInTheDocument();
    expect(within(table).getByText('Q4')).toBeInTheDocument();
    expect(within(table).getByText('Final')).toBeInTheDocument();
    // Two body rows.
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 teams
    expect(within(table).getByText('Reds')).toBeInTheDocument();
    expect(within(table).getByText('Blues')).toBeInTheDocument();
  });

  it("fills only the winner's FINAL cell with the accent (data-winner)", () => {
    // A 4, B 3 → A wins; only one decisive FINAL cell.
    const events = build([
      ['A', 2, 100],
      ['B', 3, 700],
      ['A', 2, 1300],
    ]);
    render(<LineScore events={events} config={BASKETBALL} teamA="Reds" teamB="Blues" />);

    const winners = document.querySelectorAll('[data-winner="true"]');
    expect(winners).toHaveLength(1);
    expect(winners[0]).toHaveTextContent('4');
    expect(winners[0]).toHaveStyle({ background: 'var(--primary)' });
    expect(winners[0]).toHaveStyle({ color: 'var(--primary-foreground)' });
  });

  it('highlights no winner when the match is tied', () => {
    const events = build([
      ['A', 2, 100],
      ['B', 2, 700],
    ]);
    render(<LineScore events={events} config={BASKETBALL} teamA="Reds" teamB="Blues" />);

    expect(document.querySelectorAll('[data-winner="true"]')).toHaveLength(0);
  });

  it('collapses to a single FINAL bucket when no periods config is given', () => {
    const events = build([['A', 1], ['B', 1], ['A', 1]]);
    render(<LineScore events={events} teamA="Reds" teamB="Blues" />);

    const table = screen.getByRole('table');
    // No periods → goals.js emits one FINAL bucket; the header still shows Final.
    expect(within(table).getAllByText('Final').length).toBeGreaterThan(0);
  });
});
