import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  makeFormat,
  createInnings,
  applyDelivery,
  makeDelivery,
} from '../../../utils/cricketEngine.js';
import MonoCricketSpectator from './MonoCricketSpectator.jsx';

// C7 spectator: every asserted figure is engine-DERIVED. Innings are built by
// replaying real deliveries through applyDelivery so the component's
// deriveInnings/deriveChase fold is exercised end-to-end (nothing mocked).

const FMT = makeFormat({ name: 'T20', oversPerInnings: 20 });

/** Replay a sequence of delivery-overrides onto a fresh innings. */
function build(overrides, deliveries) {
  let inn = createInnings({ striker: 'Rohit', nonStriker: 'Kohli', bowler: 'Starc', ...overrides });
  for (const d of deliveries) inn = applyDelivery(inn, makeDelivery(d), FMT);
  return inn;
}

describe('MonoCricketSpectator — LIVE', () => {
  it('hero shows the batting score and the chase NEED when a target is set', () => {
    // 4 then 1 → 5 runs, 2 legal balls, chasing 50.
    const innings = build({}, [{ batsmanRuns: 4 }, { batsmanRuns: 1 }]);
    render(
      <MonoCricketSpectator
        format={FMT}
        innings={innings}
        target={50}
        battingTeam={{ name: 'Royals' }}
        bowlingTeam={{ name: 'Strikers' }}
      />
    );
    const need = screen.getByTestId('chase-need');
    // 50 target − 5 scored = 45 needed.
    expect(need).toHaveTextContent('need');
    expect(need).toHaveTextContent('45');
    // batting score present in the hero.
    expect(need).toHaveTextContent('Royals');
  });

  it('renders the this-over pips including a boundary', () => {
    const innings = build({}, [{ batsmanRuns: 1 }, { batsmanRuns: 4 }, { batsmanRuns: 0 }]);
    render(
      <MonoCricketSpectator format={FMT} innings={innings} battingTeam="Royals" bowlingTeam="Strikers" />
    );
    const strip = screen.getByTestId('this-over');
    const pips = within(strip).getAllByRole('listitem');
    expect(pips.length).toBe(3);
    expect(strip).toHaveTextContent('4');
  });

  it('a now-batter row shows R, B and SR', () => {
    // Rohit: 4 (stays on strike, even runs) then 4 again → 8 off 2, SR 400.
    const innings = build({}, [{ batsmanRuns: 4 }, { batsmanRuns: 4 }]);
    render(
      <MonoCricketSpectator format={FMT} innings={innings} battingTeam="Royals" bowlingTeam="Strikers" />
    );
    const row = screen.getByTestId('now-striker');
    expect(row).toHaveTextContent('Rohit');
    expect(row).toHaveTextContent('8'); // runs
    expect(row).toHaveTextContent('400'); // SR
  });

  it('win-prob bar exposes its basis string', () => {
    const innings = build({}, [{ batsmanRuns: 6 }]);
    render(
      <MonoCricketSpectator format={FMT} innings={innings} target={40} battingTeam="Royals" bowlingTeam="Strikers" />
    );
    // deriveChase().winProb.basis === 'RRR-gap heuristic v0'
    expect(screen.getByTestId('winprob-basis')).toHaveTextContent('heuristic');
    const bar = screen.getByRole('progressbar', { name: /win probability/i });
    expect(bar).toHaveAttribute('title', expect.stringContaining('heuristic'));
  });
});

describe('MonoCricketSpectator — Scorecard tab', () => {
  it('shows batting + bowling rows, itemized extras and fall of wickets', () => {
    // 4, wide+1, 1, then a wicket (bowled) → gives a batting row, bowling row,
    // extras (wd) and a FoW entry.
    const innings = build({}, [
      { batsmanRuns: 4 },
      { extras: [{ type: 'wide', runs: 1 }] },
      { batsmanRuns: 1 },
      { wicket: { type: 'bowled', out: 'Kohli', incoming: 'Pant' }, bowler: 'Starc' },
    ]);
    render(
      <MonoCricketSpectator format={FMT} innings={innings} battingTeam="Royals" bowlingTeam="Strikers" />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Scorecard' }));

    const card = screen.getByTestId('scorecard');
    // batting row (Rohit) and bowling row (Starc) both present.
    expect(within(card).getByTestId('bat-row-Rohit')).toBeInTheDocument();
    expect(within(card).getByTestId('bowl-row-Starc')).toBeInTheDocument();
    // itemized extras carries the wide.
    expect(screen.getByTestId('extras')).toHaveTextContent('wd 1');
    // fall of wickets records the dismissal.
    expect(screen.getByTestId('fow')).toHaveTextContent('Kohli');
  });

  it('renders the prior innings block when priorInnings is supplied', () => {
    const first = build({ striker: 'A', nonStriker: 'B', bowler: 'Z' }, [{ batsmanRuns: 6 }]);
    const second = build({}, [{ batsmanRuns: 1 }]);
    render(
      <MonoCricketSpectator
        format={FMT}
        innings={second}
        target={7}
        priorInnings={first}
        battingTeam="Royals"
        bowlingTeam="Strikers"
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Scorecard' }));
    expect(screen.getByTestId('prior-innings')).toBeInTheDocument();
  });
});
