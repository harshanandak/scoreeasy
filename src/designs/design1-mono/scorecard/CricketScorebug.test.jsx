import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { inningsTotals } from '../../../models/live/cricket';
import CricketScorebug from './CricketScorebug';

// A monotonically increasing seq generator for fixtures.
function makeSeq() {
  let n = 0;
  return () => {
    n += 1;
    return n;
  };
}

/**
 * Build a deliveries log totalling `targetRuns` runs across exactly `legalBalls`
 * legal deliveries and `wickets` wickets, then append an explicit final over so the
 * THIS OVER strip and the score/overs line are both pinned. Padding deliveries are
 * plain legal balls attributed to a fixed striker/bowler.
 *
 * The final over is given as an array of partial delivery specs; the helper assigns
 * over/ballInOver/seq/strikerId/etc. Padding fills the remaining runs and legal
 * balls BEFORE the final over so the displayed total matches exactly.
 */
function buildInnings({ finalOver, padRuns, padBalls, padWickets = 0, striker = 'p1', nonStriker = 'p2', bowler = 'b1' }) {
  const seq = makeSeq();
  const deliveries = [];
  // Padding occupies overs 0..(overCount-1); the final over is the next over index.
  const padOverCount = Math.floor(padBalls / 6);
  let runsLeft = padRuns;
  let ball = 0;
  for (let o = 0; o < padOverCount; o += 1) {
    for (let bib = 1; bib <= 6; bib += 1) {
      ball += 1;
      // Front-load all the padding runs onto the first ball to keep it simple.
      const runsBat = runsLeft > 0 && bib === 1 && o === 0 ? runsLeft : 0;
      if (runsBat) runsLeft = 0;
      // Place one wicket on the last ball of each of the first `padWickets` overs.
      const wicket =
        bib === 6 && o < padWickets ? { batterOutId: striker, kind: 'bowled' } : undefined;
      deliveries.push({
        over: o,
        ballInOver: bib,
        legal: true,
        strikerId: striker,
        nonStrikerId: nonStriker,
        bowlerId: bowler,
        runsBat,
        extraRuns: 0,
        wicket,
        seq: seq(),
      });
    }
  }
  // Final over.
  const finalOverIndex = padOverCount;
  let legalInOver = 0;
  for (const spec of finalOver) {
    const legal = spec.legal !== undefined ? spec.legal : !['wide', 'noball'].includes(spec.extraType);
    if (legal) legalInOver += 1;
    deliveries.push({
      over: finalOverIndex,
      ballInOver: legal ? legalInOver : legalInOver + 0.5,
      legal,
      strikerId: spec.strikerId || striker,
      nonStrikerId: spec.nonStrikerId || nonStriker,
      bowlerId: spec.bowlerId || bowler,
      runsBat: spec.runsBat || 0,
      extraType: spec.extraType,
      extraRuns: spec.extraRuns || 0,
      wicket: spec.wicket,
      seq: seq(),
    });
  }
  return deliveries;
}

afterEach(() => cleanup());

