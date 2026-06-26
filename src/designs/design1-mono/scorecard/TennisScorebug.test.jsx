import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import TennisScorebug from './TennisScorebug';

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

describe('TennisScorebug', () => {
  it('renders both player names and the live point ladder (30-15)', () => {
    // Game 1, no set/game closed: A scores 2, B scores 1 -> 30-15.
    let events = point([], 'A');
    events = point(events, 'A');
    events = point(events, 'B');
    render(<TennisScorebug events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const bug = screen.getByRole('region', { name: 'Tennis scorebug' });
    expect(within(bug).getByText('Alcaraz')).toBeInTheDocument();
    expect(within(bug).getByText('Sinner')).toBeInTheDocument();
    expect(within(bug).getByText('30')).toBeInTheDocument();
    expect(within(bug).getByText('15')).toBeInTheDocument();
  });

  it('shows AD on the ladder for the advantage player', () => {
    // 3-3 (deuce) then A wins a point -> A 'AD', B '40'.
    let events = [];
    for (let i = 0; i < 3; i += 1) {
      events = point(events, 'A');
      events = point(events, 'B');
    }
    events = point(events, 'A');
    render(<TennisScorebug events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const rowA = screen.getByRole('group', { name: 'Alcaraz' });
    expect(within(rowA).getByText('AD')).toBeInTheDocument();
  });

  it('displays a completed 6-4 set with the winner bolded', () => {
    // 4 alternating love games (4-4), then 2 love games to A -> set 6-4 to A.
    let events = loveGames([], 4);
    events = run(events, 'A');
    events = run(events, 'A');
    render(<TennisScorebug events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const rowA = screen.getByRole('group', { name: 'Alcaraz' });
    const rowB = screen.getByRole('group', { name: 'Sinner' });
    const winA = within(rowA).getByText('6');
    expect(winA).toBeInTheDocument();
    expect(winA.style.fontWeight).toBe('800');
    const lossB = within(rowB).getByText('4');
    expect(lossB.style.fontWeight).toBe('400');
  });

  it('renders a completed tiebreak set with the mini-score superscript (7-6(4))', () => {
    // Reach 6-6 (6 alternating love games each), then a tiebreak A 7 - B 4.
    let events = loveGames([], 6);
    for (let i = 0; i < 4; i += 1) {
      events = point(events, 'A');
      events = point(events, 'B');
    }
    events = run(events, 'A', 3); // A 7-4 wins the tiebreak -> set 7-6
    render(<TennisScorebug events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    // Loser's tiebreak mini-score (4) is unique and rendered in a <sup>.
    const rowB = screen.getByRole('group', { name: 'Sinner' });
    const sup = within(rowB).getByText('4');
    expect(sup.tagName).toBe('SUP');
    // The loser's set game count (6) is not bolded (winner-bold proven in 6-4 test).
    expect(within(rowB).getByText('6').style.fontWeight).toBe('400');
  });

  it('marks exactly one row with the serving dot', () => {
    // Server defaults to A in game 1 (no serve_change / initialServer).
    const events = point([], 'A');
    render(<TennisScorebug events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    const dots = screen.getAllByRole('img', { name: 'Serving' });
    expect(dots).toHaveLength(1);
    expect(dots[0].style.background).toContain('var(--primary)');
    // The serving dot sits on server A's row.
    const rowA = screen.getByRole('group', { name: 'Alcaraz' });
    expect(within(rowA).getByRole('img', { name: 'Serving' })).toBeInTheDocument();
  });

  it('shows a BREAK PT ribbon when the receiver is one point from the game', () => {
    // Server defaults to A; B (receiver) wins 3 points -> 0-40, break point.
    let events = point([], 'B');
    events = point(events, 'B');
    events = point(events, 'B');
    render(<TennisScorebug events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    expect(screen.getByText('BREAK PT')).toBeInTheDocument();
    expect(screen.queryByText('SET PT')).not.toBeInTheDocument();
    expect(screen.queryByText('MATCH PT')).not.toBeInTheDocument();
  });

  it('shows no pressure ribbon during normal play', () => {
    let events = point([], 'A');
    events = point(events, 'B'); // 15-15, nothing pending
    render(<TennisScorebug events={events} config={{}} teamA="Alcaraz" teamB="Sinner" />);

    expect(screen.queryByText('BREAK PT')).not.toBeInTheDocument();
    expect(screen.queryByText('SET PT')).not.toBeInTheDocument();
    expect(screen.queryByText('MATCH PT')).not.toBeInTheDocument();
  });

  it('renders from a pre-derived `state` (operator snapshot) and ignores events', () => {
    // Spectator path: the operator snapshot is authoritative; the stale events
    // here must not surface (§87d Trap B fix).
    const staleEvents = point(point([], 'A'), 'A'); // 30-0 in set 1
    render(
      <TennisScorebug
        events={staleEvents}
        state={{
          sets: [{ a: 6, b: 4 }],
          currentSet: { gamesA: 5, gamesB: 3 },
          currentGame: { labelA: '40', labelB: '30' },
          server: 'A',
          isMatchPoint: false,
          isSetPoint: false,
          isBreakPoint: false,
        }}
        teamA="Alcaraz"
        teamB="Sinner"
      />,
    );
    const bug = screen.getByRole('region', { name: 'Tennis scorebug' });
    // Completed set (6), live games (5/3), and current-game points (40/30) show.
    expect(within(bug).getByText('6')).toBeInTheDocument();
    expect(within(bug).getByText('5')).toBeInTheDocument();
    expect(within(bug).getByText('40')).toBeInTheDocument();
    expect(within(bug).getByText('30')).toBeInTheDocument();
  });
});
