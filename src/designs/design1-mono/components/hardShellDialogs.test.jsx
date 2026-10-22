// Hard-shell contract for every app modal surface and confirm UI: the app
// confirm dialogs (AppConfirmDialog in index.jsx, ConfirmDialog in
// MonoQuickMatch.jsx, AppScoringConfirmDialog), MonoSheet and the inline
// ConfirmActionPanel. Values come from the colour audit
// (docs/plans/2026-10-21-colour-system-audit.md §6.1 and §6.4, migration PR 6).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmActionPanel from './ConfirmActionPanel';

const monoCss = readFileSync(`${import.meta.dirname}/../mono.css`, 'utf8');
const indexSource = readFileSync(`${import.meta.dirname}/../index.jsx`, 'utf8');
const panelSource = readFileSync(`${import.meta.dirname}/ConfirmActionPanel.jsx`, 'utf8');

const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/i;

// Minimal CSS reader: every rule with its selector list, declarations and the
// at-rule it sits in (if any). Good enough for mono.css, which has no nesting
// beyond one level of @media.
function parseRules(css) {
  const rules = [];
  const stack = [];
  let buffer = '';
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (char === '}') {
      const selector = stack.pop();
      const declarations = Object.fromEntries(
        buffer
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part.includes(':'))
          .map((part) => {
            const colon = part.indexOf(':');
            return [part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' ')];
          }),
      );
      rules.push({ selector, selectors: selector.split(',').map((s) => s.trim()), declarations, within: stack.at(-1) ?? null });
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return rules;
}

const rules = parseRules(monoCss);
const topLevel = (selector) => rules.filter((rule) => rule.within === null && rule.selectors.includes(selector));
const declared = (selector, property) => {
  const values = topLevel(selector).map((rule) => rule.declarations[property]).filter(Boolean);
  return values.at(-1);
};
const modalRules = rules.filter((rule) => /\.app-confirm|\.mono-sheet/.test(rule.selector));

describe('hard-shell modal tokens', () => {
  const rootBlocks = rules.filter((rule) => rule.selector === ':root');
  const tokens = Object.assign({}, ...rootBlocks.map((rule) => rule.declarations));

  it('defines the audit values once, in one :root block in mono.css that points at the audit', () => {
    expect(rootBlocks).toHaveLength(1);
    expect(tokens).toMatchObject({
      '--se-color-scrim': 'rgba(11, 11, 13, 0.45)',
      '--se-modal-surface': '#ffffff',
      '--se-modal-danger': '#b42318',
      '--se-modal-border': '2px',
      '--se-modal-radius': '14px',
      '--se-modal-button-radius': '10px',
      '--se-shadow-hard-ink': '3px 3px 0 var(--se-color-ink)',
      '--se-shadow-hard-lg': '4px 4px 0 var(--se-color-ink)',
      '--se-shadow-press': '1px 1px 0 var(--se-color-ink)',
    });
    expect(monoCss).toContain('docs/plans/2026-10-21-colour-system-audit.md');
    for (const token of Object.keys(tokens)) {
      expect(indexSource).not.toContain(`${token}:`);
    }
  });

  it('keeps every modal and confirm rule on tokens — no raw colour literals', () => {
    expect(modalRules.length).toBeGreaterThan(10);
    for (const rule of modalRules) {
      expect(Object.values(rule.declarations).join(';'), rule.selector).not.toMatch(RAW_COLOUR);
    }
    expect(panelSource).not.toMatch(RAW_COLOUR);
    expect(panelSource).not.toContain('style=');
  });

  it('never paints a dialog or sheet in app green (green means go/live only)', () => {
    for (const rule of modalRules) {
      expect(Object.values(rule.declarations).join(';'), rule.selector).not.toContain('--se-color-action');
    }
  });
});

