import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildBattingCard, buildExtras, inningsTotals } from '../../../models/live/cricket';
import BattingCard from './BattingCard';

let seq = 0;
function d(spec) {
  seq += 1;
  return {
    over: 0,
    ballInOver: spec.ballInOver ?? 1,
    legal: spec.legal ?? !['wide', 'noball'].includes(spec.extraType),
    strikerId: spec.strikerId ?? 'p1',
    nonStrikerId: spec.nonStrikerId ?? 'p2',
    bowlerId: spec.bowlerId ?? 'b1',
    runsBat: spec.runsBat ?? 0,
    extraType: spec.extraType,
    extraRuns: spec.extraRuns ?? 0,
    wicket: spec.wicket,
    seq,
  };
}

const PLAYERS = { p1: 'Rohit', p2: 'Kohli', b1: 'Starc', f1: 'Smith' };

afterEach(() => {
  cleanup();
  seq = 0;
});

describe('BattingCard', () => {
  it('renders R / B / 4s / 6s / SR for a batter from the deliveries log', () => {
    // p1: 4, 6, 1, 0 off four legal balls = 11 runs, 4 balls, one four, one six.
    const deliveries = [
      d({ runsBat: 4 }),
      d({ runsBat: 6 }),
      d({ runsBat: 1 }),
      d({ runsBat: 0 }),
    ];
    render(<BattingCard deliveries={deliveries} players={PLAYERS} strikerId="p1" />);

    const card = screen.getByRole('region', { name: 'Batting card' });
    const row = within(card).getByRole('row', { name: /Rohit/ });
    // Numeric cells, in column order: R · B · 4s · 6s · SR.
    const nums = within(row).getAllByRole('cell').map((c) => c.textContent);
    // R=11, B=4, 4s=1, 6s=1, SR=(11/4*100)=275.00
    expect(nums).toEqual(['11', '4', '1', '1', '275.00']);
  });

  it('renders a dash for strike rate when no ball was faced', () => {
    // p2 is a not-out non-striker who has faced nothing (p1 on strike all four balls).
    const deliveries = [d({ runsBat: 1 }), d({ runsBat: 1 }), d({ runsBat: 1 }), d({ runsBat: 1 })];
    render(<BattingCard deliveries={deliveries} players={PLAYERS} strikerId="p1" />);

    const card = screen.getByRole('region', { name: 'Batting card' });
    const row = within(card).getByRole('row', { name: /Kohli/ });
    expect(within(row).getByText('-')).toBeInTheDocument();
  });

  it('formats the dismissal phrase under a dismissed batter', () => {
    // p1 caught by Smith (f1) bowled Starc (b1).
    const deliveries = [
      d({ runsBat: 10 }),
      d({ runsBat: 0, wicket: { batterOutId: 'p1', kind: 'caught', fielderId: 'f1' } }),
    ];
    render(<BattingCard deliveries={deliveries} players={PLAYERS} />);

    const card = screen.getByRole('region', { name: 'Batting card' });
    expect(within(card).getByText('c Smith b Starc')).toBeInTheDocument();
  });

  it('marks a not-out batter with "not out"', () => {
    const deliveries = [d({ runsBat: 4, strikerId: 'p1', nonStrikerId: 'p2' })];
    render(<BattingCard deliveries={deliveries} players={PLAYERS} strikerId="p1" />);

    const card = screen.getByRole('region', { name: 'Batting card' });
    expect(within(card).getAllByText('not out').length).toBeGreaterThanOrEqual(1);
  });

  it('marks the on-strike batter with a dot', () => {
    const deliveries = [d({ runsBat: 1, strikerId: 'p1', nonStrikerId: 'p2' })];
    render(<BattingCard deliveries={deliveries} players={PLAYERS} strikerId="p1" />);

    const card = screen.getByRole('region', { name: 'Batting card' });
    expect(within(card).getByRole('img', { name: 'On strike' })).toBeInTheDocument();
  });

  it('reflects the sum(bat) + extras === innings runs integrity invariant', () => {
    // Mixed innings: bat runs + a wide + a leg-bye. Card batter runs plus extras must
    // equal the engine's innings total.
    const deliveries = [
      d({ runsBat: 4 }),
      d({ extraType: 'wide', extraRuns: 1, legal: false }),
      d({ runsBat: 0, extraType: 'legbye', extraRuns: 2, legal: true }),
      d({ runsBat: 6 }),
    ];
    const card = buildBattingCard(deliveries);
    const extras = buildExtras(deliveries);
    const totals = inningsTotals(deliveries);
    const batTotal = card.reduce((s, r) => s + r.runs, 0);
    expect(batTotal + extras.total).toBe(totals.runs);

    // And the rendered card shows the batter's bat-only total (10), not the team total.
    render(<BattingCard deliveries={deliveries} players={PLAYERS} strikerId="p1" />);
    const region = screen.getByRole('region', { name: 'Batting card' });
    const row = within(region).getByRole('row', { name: /Rohit/ });
    expect(within(row).getByText('10')).toBeInTheDocument();
  });
});
