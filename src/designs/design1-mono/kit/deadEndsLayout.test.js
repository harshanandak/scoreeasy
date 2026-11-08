import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// jsdom has no layout, so these read the shipped stylesheets and components the way the
// teamArena contract test does. They pin the 360 px setup fixes and the breadcrumb hit areas.
const root = join(import.meta.dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The declaration block of the rule whose selector list is exactly `selector`. */
function rule(css, selector) {
  let from = 0;
  while (from < css.length) {
    const open = css.indexOf('{', from);
    if (open === -1) return null;
    const close = css.indexOf('}', open);
    const head = css.slice(from, open).split('}').pop().trim();
    if (head === selector) return css.slice(open + 1, close);
    from = close + 1;
  }
  return null;
}

describe('360 px quick setup', () => {
  const css = stripComments(read('kit/setup.css'));

  it('wraps the title between words and never inside one', () => {
    const block = rule(css, '.kit-setup-title h1');
    expect(block).not.toBeNull();
    expect(block).not.toMatch(/overflow-wrap:\s*anywhere/);
    expect(block).not.toMatch(/word-break:\s*(break-all|break-word)/);
    expect(block).toMatch(/font-size:\s*clamp\(/);
  });

  it('keeps focused controls clear of the sticky Start bar and the dock', () => {
    const block = rule(css, 'html:has(.kit-setup)');
    expect(block).not.toBeNull();
    expect(block).toMatch(/scroll-padding-bottom:\s*calc\(/);
  });
});

describe('tournament breadcrumb hit areas', () => {
  const css = stripComments(read('mono.css'));

  it('gives the crumb a 44 px hit area and cancels the extra height so the look is unchanged', () => {
    const crumb = rule(css, '.mono-hit');
    expect(crumb).toMatch(/min-height:\s*44px/);
    expect(crumb).toMatch(/margin-block:\s*-12px/);
    expect(crumb).toMatch(/padding-inline:\s*3px/);
    expect(crumb).toMatch(/margin-inline:\s*-3px/);
    const back = rule(css, '.mono-hit-back');
    expect(back).toMatch(/min-height:\s*44px/);
    expect(back).toMatch(/margin:\s*-12px 0 12px/);
  });

  it.each([
    ['MonoSetup.jsx', 'mono-hit'],
    ['MonoTournamentList.jsx', 'mono-hit'],
    ['MonoTournamentSetup.jsx', 'mono-hit'],
    ['GenericSetsTournament.jsx', 'mono-hit-back'],
    ['GenericGoalsTournament.jsx', 'mono-hit-back'],
    ['MonoCricketTournament.jsx', 'mono-hit-back'],
  ])('%s uses %s on its breadcrumb or back button', (file, cls) => {
    const source = read(file);
    const nav = source.includes('aria-label="Breadcrumb"')
      ? source.slice(source.indexOf('aria-label="Breadcrumb"'))
      : source.slice(source.indexOf('{/* Back */}'));
    const button = nav.slice(0, nav.indexOf('</button>'));
    expect(button).toContain(cls);
  });
});
