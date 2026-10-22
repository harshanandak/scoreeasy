import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MonoCricketGuidedScorer from './MonoCricketGuidedScorer';
import { applyDelivery, createInnings, makeDelivery, makeFormat } from '../../../utils/cricketEngine';
import { contrastReport, deriveTeamColours } from '../../../lib/teamColour';

const format = makeFormat({ name: 'T20', oversPerInnings: 20 });
function board(props = {}) {
  return render(<MonoCricketGuidedScorer format={format} striker="Rohit" nonStriker="Virat" bowler="Jasprit" battingTeamName="Falcons" team1Color="#2563eb" team2Color="#fbbf24" {...props} />);
}

describe('cricket team-colour board', () => {
  it.each([
    ['Dot', 0, 1], ['Single', 1, 1], ['Four', 4, 1], ['Six', 6, 1],
    ['Run 2', 2, 1], ['Run 3', 3, 1], ['Run 5', 5, 1], ['Run 7', 7, 1],
    ['Wide', 1, 0], ['No-ball', 1, 0], ['Bye', 1, 1], ['Leg-bye', 1, 1],
  ])('keeps %s and its undo truthful', (label, runs, balls) => {
    const { container } = board();
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByTestId('hero-score')).toHaveTextContent(`${runs}/0`);
    expect(container.querySelector('.ck-hero-ov')).toHaveTextContent(`(${balls ? '0.1' : '0'})`);
    fireEvent.click(screen.getByRole('button', { name: 'Undo last ball' }));
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/0');
    expect(screen.queryAllByTestId('over-pip')).toHaveLength(0);
  });

  it('uses the configured powerplay label through a scoring correction', () => {
    board({ format: { ...format, powerplay: [{ start: 1, end: 6, label: 'Powerplay 1' }] } });
    expect(screen.getByText('Powerplay 1').closest('.cricket-who')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No-ball' }));
    expect(screen.getByTestId('freehit-badge')).toHaveTextContent('FREE HIT');
    expect(screen.getByText('Powerplay 1').closest('.cricket-who')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo last ball' }));
    expect(screen.queryByTestId('freehit-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Powerplay 1').closest('.cricket-who')).toBeInTheDocument();
  });

  it('opens the engine-derived batting and bowling cards from options', () => {
    board();
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    const batting = screen.getByRole('region', { name: 'Batting card' });
    expect(within(batting).getByRole('columnheader', { name: '4s' })).toBeInTheDocument();
    expect(within(batting).getByRole('row', { name: /Rohit/ })).toHaveTextContent('400.00');
    expect(screen.getByRole('region', { name: 'Bowling card' })).toHaveTextContent('Jasprit');
  });
  it('uses the batting team identity and seam mark with shared board controls', () => {
    const { container } = board();
    expect(screen.getByText('Falcons batting')).toBeInTheDocument();
    expect(container.querySelector('[data-cricket-board]')).toHaveStyle({ '--team-a-core': deriveTeamColours('#2563eb', '#fbbf24').A.core });
    expect(container.querySelector('.cricket-mark')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo last ball' })).toBeDisabled();
  });

  it('shows the actual restore score and over, including illegal deliveries', () => {
    board();
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    fireEvent.click(screen.getByRole('button', { name: 'No-ball' }));
    expect(screen.getByText(/Back to 0.1 · 4\/0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo last ball' }));
    expect(screen.queryByTestId('freehit-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-score')).toHaveTextContent('4/0');
    expect(screen.getByText(/Back to 0.0 · 0\/0/)).toBeInTheDocument();
  });

  it('restores a chase and keeps the bar accessible in power mode', () => {
    const initialInnings = applyDelivery(createInnings({ striker: 'Rohit', nonStriker: 'Virat', bowler: 'Jasprit', target: 165 }), makeDelivery({ batsmanRuns: 4 }), format);
    board({ initialInnings });
    expect(screen.getByText(/Over 0.1 · Chasing 165/)).toBeInTheDocument();
    expect(screen.getByTestId('chase-need')).toHaveTextContent('NEED 161 OFF 119');
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Power' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }));
    expect(screen.getByRole('button', { name: 'Undo last ball' })).toBeEnabled();
  });

  it('Finish calls the existing innings handoff with the settled engine state', () => {
    const onComplete = vi.fn();
    board({ onComplete });
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ runs: 4, reason: 'manual-match' }));
  });

  it.each([['#2563eb', '#fbbf24'], ['#ffffff', '#ffffff'], ['#ff0000', '#00ff00']])('passes every label and mark contrast pair for %s / %s', (a, b) => {
    for (const [label, ratio, minimum] of contrastReport(deriveTeamColours(a, b))) expect(ratio, label).toBeGreaterThanOrEqual(minimum);
  });
});
