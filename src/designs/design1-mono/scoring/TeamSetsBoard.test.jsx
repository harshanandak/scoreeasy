import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TeamSetsBoard from './TeamSetsBoard';
import { sportMarkMaskUrl } from '../../../lib/sportMarks';

// Presentational contract of the Refined Soft team-colour board: it shows what the scorer tells
// it, once, and never invents state. Scoring rules are tested on MonoQuickMatch.

const halves = (servingTeam = 1) => [
  { key: 'a', team: 1, name: 'Royals', score: 22, serving: servingTeam === 1 },
  { key: 'b', team: 2, name: 'Strikers', score: 19, serving: servingTeam === 2 },
];

function renderBoard(overrides = {}) {
  const props = {
    title: 'Royals v Strikers',
    subtitle: 'Volleyball · 25 pts · win by 2',
    isLive: false,
    colourStyle: { '--sport-mark': sportMarkMaskUrl('volleyball') },
    halves: halves(),
    meta: ['Set 2', 'Sets 1–0', '18:42'],
    setHistory: [],
    lastLine: 'Last · point Royals · 22–19',
    canUndo: true,
    undoHint: 'back to 21–19',
    onUndo: vi.fn(),
    onPoint: vi.fn(),
    onSwap: vi.fn(),
    onCorrect: vi.fn(),
    onDiscard: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<TeamSetsBoard {...props} />) };
}

const key = (name) => screen.getByRole('button', { name: `Add point for ${name}` });

describe('TeamSetsBoard', () => {
  it('shows the match status once, as plain text', () => {
    renderBoard();
    const meta = document.querySelector('.tsb-meta');
    expect(meta).toHaveTextContent('Set 2');
    expect(meta).toHaveTextContent('Sets 1–0');
    expect(meta).toHaveTextContent('18:42');
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('shows Live only when the match is shared live', () => {
    renderBoard({ isLive: true });
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('puts the ball mark on the serving key only, and moves it with the serve', () => {
    const { rerender, props } = renderBoard();
    expect(key('Royals').querySelector('.tsb-mark')).not.toBeNull();
    expect(key('Strikers').querySelector('.tsb-mark')).toBeNull();
    expect(within(key('Royals')).getByText('Serving')).toBeInTheDocument();
    expect(within(key('Strikers')).queryByText('Serving')).toBeNull();

    rerender(<TeamSetsBoard {...props} halves={halves(2)} />);
    expect(key('Royals').querySelector('.tsb-mark')).toBeNull();
    expect(key('Strikers').querySelector('.tsb-mark')).not.toBeNull();
    expect(within(key('Strikers')).getByText('Serving')).toBeInTheDocument();
  });

  it('draws no mark for a sport without one, but still says who serves', () => {
    renderBoard({ colourStyle: {} });
    expect(document.querySelector('.tsb-mark')).toBeNull();
    expect(within(key('Royals')).getByText('Serving')).toBeInTheDocument();
  });

  it('tells each key which side of the net it is on, so the mark faces the net', () => {
    renderBoard();
    expect(key('Royals')).toHaveAttribute('data-side', 'left');
    expect(key('Strikers')).toHaveAttribute('data-side', 'right');
  });

  it('always shows Undo; disabled with nothing to undo, otherwise says where it goes back to', () => {
    const { rerender, props } = renderBoard();
    const undo = screen.getByRole('button', { name: 'Undo last action' });
    expect(undo).toBeEnabled();
    expect(undo).toHaveTextContent('back to 21–19');
    fireEvent.click(undo);
    expect(props.onUndo).toHaveBeenCalledTimes(1);

    rerender(<TeamSetsBoard {...props} canUndo={false} undoHint="" />);
    expect(screen.getByRole('button', { name: 'Undo last action' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo last action' })).toHaveTextContent('Nothing to undo');
  });

  it('scores the tapped team and finishes from the header', () => {
    const { props } = renderBoard();
    fireEvent.click(key('Strikers'));
    expect(props.onPoint).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });
});
