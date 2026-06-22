import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import VolleyballMatrix from './VolleyballMatrix';

const VB = { pointsPerSet: 25, deciderPoints: 15, winBy: 2, bestOf: 5 };

/** Append one point for `team`. */
function point(events, team) {
  return appendPoint(events, { team, at: events.length + 1 });
}

/**
 * Append ONE COMPLETE set ending exactly (a, b): alternate up to min(a, b), then
 * the winner scores the remainder so the clinching point lands last. Chains to
 * build multi-set fixtures. Mirrors the engine test's `playSet`.
 */
function playSet(events, a, b) {
  let next = events;
  const shared = Math.min(a, b);
  for (let i = 0; i < shared; i += 1) {
    next = point(next, 'A');
    next = point(next, 'B');
  }
  const winner = a > b ? 'A' : 'B';
  for (let i = 0; i < Math.abs(a - b); i += 1) {
    next = point(next, winner);
  }
  return next;
}

/** Open the current set to (a, b) without closing it (leader stays +<=|a-b|). */
function interleaveOpen(events, a, b) {
  let next = events;
  const shared = Math.min(a, b);
  for (let i = 0; i < shared; i += 1) {
    next = point(next, 'A');
    next = point(next, 'B');
  }
  const leader = a >= b ? 'A' : 'B';
  for (let i = 0; i < Math.abs(a - b); i += 1) {
    next = point(next, leader);
  }
  return next;
}

/** Find the data row whose row-header cell is `name`. */
function row(name) {
  return screen.getByRole('row', { name: new RegExp(`^${name}\\b`) });
}

afterEach(() => cleanup());

describe('VolleyballMatrix', () => {
  it('renders the TEAM / SET 1..5 / SETS header columns', () => {
    render(<VolleyballMatrix events={[]} config={VB} teamA="Reds" teamB="Blues" />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Team')).toBeInTheDocument();
    expect(within(table).getByText('Set 1')).toBeInTheDocument();
    expect(within(table).getByText('Set 5')).toBeInTheDocument();
    expect(within(table).getByText('Sets')).toBeInTheDocument();
  });

  it('shows exactly two data rows, one per team', () => {
    render(<VolleyballMatrix events={[]} config={VB} teamA="Reds" teamB="Blues" />);
    expect(screen.getByRole('rowheader', { name: 'Reds' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Blues' })).toBeInTheDocument();
  });

  it('renders completed set scores for both teams', () => {
    let events = playSet([], 25, 20); // set 1: A 25-20
    events = playSet(events, 18, 25); // set 2: B 25-18
    render(<VolleyballMatrix events={events} config={VB} teamA="Reds" teamB="Blues" />);

    const reds = within(row('Reds'));
    const blues = within(row('Blues'));
    // Set 1 cells.
    expect(reds.getByText('25')).toBeInTheDocument();
    expect(blues.getByText('20')).toBeInTheDocument();
    // Set 2 cells.
    expect(reds.getByText('18')).toBeInTheDocument();
    expect(blues.getByText('25')).toBeInTheDocument();
  });

  it('shows the SETS column with the sets-won totals', () => {
    let events = playSet([], 25, 20); // A
    events = playSet(events, 18, 25); // B
    events = playSet(events, 25, 15); // A -> A leads 2-1
    render(<VolleyballMatrix events={events} config={VB} teamA="Reds" teamB="Blues" />);

    // SETS is the last cell of each row.
    const redsCells = within(row('Reds')).getAllByRole('cell');
    const bluesCells = within(row('Blues')).getAllByRole('cell');
    expect(redsCells[redsCells.length - 1]).toHaveTextContent('2');
    expect(bluesCells[bluesCells.length - 1]).toHaveTextContent('1');
  });

  it('gives the set winner cell a var(--primary) left-border accent', () => {
    const events = playSet([], 25, 20); // A wins set 1
    render(<VolleyballMatrix events={events} config={VB} teamA="Reds" teamB="Blues" />);

    // A's set-1 cell (winner) carries the accent border; B's does not.
    const winnerCell = within(row('Reds')).getByText('25');
    const loserCell = within(row('Blues')).getByText('20');
    expect(winnerCell.style.borderLeft).toContain('var(--primary)');
    expect(winnerCell.style.fontWeight).toBe('800');
    expect(loserCell.style.borderLeft).not.toContain('var(--primary)');
  });

  it('shows the live set current points (in-progress, not yet won)', () => {
    let events = playSet([], 25, 20); // set 1 done (A)
    events = interleaveOpen(events, 12, 9); // set 2 live at 12-9
    render(<VolleyballMatrix events={events} config={VB} teamA="Reds" teamB="Blues" />);

    const reds = within(row('Reds'));
    const blues = within(row('Blues'));
    expect(reds.getByText('12')).toBeInTheDocument(); // live set-2 points
    expect(blues.getByText('9')).toBeInTheDocument();
  });

  it('bolds the match winner team name', () => {
    let events = playSet([], 25, 10);
    events = playSet(events, 25, 12);
    events = playSet(events, 25, 14); // A wins bo5 3-0
    render(<VolleyballMatrix events={events} config={VB} teamA="Reds" teamB="Blues" />);

    expect(screen.getByRole('rowheader', { name: 'Reds' }).style.fontWeight).toBe('800');
    expect(screen.getByRole('rowheader', { name: 'Blues' }).style.fontWeight).toBe('600');
  });
});
