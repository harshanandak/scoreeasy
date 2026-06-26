import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import SegmentSummary from './SegmentSummary';

function build(spec) {
  let events = [];
  for (const [team, value = 1, at] of spec) {
    events = appendPoint(events, { team, value, at });
  }
  return events;
}

afterEach(() => cleanup());

describe('SegmentSummary', () => {
  it('renders a line-score table with team rows and a total column', () => {
    render(
      <SegmentSummary events={build([['A'], ['A'], ['B'], ['A']])} segments={2} teamA="Reds" teamB="Blues" />,
    );

    const table = screen.getByRole('table');
    // Header has S1..S2 + Total.
    expect(within(table).getByRole('columnheader', { name: 'S1' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'S2' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    // Row headers carry the team names.
    expect(within(table).getByRole('rowheader', { name: 'Reds' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Blues' })).toBeInTheDocument();
  });

  it('shows the leader total reflecting the segmented points', () => {
    // A scores 3, B scores 1 -> A total 3, B total 1.
    render(
      <SegmentSummary events={build([['A'], ['A'], ['A'], ['B']])} segments={2} teamA="Reds" teamB="Blues" />,
    );

    const table = screen.getByRole('table');
    const redsRow = within(table).getByRole('rowheader', { name: 'Reds' }).closest('tr');
    // Reds' total cell shows 3.
    expect(within(redsRow).getByText('3')).toBeInTheDocument();
  });

  it('describes how it segmented via the caption', () => {
    render(<SegmentSummary events={build([['A'], ['B']])} segments={3} teamA="Reds" teamB="Blues" />);

    expect(screen.getByText(/Auto-segmented into 3/)).toBeInTheDocument();
  });
});
