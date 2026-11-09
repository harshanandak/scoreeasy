import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KitChoiceGrid, KitNumberStepper, KitToggleRow } from './KitFormControls';

describe('KitToggleRow', () => {
  it('is a switch that reports its state and flips on tap', () => {
    const onChange = vi.fn();
    const { rerender } = render(<KitToggleRow label="Raid clock" hint="Each raid has a time limit." checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Raid clock' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription('Each raid has a time limit.');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<KitToggleRow label="Raid clock" checked onChange={onChange} />);
    expect(screen.getByRole('switch', { name: 'Raid clock' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('does nothing when disabled', () => {
    const onChange = vi.fn();
    render(<KitToggleRow label="X" checked={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('KitNumberStepper', () => {
  const Harness = ({ start = 5, min = 2, max = 12, onSeen }) => {
    const [v, setV] = useState(start);
    return <KitNumberStepper label="Players a side" value={v} min={min} max={max} onChange={n => { onSeen?.(n); setV(n); }} />;
  };

  it('exposes spinbutton values and steps with the buttons', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'Players a side' });
    expect(input).toHaveAttribute('aria-valuenow', '5');
    expect(input).toHaveAttribute('aria-valuemin', '2');
    expect(input).toHaveAttribute('aria-valuemax', '12');
    fireEvent.click(screen.getByRole('button', { name: 'More: Players a side' }));
    expect(input).toHaveAttribute('aria-valuenow', '6');
    fireEvent.click(screen.getByRole('button', { name: 'Fewer: Players a side' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fewer: Players a side' }));
    expect(input).toHaveAttribute('aria-valuenow', '4');
  });

  it('disables the buttons at the bounds', () => {
    const { unmount } = render(<Harness start={2} />);
    expect(screen.getByRole('button', { name: 'Fewer: Players a side' })).toBeDisabled();
    unmount();
    render(<Harness start={12} />);
    expect(screen.getByRole('button', { name: 'More: Players a side' })).toBeDisabled();
  });

  it('accepts a typed value inside the bounds and ignores one outside', () => {
    const seen = vi.fn();
    render(<Harness onSeen={seen} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '9' } });
    expect(seen).toHaveBeenLastCalledWith(9);
    fireEvent.change(input, { target: { value: '99' } });
    expect(seen).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: '1' } });
    expect(seen).toHaveBeenCalledTimes(1);
    fireEvent.blur(input);
    expect(input).toHaveValue('9');
    expect(input).toHaveAttribute('aria-valuenow', '9');
  });

  it('steps with the arrow keys and stays inside the bounds', () => {
    render(<Harness start={11} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-valuenow', '12');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-valuenow', '11');
  });
});

describe('KitChoiceGrid', () => {
  const options = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }];
  const Harness = () => {
    const [v, setV] = useState('a');
    return <KitChoiceGrid label="Pick" options={options} value={v} onChange={setV} />;
  };

  it('is a radiogroup with one tab stop on the chosen chip', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves the choice and focus with arrows, wraps, and jumps with Home/End', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Alpha' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Beta' }), { key: 'End' });
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Gamma' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Alpha' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Gamma' }), { key: 'Home' });
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
  });

  it('chooses on tap', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Gamma' }));
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true');
  });
});
