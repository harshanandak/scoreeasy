import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeFormat } from '../../../utils/cricketEngine.js';
import MonoCricketGuidedScorer from './MonoCricketGuidedScorer.jsx';

// Pure component + engine only — no routing/localStorage/Convex. Every assertion
// reads engine-DERIVED output (hero score, over strip, chase) rendered by the UI.

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

describe('MonoCricketGuidedScorer', () => {
  it('initial render shows 0/0', () => {
    renderScorer();
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/0');
  });

  it('tapping FOUR adds 4 and keeps the striker on strike', () => {
    renderScorer();
    const strikerBefore = screen.getByTestId('striker-name').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    expect(screen.getByTestId('hero-score')).toHaveTextContent('4/0');
    // 4 is even -> no strike rotation.
    expect(screen.getByTestId('striker-name').textContent).toBe(strikerBefore);
  });

  it('tapping 1 swaps strike (odd running run rotates)', () => {
    renderScorer();
    // striker starts as Rohit; non-striker Kohli.
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Rohit');
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    expect(screen.getByTestId('hero-score')).toHaveTextContent('1/0');
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Kohli');
  });

  it('a wicket increments wkts and shows the inline how-out flow', () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: 'Wicket' }));
    // Inline how-out flow appears (not a modal).
    expect(screen.getByTestId('howout')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bowled' }));
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/1');
  });

  it('Undo reverts the last ball', () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    expect(screen.getByTestId('hero-score')).toHaveTextContent('4/0');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last ball' }));
    expect(screen.getByTestId('hero-score')).toHaveTextContent('0/0');
  });

  it('the over strip renders a pip per ball', () => {
    renderScorer();
    expect(screen.queryAllByTestId('over-pip')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    expect(screen.queryAllByTestId('over-pip')).toHaveLength(2);
  });

  it('chase hero shows NEED when a target is set', () => {
    renderScorer({ target: 170 });
    const need = screen.getByTestId('chase-need');
    expect(need).toHaveTextContent('NEED');
    expect(need).toHaveTextContent('170'); // runsNeeded == target before any run
  });

  it('Guided⇄Power toggle flips to a Power placeholder', () => {
    renderScorer();
    expect(screen.queryByTestId('power-placeholder')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Power' }));
    expect(screen.getByTestId('power-placeholder')).toBeInTheDocument();
  });
});
