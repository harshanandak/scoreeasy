import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NextStepButton, SetupStepper } from './SetupSteps';

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

describe('NextStepButton', () => {
  it('names the next step and calls back', () => {
    const onClick = vi.fn();
    render(<NextStepButton label="Teams" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /^Next: Teams/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
