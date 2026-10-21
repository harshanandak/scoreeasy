import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM_COLOURS, deriveTeamColours, teamColourVars } from '../../lib/teamColour';

// Direction E arena contract: the stylesheet side of the team colour engine.
// Paths resolve from this file, not the cwd, so the test reads the same sources wherever it runs.
const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(join(here, '../../index.css'), 'utf8');
const monoCss = readFileSync(join(here, 'mono.css'), 'utf8');
const governance = readFileSync(join(here, 'BLEND-GOVERNANCE.md'), 'utf8');

// Body of the first rule whose selector list contains `selector` exactly.
function ruleBody(css, selector) {
  const re = new RegExp(`(^|[},])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,{]`, 'm');
  const m = re.exec(css);
  if (!m) return null;
  const open = css.indexOf('{', m.index + m[0].length - 1);
  return css.slice(open + 1, css.indexOf('}', open));
}

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

describe('Direction E arena styles', () => {
  const scoped = '.mono-arena-grid[data-team-colour]';

  it('keeps the hard brutalist shell on the grid (governance §4)', () => {
    const shell = ruleBody(monoCss, scoped);
    expect(shell).toMatch(/border:\s*var\(--se-border-standard\) solid var\(--se-color-line\)/);
    expect(shell).toMatch(/box-shadow:\s*var\(--se-shadow-hard\)/);
  });

  it.each(['a', 'b'])('maps team %s onto the column it owns', (side) => {
    const col = ruleBody(monoCss, `${scoped} .mono-arena-col[data-team="${side}"]`);
    for (const key of ['hi', 'core', 'lo', 'on', 'scrim', 'tint', 'motif']) {
      expect(col).toContain(`var(--team-${side}-${key})`);
    }
    expect(col).toContain(`var(--sport-motif-${side}`);
  });

  it('fills each column with its team gradient and on-colour text', () => {
    const col = ruleBody(monoCss, `${scoped} .mono-arena-col`);
    expect(col).toMatch(/linear-gradient\([^)]*var\(--tc-hi\)[^)]*var\(--tc-core\)[^)]*var\(--tc-lo\)/);
    expect(col).toMatch(/color:\s*var\(--tc-on\)/);
    for (const part of ['.mono-arena-overline', '.mono-arena-num', '.mono-arena-hint', '.mono-correct']) {
      expect(ruleBody(monoCss, `${scoped} ${part}`), part).toMatch(/color:\s*var\(--tc-on\)/);
    }
  });

  it('puts the numeral on a scrim and the court drawing behind the content', () => {
    expect(ruleBody(monoCss, `${scoped} .mono-arena-num::before`)).toContain('var(--tc-scrim)');
    const motif = ruleBody(monoCss, `${scoped} .mono-arena-motif`);
    expect(motif).toMatch(/background:\s*var\(--tc-motif\)/);
    expect(motif).toMatch(/mask-image:\s*var\(--tc-mask\)/);
    expect(motif).toMatch(/pointer-events:\s*none/);
  });

  it('does not colour the lead: the leading baseline stays transparent', () => {
    expect(ruleBody(monoCss, `${scoped} .mono-arena-half[data-leading="true"] .mono-arena-num::after`)).toMatch(
      /background:\s*transparent/,
    );
  });

  it('gives quick-score buttons the team tint with ink text', () => {
    const btn = ruleBody(monoCss, `${scoped} .mono-arena-col .mono-btn`);
    expect(btn).toMatch(/background:\s*var\(--tc-tint\)/);
    expect(btn).toMatch(/color:\s*var\(--se-color-ink\)/);
  });

  it('gives press feedback without moving the tap target', () => {
    const active = ruleBody(monoCss, `${scoped} .mono-arena-half:active`);
    expect(active).not.toBeNull();
    expect(active).not.toMatch(/transform/);
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
