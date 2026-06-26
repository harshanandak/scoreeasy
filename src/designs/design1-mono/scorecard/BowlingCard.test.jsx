import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildBowlingCard } from '../../../models/live/cricket';
import BowlingCard from './BowlingCard';

let seq = 0;
function d(spec) {
  seq += 1;
  return {
    over: spec.over ?? 0,
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

const PLAYERS = { p1: 'Rohit', p2: 'Kohli', b1: 'Bumrah' };

afterEach(() => {
  cleanup();
  seq = 0;
});

describe('BowlingCard', () => {
  it('renders O / M / R / W / Econ for a bowler from the deliveries log', () => {
    // One full over: 1,0,1,0,W(bowled),1 → 6 legal balls, 3 runs, 1 wicket.
    // O=1.0, M=0, R=3, W=1, Econ=(3/(6/6))=3.00.
    const deliveries = [
      d({ over: 0, ballInOver: 1, runsBat: 1 }),
      d({ over: 0, ballInOver: 2, runsBat: 0 }),
      d({ over: 0, ballInOver: 3, runsBat: 1 }),
      d({ over: 0, ballInOver: 4, runsBat: 0 }),
      d({ over: 0, ballInOver: 5, runsBat: 0, wicket: { batterOutId: 'p1', kind: 'bowled' } }),
      d({ over: 0, ballInOver: 6, runsBat: 1 }),
    ];
    render(<BowlingCard deliveries={deliveries} players={PLAYERS} />);

    const card = screen.getByRole('region', { name: 'Bowling card' });
    const row = within(card).getByRole('row', { name: /Bumrah/ });
    const nums = within(row).getAllByRole('cell').map((c) => c.textContent);
    // O · M · R · W · Econ — ballsToOvers(6) === '1' (whole over, no .0 suffix).
    expect(nums).toEqual(['1', '0', '3', '1', '3.00']);
  });

  it('counts a maiden over (0 runs charged across 6 legal balls)', () => {
    const deliveries = Array.from({ length: 6 }, (unused, i) =>
      d({ over: 0, ballInOver: i + 1, runsBat: 0 }),
    );
    // Engine agrees it is a maiden before we assert the rendered cell.
    expect(buildBowlingCard(deliveries)[0].maidens).toBe(1);

    render(<BowlingCard deliveries={deliveries} players={PLAYERS} />);
    const card = screen.getByRole('region', { name: 'Bowling card' });
    const row = within(card).getByRole('row', { name: /Bumrah/ });
    const nums = within(row).getAllByRole('cell').map((c) => c.textContent);
    // O=1 (ballsToOvers(6)), M=1, R=0, W=0, Econ=0.00
    expect(nums).toEqual(['1', '1', '0', '0', '0.00']);
  });

  it('charges wides/no-balls to the bowler but not byes/leg-byes, and notes extras', () => {
    // wide (+1 R), no-ball (+1 R), bye (+4, NOT charged), one legal dot.
    const deliveries = [
      d({ over: 0, ballInOver: 1, extraType: 'wide', extraRuns: 1, legal: false }),
      d({ over: 0, ballInOver: 1, extraType: 'noball', extraRuns: 1, legal: false }),
      d({ over: 0, ballInOver: 1, extraType: 'bye', extraRuns: 4, legal: true }),
      d({ over: 0, ballInOver: 2, runsBat: 0, legal: true }),
    ];
    const engineRow = buildBowlingCard(deliveries)[0];
    // R = wide(1) + no-ball(1) = 2; byes do NOT touch the bowler.
    expect(engineRow.runs).toBe(2);

    render(<BowlingCard deliveries={deliveries} players={PLAYERS} />);
    const card = screen.getByRole('region', { name: 'Bowling card' });
    const row = within(card).getByRole('row', { name: /Bumrah/ });
    const nums = within(row).getAllByRole('cell').map((c) => c.textContent);
    // O=0.2 (2 legal: the bye and the dot), M=0, R=2, W=0, Econ=(2/(2/6))=6.00
    expect(nums).toEqual(['0.2', '0', '2', '0', '6.00']);
    // Micro-note shows the wide / no-ball counts.
    expect(within(row).getByText('(1w 1nb)')).toBeInTheDocument();
  });

  it('does not credit the bowler for a run-out wicket', () => {
    const deliveries = [
      d({ over: 0, ballInOver: 1, runsBat: 1, wicket: { batterOutId: 'p2', kind: 'runout', fielderId: 'p1' } }),
    ];
    expect(buildBowlingCard(deliveries)[0].wickets).toBe(0);

    render(<BowlingCard deliveries={deliveries} players={PLAYERS} />);
    const card = screen.getByRole('region', { name: 'Bowling card' });
    const row = within(card).getByRole('row', { name: /Bumrah/ });
    const nums = within(row).getAllByRole('cell').map((c) => c.textContent);
    expect(nums[3]).toBe('0'); // W column
  });
});
