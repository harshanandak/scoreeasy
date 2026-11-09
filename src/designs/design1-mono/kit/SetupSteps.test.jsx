import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LastCustomSetup, SetupStepper } from './SetupSteps';

const steps = [{ id: 'game', label: 'Game' }, { id: 'teams', label: 'Teams' }, { id: 'rules', label: 'Rules' }];

describe('SetupStepper', () => {
  it('lists every step by its label and marks only the current one', () => {
    render(<SetupStepper steps={steps} current={1} onSelect={() => {}} />);
    expect(screen.getByRole('navigation', { name: 'Setup steps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teams' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Game' })).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('opens any step directly with its index', () => {
    const onSelect = vi.fn();
    render(<SetupStepper steps={steps} current={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});


it('offers exactly one saved setup row and applies it in one tap', () => {
  const saved = { format: { overs: 15, players: 8 } };
  const onUse = vi.fn();
  const view = render(<LastCustomSetup saved={null} onUse={onUse} />);
  expect(screen.queryByRole('button')).toBeNull();
  view.rerender(<LastCustomSetup saved={saved} summary="15 overs, 8 players" onUse={onUse} />);
  fireEvent.click(screen.getByRole('button', { name: /Use my last custom setup/ }));
  expect(onUse).toHaveBeenCalledWith(saved);
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
