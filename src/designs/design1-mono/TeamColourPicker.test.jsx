import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { deriveIdentityColour } from '../../lib/teamColour';
import TeamColourPicker, { TEAM_SWATCHES, colourNameOf } from './TeamColourPicker';
import sheetCss from './kit/teamSheet.css?raw';

const renderPicker = (props = {}) => {
  const onChange = vi.fn();
  render(<TeamColourPicker label="Team A colour" value="#d62828" onChange={onChange} {...props} />);
  return onChange;
};

const group = () => screen.getByRole('group', { name: 'Team A colour' });
const swatch = (name) => within(group()).getByRole('button', { name });
const swatches = () => within(group()).getAllByRole('button');

describe('TeamColourPicker', () => {
  it('is a labelled group with every kit colour as a named toggle, no More colours step', () => {
    renderPicker();
    expect(swatches()).toHaveLength(TEAM_SWATCHES.length);
    expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /More colours/ })).toBeNull();
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

  it('blocks the other team colour: disabled, named, and never sent to onChange', () => {
    const onChange = renderPicker({ blockedHex: '#1d4ed8', blockedLabel: 'Team B' });
    const blocked = swatch('Blue, used by Team B');
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(blocked);
    expect(onChange).not.toHaveBeenCalled();
    expect(swatch('Yellow')).toBeEnabled();
  });

  it('ignores a custom colour equal to the blocked one', () => {
    const onChange = renderPicker({ blockedHex: '#123456', blockedLabel: 'Team B' });
    fireEvent.change(screen.getByLabelText('Custom colour for Team A colour'), { target: { value: '#123456' } });
    expect(onChange).not.toHaveBeenCalled();
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

  it('presses no kit swatch for a custom colour and says the custom one is selected', () => {
    renderPicker({ value: '#123456' });
    for (const b of swatches()) expect(b).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Custom colour for Team A colour (selected)')).toBeInTheDocument();
    expect(colourNameOf('#123456')).toBe('Custom');
    expect(colourNameOf('#7a1020')).toBe('Maroon');
  });

  it('keeps every swatch at least 48px and never turns the focus ring off', () => {
    const face = sheetCss.match(/\n\.kit-sw-face \{[^}]*\}/)[0];
    expect(Number(face.match(/height: (\d+)px/)[1])).toBeGreaterThanOrEqual(48);
    const cell = sheetCss.match(/\n\.kit-sw \{[^}]*\}/)[0];
    expect(Number(cell.match(/min-width: (\d+)px/)[1])).toBeGreaterThanOrEqual(48);
    expect(Number(cell.match(/min-height: (\d+)px/)[1])).toBeGreaterThanOrEqual(48);
    expect(sheetCss).not.toMatch(/outline:\s*(none|0)\b/);
    renderPicker();
    for (const b of swatches()) {
      expect(b).toHaveClass('kit-sw');
      expect(b).not.toHaveAttribute('tabindex', '-1');
      expect(b.style.outline).toBe('');
    }
  });
});
