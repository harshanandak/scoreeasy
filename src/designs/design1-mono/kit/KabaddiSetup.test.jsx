import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KABADDI_PRESETS, resolveKabaddiRules } from '../../../utils/kabaddiRules';
import { basePresetOf, kabaddiBlurb, kabaddiChanges, KabaddiFirstRaid, KabaddiGameStep, KabaddiRulesStep } from './KabaddiSetup';

// Mirrors how MonoQuickMatch holds `format`. The app shows these on three different steps (game,
// teams, rules); the host shows them together so one test can drive all of them.
let latest;
function Host({ initial = { kabaddiRules: resolveKabaddiRules('quick') } }) {
  const [format, setFormat] = useState(initial);
  latest = format;
  return (
    <>
      <KabaddiGameStep format={format} onChange={setFormat} />
      <KabaddiFirstRaid format={format} onChange={setFormat} names={['Royals', 'Strikers']} />
      <KabaddiRulesStep format={format} onChange={setFormat} />
    </>
  );
}
// The common rules show at once; the rest sit under one collapsed "More rules" row.
const openRules = () => fireEvent.click(screen.getByRole('button', { name: 'More rules' }));
// What the saved match settings were before the redesign for a custom edit.
const custom = (base, patch) => resolveKabaddiRules('custom', { ...base, ...patch });

