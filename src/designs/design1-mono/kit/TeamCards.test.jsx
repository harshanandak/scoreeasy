import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeamCards from './TeamCards';

function Host({ coloured = true }) {
  const [names, setNames] = useState(['Royals', 'Strikers']);
  const [colours, setColours] = useState(['#d62828', '#1d4ed8']);
  const teams = [1, 2].map((n) => ({
    n, letter: n === 1 ? 'A' : 'B', name: names[n - 1], colour: colours[n - 1],
    onName: (e) => setNames((p) => p.map((v, i) => (i === n - 1 ? e.target.value : v))),
    onFocus: () => {},
    onColour: (hex) => setColours((p) => p.map((v, i) => (i === n - 1 ? hex : v))),
    suggestions: null,
  }));
  return <TeamCards teams={teams} coloured={coloured} colourStyle={{ '--team-a-core': 'rgb(1 2 3)' }} />;
}

describe('TeamCards', () => {
  it('shows one card per team with its name and colour in the button name', () => {
    render(<Host />);
    expect(screen.getByRole('button', { name: 'Edit Team A: Royals, Red' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByRole('button', { name: 'Edit Team B: Strikers, Blue' })).toBeInTheDocument();
    expect(screen.getByTestId('matchup-preview')).toHaveClass('is-team');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Edit name and colour/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Team A: Royals, Red' }).querySelector('.kit-tcard-pencil')).not.toBeNull();
  });

  it('opens one sheet with the name and the colours together, and the name edits live', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: /^Edit Team A:/ }));
    const sheet = screen.getByRole('dialog', { name: 'Team A' });
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Team A name' }), { target: { value: 'Eagles' } });
    expect(within(sheet).getByText('Eagles', { selector: 'b' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yellow' }));
    expect(within(sheet).getByRole('button', { name: 'Yellow' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sheet).getByText('Yellow', { selector: '.kit-tchip span' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Team A: Eagles, Yellow' })).toBeInTheDocument();
  });

  it('blocks the other team colour in the sheet so both teams cannot match', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: /^Edit Team A:/ }));
    expect(screen.getByRole('button', { name: 'Blue, used by Team B' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /^Edit Team B:/ }));
    expect(screen.getByRole('button', { name: 'Red, used by Team A' })).toBeDisabled();
  });

  it('closes on Escape', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: /^Edit Team B:/ }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Team B' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a name-only sheet for a sport without team colours', () => {
    render(<Host coloured={false} />);
    expect(screen.getByRole('button', { name: 'Edit Team A: Royals' })).toBeInTheDocument();
    expect(screen.getByTestId('matchup-preview')).not.toHaveClass('is-team');
    fireEvent.click(screen.getByRole('button', { name: /^Edit Team A:/ }));
    expect(screen.queryByRole('group', { name: 'Team A colour' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Team A name' })).toHaveValue('Royals');
  });
});
