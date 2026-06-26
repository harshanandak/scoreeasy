import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import TennisGrid from './TennisGrid';

/** Append one point for `team`. */
function point(events, team) {
  return appendPoint(events, { team, at: events.length + 1 });
}

/** Append `n` consecutive points for `team` (n=4 = a love game). */
function run(events, team, n = 4) {
  let next = events;
  for (let i = 0; i < n; i += 1) next = point(next, team);
  return next;
}

/** Drive `count` alternating love games (A first), reaching count-each games. */
function loveGames(events, count) {
  let next = events;
  for (let i = 0; i < count; i += 1) {
    next = run(next, 'A');
    next = run(next, 'B');
  }
  return next;
}

afterEach(() => cleanup());

describe('TennisGrid', () => {
  it('renders the S1..S5 / GM / PT header columns', () => {
    const events = point([], 'A');
    render(<TennisGrid events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const grid = screen.getByRole('region', { name: 'Tennis set grid' });
    ['S1', 'S2', 'S3', 'S4', 'S5', 'GM', 'PT'].forEach((label) => {
      expect(within(grid).getByText(label)).toBeInTheDocument();
    });
  });

  it('shows the live point in the PT column via the 15/30/40/AD ladder', () => {
    // 3-3 then A wins a point -> A 'AD', B '40' in their PT cells.
    let events = [];
    for (let i = 0; i < 3; i += 1) {
      events = point(events, 'A');
      events = point(events, 'B');
    }
    events = point(events, 'A');
    render(<TennisGrid events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const rowA = screen.getByRole('row', { name: /Alcaraz/ });
    expect(within(rowA).getByText('AD')).toBeInTheDocument();
  });

  it('renders a completed 6-4 set in the S1 column with the winner bolded', () => {
    let events = loveGames([], 4); // 4-4
    events = run(events, 'A');
    events = run(events, 'A'); // 6-4 to A
    render(<TennisGrid events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const rowA = screen.getByRole('row', { name: /Alcaraz/ });
    const rowB = screen.getByRole('row', { name: /Sinner/ });
    const winA = within(rowA).getByText('6');
    expect(winA.style.fontWeight).toBe('800');
    expect(within(rowB).getByText('4').style.fontWeight).toBe('400');
  });

  it('appends the tiebreak mini-score as a superscript (7-6(4))', () => {
    let events = loveGames([], 6); // 6-6
    for (let i = 0; i < 4; i += 1) {
      events = point(events, 'A');
      events = point(events, 'B');
    }
    events = run(events, 'A', 3); // A 7-4 tiebreak -> 7-6
    render(<TennisGrid events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const rowB = screen.getByRole('row', { name: /Sinner/ });
    const sup = within(rowB).getByText('4'); // loser tiebreak points, unique
    expect(sup.tagName).toBe('SUP');
  });

  it('marks the serving player row with a serving dot', () => {
    const events = point([], 'A'); // server defaults to A
    render(<TennisGrid events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const dots = screen.getAllByRole('img', { name: 'Serving' });
    expect(dots).toHaveLength(1);
    const rowA = screen.getByRole('row', { name: /Alcaraz/ });
    const dot = within(rowA).getByRole('img', { name: 'Serving' });
    expect(dot.style.background).toContain('var(--primary)');
  });
});
