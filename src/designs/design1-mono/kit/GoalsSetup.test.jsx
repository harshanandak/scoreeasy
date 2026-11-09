import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSportById } from '../../../models/sportRegistry';
import { periodPreset } from '../../../utils/goalsPeriods';
import { GoalsGameStep, GoalsRulesStep } from './GoalsSetup';

// Mirrors how MonoQuickMatch holds `format`. The app shows these on two steps (game, rules); the
// host shows them together so one test can drive both.
let latest;
function Host({ sport = 'football' }) {
  const [format, setFormat] = useState(() => periodPreset(sport));
  latest = format;
  return (
    <>
      <GoalsGameStep sport={sport} format={format} onChange={setFormat} />
      <GoalsRulesStep sport={sport} sportConfig={getSportById(sport)} format={format} onChange={setFormat} />
    </>
  );
}
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'More rules' }));

describe('GoalsGameStep', () => {
  it.each([['football', 'IFAB 2026/27', '2 × 45 min'], ['basketball', 'FIBA 5-on-5 2024', '4 × 10 min'], ['hockey', 'FIH outdoor 2027', '4 × 15 min']])(
    '%s offers the official preset first and chosen, then Custom and Quick casual',
    (sport, label, hint) => {
      render(<Host sport={sport} />);
      expect(screen.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: label })).toHaveAccessibleDescription(new RegExp(`^${hint}`));
      expect(screen.getAllByRole('radio').map(radio => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
      expect(screen.getByRole('radio', { name: 'Custom school/event' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Quick casual' })).toBeInTheDocument();
    },
  );

  it('produces the same formats as the old Timing preset select', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('radio', { name: 'Custom school/event' }));
    expect(latest).toEqual(periodPreset('football', 'custom'));
    fireEvent.click(screen.getByRole('radio', { name: 'Quick casual' }));
    expect(latest).toEqual(periodPreset('football', 'casual'));
    fireEvent.click(screen.getByRole('radio', { name: 'IFAB 2026/27' }));
    expect(latest).toEqual(periodPreset('football', 'official'));
  });
});

describe('GoalsRulesStep', () => {
  it('summarises the official preset and shows its periods and minutes', () => {
    render(<Host />);
    expect(screen.getByRole('heading', { level: 2, name: 'IFAB 2026/27 · 2 × 45 min' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Number of periods' })).toHaveValue('2');
    expect(screen.getByRole('spinbutton', { name: 'Minutes per period' })).toHaveValue('45');
    expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  });

  it('editing minutes makes the rules Custom, offers Reset and keeps the period count', () => {
    render(<Host />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutes per period' }), { target: { value: '30' } });
    expect(latest.periodPreset).toBe('custom');
    expect(latest.periods.durations).toEqual([1800, 1800]);
    expect(screen.getByRole('heading', { level: 2, name: /^Custom school\/event · 2 × 30 min/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to IFAB 2026/27' }));
    expect(latest).toEqual(periodPreset('football', 'official'));
  });

  it('keeps the football extra-time switch and the period note under More rules', () => {
    render(<Host />);
    expect(screen.queryByRole('switch')).toBeNull();
    openMore();
    fireEvent.click(screen.getByRole('switch', { name: 'Two 15-minute extra-time halves if tied' }));
    expect(latest.periods.extraDurations).toEqual([900, 900]);
    expect(screen.getByText(/Scorer controls every period end/)).toBeInTheDocument();
  });

  it('shows no extra-time switch for basketball, and its overtime note', () => {
    render(<Host sport="basketball" />);
    openMore();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText(/repeated 5-minute overtime/)).toBeInTheDocument();
  });

  it('Quick casual puts how the match ends in Rules: timed, first to or free play', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('radio', { name: 'Quick casual' }));
    expect(screen.queryByRole('spinbutton', { name: 'Number of periods' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More rules' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Match ends' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'First to' }));
    expect(latest.mode).toBe('points');
    fireEvent.click(screen.getByRole('button', { name: '5 goals' }));
    expect(latest.target).toBe(5);
    expect(screen.getByRole('heading', { level: 2, name: /^Quick casual · First to 5 goals wins/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Timed' }));
    expect(latest.mode).toBe('timed');
    expect(screen.getByRole('group', { name: 'Match length' })).toBeInTheDocument();
  });
});
