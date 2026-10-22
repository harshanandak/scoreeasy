import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { deriveIdentityColour } from '../../lib/teamColour';
import TeamColourPicker, { QUICK_COUNT, TEAM_SWATCHES } from './TeamColourPicker';
import setupCss from './kit/setup.css?raw';

const renderPicker = (props = {}) => {
  const onChange = vi.fn();
  render(<TeamColourPicker label="Team A colour" value="#d62828" onChange={onChange} {...props} />);
  return onChange;
};

const group = () => screen.getByRole('group', { name: 'Team A colour' });
const swatch = (name) => within(group()).getByRole('button', { name });
const swatches = () => within(group()).getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));

function Controlled({ initial }) {
  const [value, setValue] = useState(initial);
  return <TeamColourPicker label="Team A colour" value={value} onChange={setValue} />;
}

describe('TeamColourPicker', () => {
  it('is a labelled group of named toggle swatches: five kit colours and More colours', () => {
    renderPicker();
    expect(swatches()).toHaveLength(QUICK_COUNT);
    expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'false');
    expect(swatch('More colours for Team A colour')).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the selected swatch with a check as well as aria-pressed (not colour alone)', () => {
    renderPicker();
    expect(swatch('Red').querySelector('.kit-sw-check')).not.toBeNull();
    expect(swatch('Blue').querySelector('.kit-sw-check')).toBeNull();
  });

  it('paints each swatch in the engine colour with the engine on-colour for the check', () => {
    renderPicker({ value: '#facc15' });
    const yellow = swatch('Yellow');
    const t = deriveIdentityColour('#facc15');
    expect(yellow.style.getPropertyValue('--kit-sw')).toBe(t.core);
    expect(yellow.style.getPropertyValue('--kit-sw-on')).toBe(t.on);
  });

  it('calls onChange with the swatch hex on click', () => {
    const onChange = renderPicker();
    fireEvent.click(swatch('Blue'));
    expect(onChange).toHaveBeenCalledWith('#1d4ed8');
  });

  it('puts every swatch in the tab order and never suppresses the focus ring inline (efaeb4bd)', () => {
    // A custom colour (the case the issue named) opens More colours, so every swatch is rendered.
    renderPicker({ value: '#123456' });
    expect(swatches()).toHaveLength(TEAM_SWATCHES.length);
    for (const button of within(group()).getAllByRole('button')) {
      expect(button).not.toHaveAttribute('tabindex', '-1');
      expect(button.style.outline).toBe('');
    }
    // The stylesheet styles selection with a box-shadow ring and never turns the outline off.
    const css = setupCss;
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });

  it('opens More colours with the other kit colours and a custom colour', () => {
    renderPicker();
    fireEvent.click(swatch('More colours for Team A colour'));
    expect(swatch('More colours for Team A colour')).toHaveAttribute('aria-expanded', 'true');
    expect(swatches()).toHaveLength(TEAM_SWATCHES.length);
    expect(screen.getByLabelText('Custom colour for Team A colour')).toBeInTheDocument();
  });

  it('opens with More colours expanded when the colour lives there (a Rematch prefill)', () => {
    renderPicker({ value: '#7a1020' });
    expect(swatch('Maroon')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps a collapsed selection visible on the More control', () => {
    render(<Controlled initial="#f97316" />);
    fireEvent.click(swatch('More colours for Team A colour'));
    expect(swatch('More colours for Team A colour, Orange selected')).toHaveAttribute('aria-expanded', 'false');
  });

  it('accepts a valid custom colour and ignores an invalid one', () => {
    const onChange = renderPicker();
    fireEvent.click(swatch('More colours for Team A colour'));
    const custom = screen.getByLabelText('Custom colour for Team A colour');
    fireEvent.change(custom, { target: { value: '#123456' } });
    expect(onChange).toHaveBeenCalledWith('#123456');
    onChange.mockClear();
    // A native colour input never yields this, but a crafted event must not get through.
    Object.defineProperty(custom, 'value', { configurable: true, get: () => 'red;background:url(x)' });
    fireEvent.change(custom);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws the focus ring round the custom control while its colour input has focus', () => {
    renderPicker();
    fireEvent.click(swatch('More colours for Team A colour'));
    const input = screen.getByLabelText('Custom colour for Team A colour');
    const control = input.closest('label');
    expect(control).not.toHaveClass('is-focused');
    fireEvent.focus(input);
    expect(control).toHaveClass('is-focused');
    fireEvent.blur(input);
    expect(control).not.toHaveClass('is-focused');
  });

  it('presses no kit swatch for a custom colour and says the custom one is selected', () => {
    renderPicker({ value: '#123456' });
    for (const b of swatches()) expect(b).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Custom colour for Team A colour (selected)')).toBeInTheDocument();
  });

  it('keeps every swatch a 48px thumb target', () => {
    renderPicker();
    const css = setupCss;
    const rule = css.match(/\n\.kit-sw \{[^}]*\}/)[0];
    expect(rule).toMatch(/min-width: 48px/);
    expect(rule).toMatch(/min-height: 48px/);
    for (const b of within(group()).getAllByRole('button')) expect(b).toHaveClass('kit-sw');
  });
});
