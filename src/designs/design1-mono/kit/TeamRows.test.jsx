import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeamRows from './TeamRows';
import RulesRow from './RulesRow';

function Host({ coloured = true }) {
  const [names, setNames] = useState(['Royals', 'Strikers']);
  const [colours, setColours] = useState(['#d62828', '#1d4ed8']);
  const teams = [1, 2].map((n) => ({
    n, letter: n === 1 ? 'A' : 'B', name: names[n - 1], colour: colours[n - 1],
    onName: (e) => setNames((cur) => cur.map((v, i) => (i === n - 1 ? e.target.value : v))),
    onFocus: () => {},
    onColour: (hex) => setColours((cur) => cur.map((v, i) => (i === n - 1 ? hex : v))),
  }));
  return (
    <>
      <TeamRows teams={teams} coloured={coloured} />
      <output data-testid="chosen">{colours.join(',')}</output>
    </>
  );
}

const colourButton = (letter, name) => screen.getByRole('button', { name: `Team ${letter} colour: ${name}` });

describe('TeamRows', () => {
  it('shows each team once, name and colour together', () => {
    render(<Host />);
    expect(screen.getByRole('textbox', { name: 'Team A name' })).toHaveValue('Royals');
    expect(screen.getByRole('textbox', { name: 'Team B name' })).toHaveValue('Strikers');
    expect(colourButton('A', 'Red')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(colourButton('A', 'Red')).toHaveAttribute('aria-expanded', 'false');
    expect(colourButton('B', 'Blue')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a dialog of swatches with the current colour selected', () => {
    render(<Host />);
    fireEvent.click(colourButton('A', 'Red'));
    const dialog = screen.getByRole('dialog', { name: 'Choose Team A colour' });
    expect(colourButton('A', 'Red')).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'Blue' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('picking a colour sets that team, closes the dialog and returns focus to the button', () => {
    render(<Host />);
    fireEvent.click(colourButton('A', 'Red'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yellow' }));
    expect(screen.getByTestId('chosen')).toHaveTextContent('#facc15,#1d4ed8');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(colourButton('A', 'Yellow')).toHaveFocus();
  });

  it('Escape closes the dialog without changing the colour and returns focus', () => {
    render(<Host />);
    fireEvent.click(colourButton('B', 'Blue'));
    fireEvent.keyDown(within(screen.getByRole('dialog')).getByRole('button', { name: 'Green' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('chosen')).toHaveTextContent('#d62828,#1d4ed8');
    expect(colourButton('B', 'Blue')).toHaveFocus();
  });

  it('closes on an outside press and keeps one dialog open at a time', () => {
    render(<Host />);
    fireEvent.click(colourButton('A', 'Red'));
    fireEvent.click(colourButton('B', 'Blue'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Choose Team B colour' })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Team A name' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the dialog open while a custom colour is chosen', () => {
    render(<Host />);
    fireEvent.click(colourButton('A', 'Red'));
    fireEvent.click(screen.getByRole('button', { name: 'More colours for Team A colour' }));
    fireEvent.change(screen.getByLabelText('Custom colour for Team A colour'), { target: { value: '#123456' } });
    expect(screen.getByTestId('chosen')).toHaveTextContent('#123456,#1d4ed8');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(colourButton('A', 'Custom')).toBeInTheDocument();
  });

  it('has no colour control for a sport without team colours', () => {
    render(<Host coloured={false} />);
    expect(screen.getByRole('textbox', { name: 'Team A name' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /colour/ })).toBeNull();
  });
});

describe('RulesRow', () => {
  it('is a button named by its action and described by the summary', () => {
    let clicks = 0;
    render(<RulesRow label="Rules" summary="6 games a set" actionLabel="Edit rules" onClick={() => { clicks += 1; }} />);
    const row = screen.getByRole('button', { name: 'Edit rules' });
    expect(row).toHaveAccessibleDescription('6 games a set');
    fireEvent.click(row);
    expect(clicks).toBe(1);
  });

  it('reports expanded state for an inline panel', () => {
    render(<RulesRow label="Rules" summary="x" actionLabel="Change rules" expanded onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Change rules' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('is plain text when nothing can be edited', () => {
    render(<RulesRow label="Rules" summary="First to 21" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('First to 21')).toBeInTheDocument();
  });
});