describe('app confirm dialog shell', () => {
  it('lives in mono.css, not in the inline <style> of index.jsx', () => {
    expect(indexSource).not.toMatch(/\.app-confirm-[\w-]+\s*[,{]/);
    expect(topLevel('.app-confirm-dialog')).toHaveLength(1);
  });

  it('uses one unblurred scrim for every modal backdrop', () => {
    for (const selector of ['.app-confirm-backdrop', '.mono-sheet-backdrop']) {
      expect(declared(selector, 'background'), selector).toBe('var(--se-color-scrim)');
    }
    for (const rule of modalRules) {
      expect(rule.declarations, rule.selector).not.toHaveProperty('backdrop-filter');
      expect(rule.declarations, rule.selector).not.toHaveProperty('-webkit-backdrop-filter');
    }
  });

  it('frames the panel as a hard shell: white surface, 2px ink border, 14px radius, solid 4px ink shadow', () => {
    expect(declared('.app-confirm-dialog', 'background')).toBe('var(--se-modal-surface)');
    expect(declared('.app-confirm-dialog', 'border')).toBe('var(--se-modal-border) solid var(--se-color-ink)');
    expect(declared('.app-confirm-dialog', 'border-radius')).toBe('var(--se-modal-radius)');
    expect(declared('.app-confirm-dialog', 'box-shadow')).toBe('var(--se-shadow-hard-lg)');
    // No breakpoint swaps the shell back to a softer shadow.
    for (const rule of rules.filter((r) => r.selectors.includes('.app-confirm-dialog'))) {
      if (rule.declarations['box-shadow']) expect(rule.declarations['box-shadow']).toBe('var(--se-shadow-hard-lg)');
    }
  });

  it('sets the overline in ink, never green', () => {
    expect(declared('.app-confirm-eyebrow', 'color')).toBe('var(--se-color-ink-soft)');
    expect(declared('.app-confirm-title', 'color')).toBe('var(--se-color-ink)');
  });

  it('fills a neutral commit in ink, a destructive confirm in danger red and Cancel in white', () => {
    expect(declared('.app-confirm-primary', 'background')).toBe('var(--se-color-ink)');
    expect(declared('.app-confirm-primary', 'color')).toBe('var(--se-color-inverse)');
    expect(declared('.app-confirm-danger', 'background')).toBe('var(--se-modal-danger)');
    expect(declared('.app-confirm-danger', 'color')).toBe('var(--se-color-inverse)');
    expect(declared('.app-confirm-secondary', 'background')).toBe('var(--se-modal-surface)');
    expect(declared('.app-confirm-secondary', 'color')).toBe('var(--se-color-ink)');
  });

  it('marks the quick-match Discard confirm as destructive until it can pass tone="danger"', () => {
    // MonoQuickMatch.jsx's ConfirmDialog has no tone prop; its Discard instance is
    // identified by its idPrefix (pinned in MonoQuickMatch.hardening.test.jsx).
    const danger = topLevel('.app-confirm-danger')[0];
    expect(danger.selectors).toContain('.app-confirm-dialog[aria-labelledby="discard-match-title"] .app-confirm-primary');
  });

  it('gives every button a thumb-sized hard key with a pressed state', () => {
    for (const prefix of ['.app-confirm', '.mono-sheet']) {
      const base = `${prefix}-primary`;
      expect(declared(base, 'border'), base).toBe('var(--se-modal-border) solid var(--se-color-ink)');
      expect(declared(base, 'border-radius'), base).toBe('var(--se-modal-button-radius)');
      expect(declared(base, 'box-shadow'), base).toBe('var(--se-shadow-hard-ink)');
      expect(Number.parseInt(declared(base, 'min-height'), 10), base).toBeGreaterThanOrEqual(52);
      expect(topLevel(`${prefix}-secondary`)[0].selectors, prefix).toContain(base);
      const pressed = topLevel(`${base}:active`)[0];
      expect(pressed?.declarations, prefix).toMatchObject({
        transform: 'translate(2px, 2px)',
        'box-shadow': 'var(--se-shadow-press)',
      });
    }
    for (const rule of modalRules) {
      const minHeight = rule.declarations['min-height'];
      if (minHeight) expect(Number.parseInt(minHeight, 10), rule.selector).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('MonoSheet shell', () => {
  it('sits on the bottom edge: 2px ink border with no bottom edge, white surface, no shadow', () => {
    expect(declared('.mono-sheet', 'border')).toBe('var(--se-modal-border) solid var(--se-color-ink)');
    expect(declared('.mono-sheet', 'border-bottom')).toBe('0');
    expect(declared('.mono-sheet', 'background')).toBe('var(--se-modal-surface)');
    expect(declared('.mono-sheet', 'box-shadow')).toBe('none');
  });

  it('shares the dialog button set', () => {
    expect(declared('.mono-sheet-primary', 'background')).toBe('var(--se-color-ink)');
    expect(declared('.mono-sheet-danger', 'background')).toBe('var(--se-modal-danger)');
    expect(declared('.mono-sheet-secondary', 'background')).toBe('var(--se-modal-surface)');
  });
});

describe('ConfirmActionPanel', () => {
  it('renders the inline destructive confirm in the hard-shell language', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmActionPanel
        message="Clear the saved score for Match 1?"
        confirmLabel="Clear score"
        confirmAriaLabel="Confirm clear score for Match 1"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const panel = screen.getByRole('alert');
    expect(panel).toHaveClass('app-confirm-panel');
    expect(panel).not.toHaveAttribute('style');
    const confirm = screen.getByRole('button', { name: 'Confirm clear score for Match 1' });
    expect(confirm).toHaveClass('app-confirm-primary', 'app-confirm-danger');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveClass('app-confirm-secondary');

    fireEvent.click(confirm);
    fireEvent.click(cancel);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    expect(declared('.app-confirm-panel', 'border')).toBe('var(--se-modal-border) solid var(--se-color-ink)');
    expect(declared('.app-confirm-panel', 'background')).toBe('var(--se-modal-surface)');
  });
});
