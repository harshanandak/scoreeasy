import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeFormat, createInnings } from '../../../utils/cricketEngine.js';
import MonoCricketGuidedScorer from './MonoCricketGuidedScorer.jsx';

// C5 player/context enrichments. Every figure asserted here is engine-DERIVED:
// SR/Econ come straight off deriveInnings; partnership balls are folded from the
// deliveries; the quota reads canBowl's maxOversPerBowler cap.

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

describe('MonoCricketGuidedScorer — C5 enrichments', () => {
  it('partnership line shows runs and balls after a few deliveries', () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    const ps = screen.getByTestId('partnership');
    // 1 + 4 = 5 runs across 2 legal balls faced.
    expect(ps).toHaveTextContent('5');
    expect(ps).toHaveTextContent('(2)');
  });

  it('striker figure includes strike rate', () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    // 4 off 1 ball → SR 400, and striker stays on strike (even run).
    expect(screen.getByTestId('striker-fig')).toHaveTextContent('SR');
    expect(screen.getByTestId('striker-fig')).toHaveTextContent('SR 400');
  });

  it('bowler figure includes economy and the over quota', () => {
    renderScorer({ format: makeFormat({ oversPerInnings: 20, maxOversPerBowler: 4 }) });
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    // 4 runs off 1 ball → econ 24.0.
    expect(screen.getByTestId('bowler-fig')).toHaveTextContent('24.0');
    // 0 completed overs against a cap of 4.
    const quota = screen.getByTestId('bowler-quota');
    expect(quota).toHaveTextContent('0/4 ov');
    expect(quota.className).not.toContain('ck-quota-max');
  });

  it('no quota shown when the format has no per-bowler cap', () => {
    renderScorer({ format: makeFormat({ oversPerInnings: 20, maxOversPerBowler: null }) });
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    expect(screen.queryByTestId('bowler-quota')).not.toBeInTheDocument();
  });

  it('a bowler at max overs surfaces the quota warning', () => {
    renderScorer({ format: makeFormat({ oversPerInnings: 5, maxOversPerBowler: 1 }) });
    // Bowl a full over (6 legal dots) → 1/1 overs → at cap.
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Dot' }));
    }
    const quota = screen.getByTestId('bowler-quota');
    expect(quota).toHaveTextContent('1/1 ov');
    expect(quota).toHaveTextContent('max');
    expect(quota.className).toContain('ck-quota-max');
  });

  it('overs-remaining is appended to the context line when not chasing', () => {
    renderScorer({ format: makeFormat({ oversPerInnings: 20 }) });
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    // 20 overs − 1 ball = 19.5 left.
    expect(screen.getByText(/ov left/i)).toHaveTextContent('19.5 ov left');
  });

  it('last-man-stands renders a single batter card with a LAST MAN indicator', () => {
    const innings = createInnings({
      striker: 'Dhoni',
      nonStriker: null,
      bowler: 'Starc',
      playersPerSide: 11,
    });
    render(
      <MonoCricketGuidedScorer
        format={makeFormat({ oversPerInnings: 20, houseRules: { lastManStands: true } })}
        striker="Dhoni"
        nonStriker={null}
        bowler="Starc"
        initialInnings={innings}
      />
    );
    // Lone batter: striker + LAST MAN, no non-striker slot, no partnership line.
    expect(screen.getByTestId('lastman')).toBeInTheDocument();
    expect(screen.getByTestId('striker-name')).toHaveTextContent('Dhoni');
    expect(screen.queryByTestId('nonstriker-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('partnership')).not.toBeInTheDocument();
  });
});
