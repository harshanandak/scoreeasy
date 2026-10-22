// Kit modal skin (plan 2026-10-22 §4, F0) for every app modal surface and confirm UI: the app
// confirm dialogs (AppConfirmDialog in index.jsx, ConfirmDialog in MonoQuickMatch.jsx,
// AppScoringConfirmDialog), MonoSheet and the inline ConfirmActionPanel. A hairline-and-lift
// container, Mono-strength buttons, and a danger fill for anything destructive.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmActionPanel from './ConfirmActionPanel';

const monoCss = readFileSync(`${import.meta.dirname}/../mono.css`, 'utf8');
const indexCss = readFileSync(`${import.meta.dirname}/../../../index.css`, 'utf8');
const indexSource = readFileSync(`${import.meta.dirname}/../index.jsx`, 'utf8');
const panelSource = readFileSync(`${import.meta.dirname}/ConfirmActionPanel.jsx`, 'utf8');
const quickMatchSource = readFileSync(`${import.meta.dirname}/../MonoQuickMatch.jsx`, 'utf8');

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

describe('modal tokens', () => {
  it('uses the app-wide Kit tokens; mono.css defines no modal tokens of its own', () => {
    expect(rules.filter((rule) => rule.selector === ':root')).toHaveLength(0);
    for (const token of ['--se-color-scrim', '--se-color-shadow', '--se-modal-lift', '--se-ctl-shadow', '--se-ctl-shadow-press']) {
      expect(indexCss, token).toContain(`${token}:`);
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

describe('app confirm dialog skin', () => {
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

  it('frames the dialog with a hairline and a soft lift, never a hard shell', () => {
    expect(declared('.app-confirm-dialog', 'background')).toBe('var(--se-color-surface)');
    expect(declared('.app-confirm-dialog', 'border')).toBe('1px solid var(--se-color-line-soft)');
    expect(declared('.app-confirm-dialog', 'border-radius')).toBe('24px');
    expect(declared('.app-confirm-dialog', 'box-shadow')).toBe('var(--se-modal-lift)');
    for (const rule of rules.filter((r) => r.selectors.includes('.app-confirm-dialog'))) {
      if (rule.declarations['box-shadow']) expect(rule.declarations['box-shadow']).toBe('var(--se-modal-lift)');
    }
  });

  it('sets the overline in sentence case and the title in the display face', () => {
    expect(declared('.app-confirm-eyebrow', 'color')).toBe('var(--se-color-ink-soft)');
    expect(declared('.app-confirm-eyebrow', 'text-transform')).toBeUndefined();
    expect(declared('.app-confirm-title', 'color')).toBe('var(--se-color-ink)');
    expect(declared('.app-confirm-title', 'font-family')).toBe('var(--se-font-display)');
  });

  it('fills a commit in ink, a destructive confirm in danger and Cancel in the control surface', () => {
    expect(declared('.app-confirm-primary', 'background')).toBe('var(--se-color-ink)');
    expect(declared('.app-confirm-primary', 'color')).toBe('var(--se-color-on-ink)');
    expect(declared('.app-confirm-danger', 'background')).toBe('var(--se-color-danger)');
    expect(declared('.app-confirm-danger', 'color')).toBe('var(--se-color-on-ink)');
    expect(declared('.app-confirm-secondary', 'background')).toBe('var(--se-ctl-bg)');
    expect(declared('.app-confirm-secondary', 'color')).toBe('var(--se-color-ink)');
  });

  it('marks the quick-match Discard confirm as destructive through its tone, not its id', () => {
    expect(topLevel('.app-confirm-danger')[0].selectors).not.toContainEqual(expect.stringContaining('aria-labelledby'));
    expect(quickMatchSource).toMatch(/idPrefix="discard-match"\s+tone="danger"/);
  });

  it('gives every button a thumb-sized Mono-strength key with a pressed state', () => {
    for (const prefix of ['.app-confirm', '.mono-sheet']) {
      const base = `${prefix}-primary`;
      expect(declared(base, 'border'), base).toBe('var(--se-ctl-border) solid var(--se-color-ink)');
      expect(declared(base, 'border-radius'), base).toBe('var(--se-ctl-radius)');
      expect(declared(base, 'box-shadow'), base).toBe('var(--se-ctl-shadow)');
      expect(Number.parseInt(declared(base, 'min-height'), 10), base).toBeGreaterThanOrEqual(52);
      expect(topLevel(`${prefix}-secondary`)[0].selectors, prefix).toContain(base);
      const pressed = topLevel(`${base}:active`)[0];
      expect(pressed?.declarations, prefix).toMatchObject({
        transform: 'translate(2px, 2px)',
        'box-shadow': 'var(--se-ctl-shadow-press)',
      });
    }
    for (const rule of modalRules) {
      const minHeight = rule.declarations['min-height'];
      if (minHeight) expect(Number.parseInt(minHeight, 10), rule.selector).toBeGreaterThanOrEqual(48);
    }
  });
});

describe('MonoSheet skin', () => {
  it('sits on the bottom edge as a lifted surface with no hard frame', () => {
    expect(declared('.mono-sheet', 'border')).toBe('0');
    expect(declared('.mono-sheet', 'background')).toBe('var(--se-color-surface)');
    expect(declared('.mono-sheet', 'box-shadow')).toMatch(/var\(--se-color-shadow\)/);
  });

  it('shares the dialog button set', () => {
    expect(declared('.mono-sheet-primary', 'background')).toBe('var(--se-color-ink)');
    expect(declared('.mono-sheet-danger', 'background')).toBe('var(--se-color-danger)');
    expect(declared('.mono-sheet-secondary', 'background')).toBe('var(--se-ctl-bg)');
  });
});

describe('ConfirmActionPanel', () => {
  it('renders the inline destructive confirm in the Kit skin', () => {
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

    expect(declared('.app-confirm-panel', 'border')).toBe('1px solid var(--se-color-line-soft)');
    expect(declared('.app-confirm-panel', 'background')).toBe('var(--se-color-surface)');
    expect(declared('.app-confirm-panel', 'box-shadow')).toBe('var(--se-lift)');
  });
});