describe('CricketScorebug', () => {
  // 145/3 in 18.2 overs: 110 legal balls. Pad 108 legal balls with 144 runs and 2
  // wickets, then a final over of `. 1` (2 balls, 1 run, 1 wicket) → 145/3, 18.2.
  function fixture145() {
    return buildInnings({
      padRuns: 144,
      padBalls: 108, // 18 overs
      padWickets: 2,
      finalOver: [
        { runsBat: 1 }, // 1 run
        { runsBat: 0, wicket: { batterOutId: 'p1', kind: 'bowled' } }, // W
      ],
    });
  }

  it('renders the hero score, wickets and overs as 145/3 (18.2)', () => {
    const deliveries = fixture145();
    // Sanity: the engine agrees with our hand-built fixture.
    const totals = inningsTotals(deliveries);
    expect(totals.runs).toBe(145);
    expect(totals.wickets).toBe(3);
    expect(totals.legalBalls).toBe(110);

    render(<CricketScorebug deliveries={deliveries} players={{ p1: 'Kohli', p2: 'Rohit', b1: 'Bumrah' }} />);

    const bug = screen.getByRole('region', { name: 'Cricket scorebug' });
    // Hero line is split across text nodes (the overs sit in a margin-spaced span,
    // so there is no literal whitespace in textContent): "145/3(18.2)".
    const hero = within(bug).getByText(
      (_, el) => el?.tagName === 'P' && el.textContent.replace(/\s+/g, '') === '145/3(18.2)',
    );
    expect(hero).toBeInTheDocument();
  });

  it('renders the THIS OVER token row with boundary and wicket tokens', () => {
    // Final over: . 1 4 W 6  (all legal except none; 4/6 boundaries; one wicket).
    const deliveries = buildInnings({
      padRuns: 0,
      padBalls: 0,
      finalOver: [
        { runsBat: 0 }, // .
        { runsBat: 1 }, // 1
        { runsBat: 4 }, // 4
        { runsBat: 0, wicket: { batterOutId: 'p1', kind: 'bowled' } }, // W
        { runsBat: 6 }, // 6
      ],
    });
    render(<CricketScorebug deliveries={deliveries} players={{}} />);

    const list = screen.getByRole('list', { name: 'This over' });
    const tokens = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(tokens).toEqual(['.', '1', '4', 'W', '6']);

    // The wicket token rides in a black (var(--foreground)) pill.
    const wToken = within(list).getByText('W');
    expect(wToken.style.background).toContain('var(--foreground)');
    // Boundaries are green.
    const fourToken = within(list).getByText('4');
    expect(fourToken.style.color).toContain('var(--primary)');
  });

  it('shows CRR, and an RRR + Need line during a chase', () => {
    // 50 runs off 60 legal balls (10 overs) → CRR 5.00. Chasing 100 with 60 balls
    // remaining → need 50 off 60 → RRR 5.00.
    const deliveries = buildInnings({
      padRuns: 50,
      padBalls: 60,
      finalOver: [],
    });
    render(
      <CricketScorebug
        deliveries={deliveries}
        target={100}
        ballsRemaining={60}
        players={{}}
      />,
    );

    const bug = screen.getByRole('region', { name: 'Cricket scorebug' });
    expect(within(bug).getByText(/CRR 5\.00/)).toBeInTheDocument();
    expect(within(bug).getByText(/RRR 5\.00/)).toBeInTheDocument();
    expect(within(bug).getByText(/Need 50 off 60/)).toBeInTheDocument();
  });

  it('shows two batter chips and marks the striker with a dot', () => {
    const deliveries = buildInnings({
      padRuns: 0,
      padBalls: 0,
      striker: 'p1',
      nonStriker: 'p2',
      finalOver: [
        { runsBat: 4, strikerId: 'p1', nonStrikerId: 'p2' },
        { runsBat: 1, strikerId: 'p1', nonStrikerId: 'p2' },
      ],
    });
    render(
      <CricketScorebug deliveries={deliveries} players={{ p1: 'Kohli', p2: 'Rohit', b1: 'Bumrah' }} />,
    );

    const bug = screen.getByRole('region', { name: 'Cricket scorebug' });
    // Striker chip: Kohli 5(2) with an on-strike dot.
    expect(within(bug).getByText('Kohli')).toBeInTheDocument();
    expect(within(bug).getByText('Rohit')).toBeInTheDocument();
    expect(within(bug).getByText('5(2)')).toBeInTheDocument();
    expect(within(bug).getByRole('img', { name: 'On strike' })).toBeInTheDocument();
  });

  it('shows the bowler chip as wickets-runs (overs)', () => {
    // One over, six legal balls, 6 runs, one wicket to the bowler → Bumrah 1-6 (1.0).
    const deliveries = buildInnings({
      padRuns: 0,
      padBalls: 0,
      bowler: 'b1',
      finalOver: [
        { runsBat: 1 },
        { runsBat: 1 },
        { runsBat: 1 },
        { runsBat: 1 },
        { runsBat: 1 },
        { runsBat: 1, wicket: { batterOutId: 'p1', kind: 'bowled' } },
      ],
    });
    render(
      <CricketScorebug deliveries={deliveries} players={{ p1: 'Kohli', p2: 'Rohit', b1: 'Bumrah' }} />,
    );

    const bug = screen.getByRole('region', { name: 'Cricket scorebug' });
    expect(within(bug).getByText('Bumrah')).toBeInTheDocument();
    // Figures are split across text nodes; ballsToOvers(6) === '1'. Match the
    // combined textContent of the bowler line.
    expect(
      within(bug).getByText(
        (_, el) =>
          el?.tagName === 'P' && el.textContent.replace(/\s+/g, ' ').trim() === 'Bumrah 1-6 (1)',
      ),
    ).toBeInTheDocument();
  });

  it('omits the RRR line when no target is supplied', () => {
    const deliveries = buildInnings({ padRuns: 10, padBalls: 12, finalOver: [] });
    render(<CricketScorebug deliveries={deliveries} players={{}} />);

    expect(screen.queryByText(/RRR/)).not.toBeInTheDocument();
    expect(screen.getByText(/CRR/)).toBeInTheDocument();
  });
});
