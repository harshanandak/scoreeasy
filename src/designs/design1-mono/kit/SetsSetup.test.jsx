import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { applySetsPreset, freezeSetsFormat, SETS_PROFILES } from '../../../models/setsRules';
import { getSportById } from '../../../models/sportRegistry';
import { SetsRulesStep } from './SetsSetup';

// Mirrors how MonoQuickMatch holds `format`: the step reports the whole next format.
let latest;
function Host({ sport = 'volleyball', preset = 'casual', initial }) {
  const [format, setFormat] = useState(() => {
    if (initial) return initial;
    const casual = applySetsPreset(sport, 'casual', {});
    return preset === 'casual' ? casual : applySetsPreset(sport, preset, casual);
  });
  const [source, setSource] = useState(null);
  latest = format;
  return <SetsRulesStep source={source} onSourceChange={setSource} sport={sport} sportConfig={getSportById(sport)} format={format} onChange={setFormat} names={['Royals', 'Strikers']} />;
}
const official = SETS_PROFILES.volleyball.label;
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'More rules' }));

describe('SetsRulesStep', () => {
  it('opens as Quick casual with one summary line and a common-rules card', () => {
    render(<Host />);
    expect(screen.getByRole('heading', { level: 2, name: /^Quick casual · First to 15/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Quick casual' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('group', { name: 'Points to win' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'First server' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Win by' })).toBeNull();
  });

  it('picks the official preset with its source one tap under More rules', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('radio', { name: official }));
    expect(latest).toEqual(applySetsPreset('volleyball', 'official', applySetsPreset('volleyball', 'casual', {})));
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(`^${official}`) })).toBeInTheDocument();
    openMore();
    expect(screen.getByRole('link', { name: 'Rules source and edition' })).toHaveAttribute('href', SETS_PROFILES.volleyball.source);
  });

  it('changing points on the official preset makes the rules Custom school', () => {
    render(<Host preset="official" />);
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    expect(latest.rulesPreset).toBe('Custom school');
    expect(latest.points).toBe(15);
  });

  it('keeps every Custom school rule reachable under More rules, each with its old name', () => {
    render(<Host preset="custom" />);
    openMore();
    for (const name of ['Number of games or sets', 'Win by', 'Service mode', 'Next game first server', 'Scoring mode']) {
      expect(screen.getByRole('combobox', { name })).toBeInTheDocument();
    }
    for (const name of ['Custom points to win', 'Point cap', 'Deciding target', 'Deciding end change']) {
      expect(screen.getByRole('spinbutton', { name })).toBeInTheDocument();
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Win by' }), { target: { value: '1' } });
    expect(latest.customization.winBy).toBe(1);
    expect(latest.rulesPreset).toBe('Custom school');
    fireEvent.change(screen.getByRole('combobox', { name: 'Service mode' }), { target: { value: 'alternating' } });
    expect(screen.getByRole('spinbutton', { name: 'Serve every' })).toBeInTheDocument();
  });

  it('sets the first server and can clear it', () => {
    render(<Host />);
    const group = screen.getByRole('group', { name: 'First server' });
    fireEvent.click(group.querySelectorAll('button')[2]);
    expect(latest.initialServer).toBe(2);
    expect(screen.getByRole('button', { name: 'Strikers' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Unknown' }));
    expect(latest.initialServer).toBeNull();
  });
});


it.each(['volleyball', 'badminton', 'tabletennis'])('%s exposes standard rule controls and edits through Custom', sport => {
  render(<Host sport={sport} preset="official" />);
  openMore();
  expect(screen.getByRole('combobox', { name: 'Win by' })).toHaveValue('2');
  expect(screen.getByRole('spinbutton', { name: 'Custom points to win' })).toHaveValue(SETS_PROFILES[sport].points);
  fireEvent.change(screen.getByRole('combobox', { name: 'Win by' }), { target: { value: '1' } });
  const officialFormat = applySetsPreset(sport, 'official', applySetsPreset(sport, 'casual', {}));
  expect(latest).toEqual(applySetsPreset(sport, 'custom', { ...officialFormat, customization: { winBy: 1 } }));
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: SETS_PROFILES[sport].label }));
  expect(latest).toEqual(applySetsPreset(sport, 'official', applySetsPreset(sport, 'custom', { ...officialFormat, customization: { winBy: 1 } })));
});


it('applies the Custom chip to current single-game values without marking them edited', () => {
  render(<Host />);
  const before = latest;
  fireEvent.click(screen.getByRole('radio', { name: 'Custom school' }));
  expect(latest).toEqual(applySetsPreset('volleyball', 'custom', before));
  expect(screen.getByRole('heading', { name: /^Custom school/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  expect(freezeSetsFormat(getSportById('volleyball'), latest).setsRules.sets).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: '21' }));
  expect(screen.getByRole('radio', { name: 'Customised' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
});

it('keeps the official name for the toss and retains toss and mode when switching presets', () => {
  render(<Host initial={applySetsPreset('volleyball', 'official', { formatMode: 'standard' })} />);
  fireEvent.click(screen.getByRole('button', { name: 'Strikers' }));
  expect(screen.getByRole('radio', { name: official })).toHaveAttribute('aria-checked', 'true');
  expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  for (const label of ['Quick casual', official, 'Custom school']) {
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect(latest.initialServer).toBe(2);
    expect(latest.formatMode).toBe('standard');
  }
});
