import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { makeFormat } from '../../../utils/cricketEngine.js';
import MonoCricketGuidedScorer from './MonoCricketGuidedScorer.jsx';

// C6: wicket sheet + new-batter picker + quota-aware bowler picker + wired MORE.
// Every assertion reads engine-DERIVED UI (hero score, player names, pips).

function renderScorer(overrides = {}) {
  return render(
    <MonoCricketGuidedScorer
      format={makeFormat({ name: 'T20', oversPerInnings: 20 })}
      striker="Rohit"
      nonStriker="Kohli"
      bowler="Bumrah"
      {...overrides}
    />
  );
}

const tap = (name) => fireEvent.click(screen.getByRole('button', { name }));
const addCustom = (dialogName, value) => {
  const dialog = screen.getByRole('dialog', { name: dialogName });
  fireEvent.change(within(dialog).getByLabelText('Add name'), { target: { value } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
};

describe('MonoCricketGuidedScorer — C6', () => {
  it('wicket -> new-batter picker -> incoming replaces the struck-out striker', () => {
    renderScorer();
    tap('Wicket');
    tap('Bowled');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/1');
    // picker opens; the new batter takes the out (striker) end.
    addCustom('New batter', 'Pujara');
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Pujara');
    expect(screen.getByTestId('nonstriker-name')).toHaveTextContent('Kohli');
  });

  it('caught with crossed=Yes places the incoming batter at the non-striker end', () => {
    renderScorer();
    tap('Wicket');
    tap('Caught');
    tap('Yes'); // batsmen crossed -> odd parity swap
    addCustom('New batter', 'Newbie');
    // Kohli is now on strike; the incoming batter is at the non-striker end.
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Kohli');
    expect(screen.getByTestId('nonstriker-name')).toHaveTextContent('Newbie');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/1');
  });

  it('run out captures out + end + completedRuns (striker out after 1 completed run)', () => {
    renderScorer();
    tap('Wicket');
    tap('Run out');
    tap('Striker'); // out end
    tap('1'); // completed runs -> odd -> parity swap before placement
    tap('Confirm run out');
    addCustom('New batter', 'Jadeja');
    // completedRuns=1 crossed the batters: Kohli ends up on strike, incoming at the
    // non-striker end (the struck-out striker's crossed end). No runs are scored.
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Kohli');
    expect(screen.getByTestId('nonstriker-name')).toHaveTextContent('Jadeja');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/1');
  });

  it('over end opens the bowler picker and changeBowler applies', () => {
    renderScorer({ squad: { bowling: [{ id: 'Bumrah', name: 'Bumrah' }, { id: 'Shami', name: 'Shami' }] } });
    for (let i = 0; i < 6; i++) tap('Dot');
    const dialog = screen.getByRole('dialog', { name: 'New bowler' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Shami/ }));
    expect(screen.getByText(/Shami/)).toBeInTheDocument();
  });

  it('a bowler at max overs is disabled in the picker (quota)', () => {
    renderScorer({
      format: makeFormat({ oversPerInnings: 20, maxOversPerBowler: 1 }),
      squad: { bowling: [{ id: 'Bumrah', name: 'Bumrah' }, { id: 'Shami', name: 'Shami' }] },
    });
    for (let i = 0; i < 6; i++) tap('Dot'); // Bumrah completes his 1-over quota
    const dialog = screen.getByRole('dialog', { name: 'New bowler' });
    expect(within(dialog).getByRole('button', { name: /Bumrah/ })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /Shami/ })).not.toBeDisabled();
  });

  it('noLBW hides the LBW dismissal', () => {
    renderScorer({ format: makeFormat({ oversPerInnings: 20, houseRules: { noLBW: true } }) });
    tap('Wicket');
    const dialog = screen.getByRole('dialog', { name: 'How out?' });
    expect(within(dialog).queryByRole('button', { name: 'LBW' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Bowled' })).toBeInTheDocument();
  });

  it('on a free hit the wicket sheet offers run-out only', () => {
    renderScorer();
    tap('No-ball'); // arms the free hit
    expect(screen.getByTestId('freehit-badge')).toBeInTheDocument();
    tap('Wicket');
    const dialog = screen.getByRole('dialog', { name: 'How out?' });
    expect(within(dialog).getByTestId('freehit-note')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Run out' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Bowled' })).toBeNull();
  });

  it('MORE dead ball adds no ball and no run', () => {
    renderScorer();
    tap('More options');
    tap('Dead ball');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/0');
    expect(screen.queryAllByTestId('over-pip')).toHaveLength(0);
  });

  it('MORE penalty +5 adds 5 to the team total', () => {
    renderScorer();
    tap('More options');
    tap('Penalty +5');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('5/0');
  });

  it('MORE retire(hurt) keeps wkts at 0 and lists the batter as resumable', () => {
    renderScorer();
    tap('More options');
    tap('Retire');
    // default end = striker (Rohit), default mode = hurt
    tap('Continue');
    addCustom('New batter', 'Iyer');
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/0'); // no wicket
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Iyer');

    // Retiring again offers Rohit as a resumable incoming.
    tap('More options');
    tap('Retire');
    fireEvent.click(screen.getByRole('button', { name: 'Kohli' })); // retire non-striker
    tap('Continue');
    const dialog = screen.getByRole('dialog', { name: 'New batter' });
    expect(within(dialog).getByText('Resume Rohit')).toBeInTheDocument();
  });
});
