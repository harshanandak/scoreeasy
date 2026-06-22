import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import VolleyballScorebug from './VolleyballScorebug';

const VB = { pointsPerSet: 25, deciderPoints: 15, winBy: 2, bestOf: 5 };

/** Append one point for `team`. */
function point(events, team) {
  return appendPoint(events, { team, at: events.length + 1 });
}

/**
 * Reach an OPEN live score (a, b) without closing the set: alternate up to
 * min(a, b), then the leader scores the remainder. Caller keeps (a, b) below the
 * win condition. Mirrors the engine test's `interleave` helper.
 */
function interleave(a, b) {
  let events = [];
  const shared = Math.min(a, b);
  for (let i = 0; i < shared; i += 1) {
    events = point(events, 'A');
    events = point(events, 'B');
  }
  const leader = a >= b ? 'A' : 'B';
  for (let i = 0; i < Math.abs(a - b); i += 1) {
    events = point(events, leader);
  }
  return events;
}

/** Append a stored serve_change event (engine state, not a scoring row). */
function serveChange(events, team) {
  const seq = events.length === 0 ? 1 : Number(events[events.length - 1].seq ?? 0) + 1;
  return [...events, { seq, type: 'serve_change', team, servingAfter: team, at: seq }];
}

afterEach(() => cleanup());

describe('VolleyballScorebug', () => {
  it('renders both team names, the live set points, and the set label', () => {
    const events = interleave(15, 11); // open set 1, A 15-11
    render(<VolleyballScorebug events={events} config={VB} teamA="Reds" teamB="Blues" />);

    const bug = screen.getByRole('region', { name: 'Volleyball scorebug' });
    expect(within(bug).getByText('Reds')).toBeInTheDocument();
    expect(within(bug).getByText('Blues')).toBeInTheDocument();
    expect(within(bug).getByText('15')).toBeInTheDocument();
    expect(within(bug).getByText('11')).toBeInTheDocument();
    expect(within(bug).getByText('SET 1')).toBeInTheDocument();
  });

  it('shows the sets-won totals after a completed set', () => {
    // A wins set 1 25-10, then plays into set 2 at 5-3.
    let events = interleave(25, 10); // closes set 1 (A) on the last point
    for (let i = 0; i < 3; i += 1) {
      events = point(events, 'A');
      events = point(events, 'B');
    }
    events = point(events, 'A'); // 4-3
    events = point(events, 'A'); // 5-3
    render(<VolleyballScorebug events={events} config={VB} teamA="Reds" teamB="Blues" />);

    const bug = screen.getByRole('region', { name: 'Volleyball scorebug' });
    // Set 2 in progress; live points 5-3.
    expect(within(bug).getByText('SET 2')).toBeInTheDocument();
    expect(within(bug).getByText('5')).toBeInTheDocument();
    expect(within(bug).getByText('3')).toBeInTheDocument();
    // Sets-won pills: A has 1, B has 0 (distinct from the live points 5/3).
    expect(within(bug).getByText('1')).toBeInTheDocument();
    expect(within(bug).getByText('0')).toBeInTheDocument();
  });

  it('marks ONLY the serving side with the green serving dot', () => {
    let events = interleave(5, 3);
    events = serveChange(events, 'A'); // serve handed to A
    render(<VolleyballScorebug events={events} config={VB} teamA="Reds" teamB="Blues" />);

    // Exactly one active serving glyph, and it is labelled.
    const glyphs = screen.getAllByRole('img', { name: 'Serving' });
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0].style.background).toContain('var(--primary)');
  });

  it('drives the serving dot from config.initialServer when no serve_change exists', () => {
    const events = interleave(4, 4);
    render(
      <VolleyballScorebug
        events={events}
        config={{ ...VB, initialServer: 'B' }}
        teamA="Reds"
        teamB="Blues"
      />,
    );
    expect(screen.getAllByRole('img', { name: 'Serving' })).toHaveLength(1);
  });

  it('shows no serving dot when there is no server', () => {
    const events = interleave(5, 5); // no serve_change, no initialServer
    render(<VolleyballScorebug events={events} config={VB} teamA="Reds" teamB="Blues" />);
    expect(screen.queryByRole('img', { name: 'Serving' })).not.toBeInTheDocument();
  });

  it('shows a SET POINT chip when a team is one point from the set', () => {
    const events = interleave(24, 20); // A at set point in set 1
    render(<VolleyballScorebug events={events} config={VB} teamA="Reds" teamB="Blues" />);
    expect(screen.getByText('SET POINT')).toBeInTheDocument();
    expect(screen.queryByText('MATCH POINT')).not.toBeInTheDocument();
  });

  it('shows a MATCH POINT chip when the set win would clinch the match', () => {
    // bo3: A wins set 1, then reaches 24-20 in set 2 -> next point wins the match.
    let events = interleave(25, 10); // set 1 to A (1-0)
    // continue into set 2 to 24-20 without closing it.
    for (let i = 0; i < 20; i += 1) {
      events = point(events, 'A');
      events = point(events, 'B');
    }
    for (let i = 0; i < 4; i += 1) {
      events = point(events, 'A'); // 24-20
    }
    render(
      <VolleyballScorebug events={events} config={{ ...VB, bestOf: 3 }} teamA="Reds" teamB="Blues" />,
    );
    expect(screen.getByText('MATCH POINT')).toBeInTheDocument();
  });

  it('shows no point-state chip during normal play', () => {
    const events = interleave(10, 8);
    render(<VolleyballScorebug events={events} config={VB} teamA="Reds" teamB="Blues" />);
    expect(screen.queryByText('SET POINT')).not.toBeInTheDocument();
    expect(screen.queryByText('MATCH POINT')).not.toBeInTheDocument();
  });

  it('fits a two-digit no-cap deuce score (31-30, still open)', () => {
    const events = interleave(31, 30); // +1 only -> set stays live, both two-digit
    render(<VolleyballScorebug events={events} config={VB} teamA="Reds" teamB="Blues" />);
    const bug = screen.getByRole('region', { name: 'Volleyball scorebug' });
    expect(within(bug).getByText('31')).toBeInTheDocument();
    expect(within(bug).getByText('30')).toBeInTheDocument();
  });
});
