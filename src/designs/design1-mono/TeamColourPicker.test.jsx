import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamColourPicker, { TEAM_SWATCHES } from './TeamColourPicker';

const renderPicker = (props = {}) => {
  const onChange = vi.fn();
  render(<TeamColourPicker label="Team A colour" value="#d62828" onChange={onChange} {...props} />);
  return onChange;
};

describe('TeamColourPicker', () => {
  it('is a labelled radiogroup of named swatches with the current one checked', () => {
    renderPicker();
    const group = screen.getByRole('radiogroup', { name: 'Team A colour' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(TEAM_SWATCHES.length);
    expect(screen.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the swatch hex on click', () => {
    const onChange = renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(onChange).toHaveBeenCalledWith('#1d4ed8');
  });

  it('moves the selection with the arrow keys (roving focus)', () => {
    const onChange = renderPicker();
    const red = screen.getByRole('radio', { name: 'Red' });
    expect(red).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(red, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(TEAM_SWATCHES[1].hex);
    fireEvent.keyDown(red, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(TEAM_SWATCHES[TEAM_SWATCHES.length - 1].hex);
  });

  it('accepts a valid custom colour and ignores an invalid one', () => {
    const onChange = renderPicker();
    const custom = screen.getByLabelText('Custom colour for Team A colour');
    fireEvent.change(custom, { target: { value: '#123456' } });
    expect(onChange).toHaveBeenCalledWith('#123456');
    onChange.mockClear();
    // A native colour input never yields this, but a crafted event must not get through.
    Object.defineProperty(custom, 'value', { configurable: true, get: () => 'red;background:url(x)' });
    fireEvent.change(custom);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a focus ring on the custom swatch while its colour input has focus', () => {
    renderPicker();
    const input = screen.getByLabelText('Custom colour for Team A colour');
    const swatch = input.closest('label');
    expect(swatch.style.outline).toBe('none');
    fireEvent.focus(input);
    expect(swatch.style.outline).toMatch(/3px solid/);
    fireEvent.blur(input);
    expect(swatch.style.outline).toBe('none');
  });

  it('checks no swatch for a custom colour', () => {
    renderPicker({ value: '#123456' });
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps every swatch a thumb-sized target', () => {
    renderPicker();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
    }
  });
});
