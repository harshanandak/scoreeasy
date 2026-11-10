import { describe, expect, it } from 'vitest';
import { sportIdentity, sportIdentityVars } from './sportIdentity';
import { contrastReport } from './teamColour';
import { getSportsList } from '../models/sportRegistry';

// Plan 2026-10-22 §3: the engine output the approved prototype was measured on. Pinning it means a
// change to the engine or a source colour shows up here before it reaches a tile.
const PLAN_STOPS = {
  cricket: ['#2863e4', '#154ecd', '#122da5', 4.63],
  kabaddi: ['#ce276c', '#b6005a', '#87003c', 4.67],
  volleyball: ['#ffd170', '#fbbf24', '#e3b21f', 8.04],
  badminton: ['#7b4edc', '#6938c6', '#52159c', 4.67],
  football: ['#007c34', '#00662a', '#004720', 4.71],
  basketball: ['#ff9a64', '#ff8136', '#ec730f', 5.39],
  tennis: ['#d5f750', '#c6e83d', '#b0d841', 9.5],
  tabletennis: ['#007a70', '#00655c', '#004642', 4.61],
  hockey: ['#60cbff', '#38bdf8', '#39abe5', 6.17],
};

describe('sport identities', () => {
  it('gives every registered sport an identity', () => {
    for (const sport of getSportsList()) expect(sportIdentity(sport.id), sport.id).not.toBeNull();
    expect(Object.keys(PLAN_STOPS).sort()).toEqual(getSportsList().map((s) => s.id).sort());
  });

  it.each(Object.entries(PLAN_STOPS))('%s matches the plan stops', (id, [hi, core, lo]) => {
    const t = sportIdentity(id);
    expect([t.hi, t.core, t.lo]).toEqual([hi, core, lo]);
  });

  // Every tile label (sport name and its hint line) is measured on every gradient stop, the sheen
  // and the mark overlay, through the same contrastReport the scorer keys use.
  it.each(Object.keys(PLAN_STOPS))('%s tile label clears 4.5:1 on every surface', (id) => {
    const rows = contrastReport({ [id]: sportIdentity(id) });
    const labelRows = rows.filter(([label]) => label.includes('label on'));
    expect(labelRows).toHaveLength(8);
    for (const [label, ratio] of labelRows) expect(ratio, `${label} ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    const worst = Math.min(...labelRows.map(([, ratio]) => ratio));
    expect(worst).toBeCloseTo(PLAN_STOPS[id][3], 1);
    for (const [label, ratio, min] of rows) expect(ratio, label).toBeGreaterThanOrEqual(min);
  });

  it('exposes engine output and the mark as css vars, and nothing for unknown sports', () => {
    const vars = sportIdentityVars('cricket');
    expect(vars['--sport-core']).toBe('#154ecd');
    expect(vars['--sport-on']).toBe('#ffffff');
    expect(vars['--sport-motif']).toMatch(/^rgba\(/);
    expect(vars['--sport-mark']).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(sportIdentityVars('not-a-sport')).toEqual({});
    expect(sportIdentityVars('toString')).toEqual({});
  });
});
