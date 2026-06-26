import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appendPoint } from '../../../models/live/scoringEvents';
import RunIndicator from './RunIndicator';

function build(spec) {
  let events = [];
  for (const [team, value = 1, at] of spec) {
    events = appendPoint(events, { team, value, at });
  }
  return events;
}

afterEach(() => cleanup());

describe('RunIndicator', () => {
  it('renders the run pill with the team and length', () => {
    // A scores three unanswered points.
    render(<RunIndicator events={build([['A'], ['A'], ['A']])} teamA="Reds" teamB="Blues" />);

    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent('Reds 3-0 run');
    expect(pill).toHaveAttribute('aria-label', 'Reds on a 3 point run');
  });

  it('resets the run to the latest scorer', () => {
    // A, A, then B scores -> current run is B 1-0.
    render(<RunIndicator events={build([['A'], ['A'], ['B']])} teamA="Reds" teamB="Blues" />);

    expect(screen.getByRole('status')).toHaveTextContent('Blues 1-0 run');
  });

  it('renders nothing on an empty stream', () => {
    const { container } = render(<RunIndicator events={[]} teamA="Reds" teamB="Blues" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