describe('KabaddiGameStep presets', () => {
  it.each(KABADDI_PRESETS.filter(p => p.id !== 'custom'))('choosing $label saves the same rules as before', ({ id, label }) => {
    render(<Host initial={{ kabaddiRules: resolveKabaddiRules(id === 'quick' ? 'standard' : 'quick') }} />);
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect(latest.kabaddiRules).toEqual(resolveKabaddiRules(id));
    expect(screen.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true');
  });

  it('offers four presets, and Custom only once rules are edited', () => {
    render(<Host />);
    for (const label of ['Quick casual', 'Standard', 'Standard women / younger', 'Pro Kabaddi style']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    openRules();
    fireEvent.click(screen.getByRole('switch', { name: 'Raid clock' }));
    const chip = screen.getByRole('radio', { name: 'Customised' });
    expect(chip).toHaveAttribute('aria-checked', 'true');
    expect(latest.kabaddiRules.presetId).toBe('custom');
    fireEvent.click(screen.getByRole('radio', { name: 'Pro Kabaddi style' }));
    expect(latest.kabaddiRules).toEqual(resolveKabaddiRules('pro'));
    expect(screen.queryByRole('radio', { name: 'Customised' })).toBeNull();
  });

  it('keeps the first raid choice', () => {
    render(<Host />);
    const group = screen.getByRole('group', { name: 'First raid' });
    fireEvent.click(within(group).getByRole('button', { name: 'Strikers' }));
    expect(latest.openingRaidTeam).toBe(1);
    expect(latest.kabaddiRules).toEqual(resolveKabaddiRules('quick'));
  });
});

describe('KabaddiGameStep cards', () => {
  it('gives every preset card a one-line plain description that is not part of its name', () => {
    render(<Host />);
    for (const p of KABADDI_PRESETS.filter(x => x.id !== 'custom')) {
      const card = screen.getByRole('radio', { name: p.label });
      expect(card).toHaveAccessibleDescription(kabaddiBlurb(resolveKabaddiRules(p.id)));
    }
  });
});

describe('KabaddiRulesStep summary, changes and reset', () => {
  it('is one summary line, with Reset only after a change', () => {
    render(<Host />);
    expect(screen.getByRole('heading', { level: 2, name: /^Quick casual · 5 a side/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  });

  it('counts what changed from the preset and resets in one tap', () => {
    render(<Host />);
    fireEvent.click(screen.getByRole('switch', { name: 'Raid clock' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Customised ? from Quick casual · 1 change' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Quick casual' }));
    expect(latest.kabaddiRules).toEqual(resolveKabaddiRules('quick'));
    expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  });

  it('shows standard values, uses the existing Custom rules and recognises restored values', () => {
    const standard = resolveKabaddiRules('standard');
    render(<Host initial={{ kabaddiRules: standard }} />);
    expect(screen.getByRole('spinbutton', { name: 'Players a side' })).toHaveValue(7);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutes a half' }), { target: { value: '15' } });
    expect(latest.kabaddiRules).toEqual(custom(standard, { end: { ...standard.end, halfMs: 900000 } }));
    expect(screen.getByRole('heading', { name: /^Customised ? from Standard/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutes a half' }), { target: { value: '20' } });
    expect(screen.getByRole('heading', { name: /^Standard ?/ })).toBeInTheDocument();
  });

  it('works out the base preset of an edited copy and diffs against it', () => {
    const standard = resolveKabaddiRules('standard');
    const edited = custom(standard, { initialPlayers: 6 });
    expect(basePresetOf(edited)).toBe('standard');
    expect(kabaddiChanges(standard, edited)).toContain('Players a side: 6');
    expect(kabaddiChanges(standard, standard)).toEqual([]);
    for (const id of ['quick', 'standard', 'women', 'pro']) {
      expect(basePresetOf(custom(resolveKabaddiRules(id), {}))).toBe(id);
    }
  });
});

describe('KabaddiRulesStep rules panel saves what the old panel saved', () => {
  const quick = resolveKabaddiRules('quick');
  const standard = resolveKabaddiRules('standard');

  it('shows the common rules at once and keeps the rest under one More rules row', () => {
    render(<Host />);
    expect(screen.getByTestId('kabaddi-rules-panel')).toBeInTheDocument();
    for (const name of ['Players a side', 'Target points']) expect(screen.getByRole('spinbutton', { name })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Raid clock' })).toBeInTheDocument();
    for (const name of ['Bonus point', 'Do-or-die after empty raids', 'Players go out and revive in order']) {
      expect(screen.queryByRole('switch', { name })).toBeNull();
    }
    expect(screen.getByRole('button', { name: 'More rules' })).toHaveAttribute('aria-expanded', 'false');
    openRules();
    expect(screen.getByRole('button', { name: 'More rules' })).toHaveAttribute('aria-expanded', 'true');
    for (const name of ['Bonus point', 'Do-or-die after empty raids', 'Players go out and revive in order']) {
      expect(screen.getByRole('switch', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('How scoring ends')).toBeInTheDocument();
  });

  it('keeps the explanation behind a small (i) instead of a line under every row', () => {
    render(<Host />); openRules();
    expect(screen.queryByText(/A raider can win an extra point/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'About Bonus point' }));
    expect(screen.getByText(/A raider can win an extra point/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'About Raid clock' })).toBeNull();
  });

  it('players a side, with bonus and super tackle capped', () => {
    render(<Host initial={{ kabaddiRules: standard }} />); openRules();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Players a side' }), { target: { value: '4' } });
    expect(latest.kabaddiRules).toEqual(custom(standard, {
      initialPlayers: 4,
      bonus: { ...standard.bonus, minDefenders: 4 },
      superTackle: { ...standard.superTackle, maxDefenders: 3 },
    }));
  });

  it('play to switches the end rule with the old defaults', () => {
    render(<Host />); openRules();
    fireEvent.click(screen.getByRole('button', { name: 'Equal raids' }));
    expect(latest.kabaddiRules).toEqual(custom(quick, { end: { kind: 'raids', raidsPerTeam: 10 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Two halves' }));
    expect(latest.kabaddiRules.end).toEqual({ kind: 'timed', halves: 2, halfMs: 1200000, intervalMs: 300000 });
    fireEvent.click(screen.getByRole('button', { name: 'Target points' }));
    expect(latest.kabaddiRules.end).toEqual({ kind: 'target', points: 21 });
  });

  it('target points by stepper and by typing; out-of-range typing is ignored', () => {
    render(<Host />); openRules();
    fireEvent.click(screen.getByRole('button', { name: 'More: Target points' }));
    expect(latest.kabaddiRules.end).toEqual({ kind: 'target', points: 22 });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Target points' }), { target: { value: '30' } });
    expect(latest.kabaddiRules.end).toEqual({ kind: 'target', points: 30 });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Target points' }), { target: { value: '0' } });
    expect(latest.kabaddiRules.end.points).toBe(30);
  });

  it('timed halves expose minutes and interval', () => {
    render(<Host initial={{ kabaddiRules: standard }} />); openRules();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutes a half' }), { target: { value: '15' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Interval minutes' }), { target: { value: '0' } });
    expect(latest.kabaddiRules.end).toEqual({ kind: 'timed', halves: 2, halfMs: 900000, intervalMs: 0 });
  });

  it('raid clock switch', () => {
    render(<Host />); openRules();
    expect(screen.getByRole('switch', { name: 'Raid clock' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('switch', { name: 'Raid clock' }));
    expect(latest.kabaddiRules).toEqual(custom(quick, { raidLimitMs: 30000 }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Raid seconds' }), { target: { value: '45' } });
    expect(latest.kabaddiRules.raidLimitMs).toBe(45000);
    fireEvent.click(screen.getByRole('switch', { name: 'Raid clock' }));
    expect(latest.kabaddiRules.raidLimitMs).toBeNull();
  });

  it('bonus point switch', () => {
    render(<Host />); openRules();
    fireEvent.click(screen.getByRole('switch', { name: 'Bonus point' }));
    expect(latest.kabaddiRules).toEqual(custom(quick, { bonus: { enabled: true, minDefenders: 5, eligibility: 'raidStart', beforeContact: true, points: 1, revives: false } }));
    fireEvent.click(screen.getByRole('switch', { name: 'Bonus point' }));
    expect(latest.kabaddiRules.bonus).toEqual({ enabled: false });
  });

  it('do-or-die switch and carry-over', () => {
    render(<Host />); openRules();
    fireEvent.click(screen.getByRole('switch', { name: 'Do-or-die after empty raids' }));
    expect(latest.kabaddiRules.doOrDie).toEqual({ emptyRaids: 2, onFailure: 'raiderOut', carryAcrossHalf: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Carry empty streak across halves' }));
    expect(latest.kabaddiRules.doOrDie.carryAcrossHalf).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: 'Do-or-die after empty raids' }));
    expect(latest.kabaddiRules.doOrDie).toBeNull();
  });

  it('player order switch brings in super tackle and all-out points, and switching off clears them', () => {
    render(<Host initial={{ kabaddiRules: standard }} />); openRules();
    expect(screen.getByRole('switch', { name: 'Super tackle' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('switch', { name: 'Physical tackles only' }));
    expect(latest.kabaddiRules.superTackle.outcomes).toBe('physicalTackle');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'All-out points' }), { target: { value: '3' } });
    expect(latest.kabaddiRules.outs.allOutPoints).toBe(3);
    fireEvent.click(screen.getByRole('switch', { name: 'Players go out and revive in order' }));
    expect(latest.kabaddiRules).toEqual(custom(latest.kabaddiRules, {}));
    expect(latest.kabaddiRules.strategy).toBe('pointsOnly');
    expect(latest.kabaddiRules.superTackle).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Super tackle' })).toBeNull();
  });

  it('keeps the plain-language disclosure and leaves the saved rules valid', () => {
    render(<Host />); openRules();
    expect(screen.getByText('How scoring ends')).toBeInTheDocument();
    expect(screen.getByText(/Targets resolve after the complete raid/)).toBeInTheDocument();
    expect(() => resolveKabaddiRules('custom', latest.kabaddiRules)).not.toThrow();
  });
});
