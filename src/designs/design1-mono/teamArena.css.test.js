import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM_COLOURS, deriveTeamColours, teamColourVars } from '../../lib/teamColour';

// Direction E contract: the Tailwind side of the team colour engine, and governance rule 7.
// Paths resolve from this file, not the cwd, so the test reads the same sources wherever it runs.
const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(join(here, '../../index.css'), 'utf8');
const governance = readFileSync(join(here, 'BLEND-GOVERNANCE.md'), 'utf8');

describe('team colour Tailwind tokens', () => {
  const theme = indexCss.slice(indexCss.indexOf('@theme inline'));

  it.each(['a', 'b'])('exposes team %s as Tailwind colours backed by the runtime variables', (side) => {
    expect(theme).toContain(`--color-team-${side}: var(--team-${side}-core)`);
    expect(theme).toContain(`--color-team-${side}-on: var(--team-${side}-on)`);
    expect(theme).toContain(`--color-team-${side}-tint: var(--team-${side}-tint)`);
    expect(theme).toContain(`--color-team-${side}-line: var(--team-${side}-line)`);
  });

  it('falls back on :root to the engine output for the default pair', () => {
    const vars = teamColourVars(deriveTeamColours(DEFAULT_TEAM_COLOURS.a, DEFAULT_TEAM_COLOURS.b));
    for (const [name, value] of Object.entries(vars)) expect(indexCss).toContain(`${name}: ${value};`);
  });
});

describe('governance rule 7', () => {
  it('makes team colour the identity on scoring and live surfaces', () => {
    expect(governance).toMatch(/7\.\s*\*\*Team colour = identity on scoring and live surfaces\.\*\*/);
    expect(governance).toMatch(/colour engine/i);
    expect(governance).toMatch(/lead\s+and\s+tie\s+are\s+not\s+colour-coded/i);
  });

  it('points rule 1 at the scoring exception', () => {
    const rule1 = governance.slice(governance.indexOf('1. **Green'), governance.indexOf('2. **Gold'));
    expect(rule1).toMatch(/§7/);
  });
});
