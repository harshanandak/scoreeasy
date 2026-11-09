import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSportById } from '../../../models/sportRegistry';
import { buildCricketFormat } from '../../../utils/cricketCalculations';
import { CricketRulesStep, cricketRuleValues } from './CricketSetup';

// Mirrors how MonoQuickMatch holds `format`: the step reports the whole next format.
let latest;
function Host({ preset = 'gully' }) {
  const [format, setFormat] = useState(() => buildCricketFormat(preset));
  const [source, setSource] = useState(null);
  latest = format;
  return <CricketRulesStep sportConfig={getSportById('cricket')} format={format} cricketPreset={format.preset} source={source} onSourceChange={setSource} onChange={setFormat} />;
}
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'More rules' }));

describe('CricketRulesStep', () => {
  it('shows T20 values and changes to the same Custom config, with a reverse path', () => {
    render(<Host preset="T20" />);
    expect(screen.getByRole('heading', { level: 2, name: /^T20/ })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Players per side' })).toHaveValue('11');
    expect(screen.getByRole('button', { name: '20' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    expect(latest).toEqual(buildCricketFormat('custom', cricketRuleValues({ ...buildCricketFormat('T20'), overs: 10, powerplay: [] })));
    expect(screen.getByRole('heading', { name: /^Customised.*from T20/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to T20' }));
    expect(latest).toEqual(buildCricketFormat('T20'));
  });

  it('shows gully overs, players and match type, with a plain summary line', () => {
    render(<Host />);
    expect(screen.getByRole('heading', { level: 2, name: /^Gully Cricket · 5 overs · 6 players · 1 innings each · bat only/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Overs' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Players per side' })).toHaveValue('6');
    expect(screen.getByRole('group', { name: 'Match type' })).toBeInTheDocument();
    expect(screen.getByText('One team bats, the other bowls')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Scoring format' })).toBeInTheDocument();
  });

  it('keeps the old patches: overs, players and match type', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    expect(latest.overs).toBe(10);
    fireEvent.click(screen.getByRole('button', { name: 'No limit' }));
    expect(latest.overs).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More: Players per side' }));
    expect(latest.players).toBe(7);
    expect(screen.getByText('6 wickets to bowl a team out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bat and bowl' }));
    expect(latest.solo).toBe(false);
    expect(screen.getByText('Both teams bat and bowl')).toBeInTheDocument();
  });

  it('takes a typed number of overs from 1 to 50', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom overs (1 to 50)' }), { target: { value: '12' } });
    expect(latest.overs).toBe(12);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom overs (1 to 50)' }), { target: { value: '99' } });
    expect(latest.overs).toBe(12);
  });

  it('keeps innings and the three gully house rules under More rules', () => {
    render(<Host />);
    expect(screen.queryByRole('switch')).toBeNull();
    openMore();
    fireEvent.click(screen.getByRole('button', { name: '2 per side (Test)' }));
    expect(latest).toMatchObject({ totalInnings: 4, declaration: true, followOn: true });
    fireEvent.click(screen.getByRole('button', { name: '1 per side' }));
    expect(latest).toMatchObject({ totalInnings: 2, declaration: false, followOn: false });
    for (const [name, key] of [['Last man bats', 'lastManStands'], ['Trial ball', 'trialBall'], ['One tip one hand', 'oneTipOneHand']]) {
      fireEvent.click(screen.getByRole('switch', { name }));
      expect(latest[key]).toBe(true);
      expect(screen.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true');
    }
  });

  it('Custom can score by balls, with a ball limit and No limit', () => {
    render(<Host preset="custom" />);
    expect(screen.queryByRole('switch')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'By balls' }));
    expect(latest).toMatchObject({ trackOvers: false, overs: null, powerplay: [] });
    expect(screen.getByRole('group', { name: 'Ball limit' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More balls' }));
    expect(latest.maxBalls).toBe(30);
    fireEvent.click(screen.getByRole('button', { name: 'No limit' }));
    expect(latest.maxBalls).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'By overs' }));
    expect(latest).toMatchObject({ trackOvers: true, maxBalls: null });
  });
});


it('syncs typed overs after Reset without interrupting typing', () => {
  render(<Host preset="T20" />);
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  const input = screen.getByRole('spinbutton', { name: 'Custom overs (1 to 50)' });
  fireEvent.change(input, { target: { value: '1' } });
  expect(screen.getByRole('spinbutton', { name: 'Custom overs (1 to 50)' })).toBe(input);
  fireEvent.change(input, { target: { value: '12' } });
  expect(latest.overs).toBe(12);
  fireEvent.click(screen.getByRole('button', { name: 'Reset to T20' }));
  expect(screen.getByRole('button', { name: '20' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('spinbutton', { name: 'Custom overs (1 to 50)' })).toBeNull();
});

it('keeps free hit visible and editable and drops stale powerplay on a length change', () => {
  render(<Host preset="T20" />); openMore();
  expect(screen.getByRole('switch', { name: 'Free hit after a no-ball' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('switch', { name: 'Free hit after a no-ball' }));
  expect(latest.freeHit).toBe(false);
  expect(screen.getByRole('heading', { name: /^Customised.*from T20/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset to T20' }));
  fireEvent.click(screen.getByRole('button', { name: '10' }));
  expect(latest.freeHit).toBe(true);
  expect(latest.powerplay).toEqual([]);
});

it('uses all players for the wickets hint when last man bats', () => {
  render(<Host />); openMore();
  fireEvent.click(screen.getByRole('switch', { name: 'Last man bats' }));
  expect(screen.getByText('6 wickets to bowl a team out')).toBeInTheDocument();
});

it('does not mark the unedited Custom preset as Customised', () => {
  render(<Host preset="custom" />);
  expect(screen.getByRole('heading', { name: /^Custom / })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
});
