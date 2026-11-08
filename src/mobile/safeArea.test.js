import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config';

const read = path => readFileSync(resolve(path), 'utf8');

describe('shared safe viewport', () => {
  it('accepts Capacitor CSS insets with browser environment fallbacks on all four edges', () => {
    const css = postcss.parse(read('src/mobile/safeArea.css'));
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      const declarations = [];
      css.walkDecls(`--se-safe-${edge}`, decl => declarations.push(decl.value));
      expect(declarations).toEqual([`var(--safe-area-inset-${edge}, env(safe-area-inset-${edge}, 0px))`]);
    }
    expect(config.plugins.SystemBars.insetsHandling).toBe('css');
  });

  it('protects the shared shell around navigation and every route, with no per-route opt-in', () => {
    const routes = read('src/designs/design1-mono/index.jsx');
    expect(routes).toContain('className="se-app-shell min-h-screen font-swiss"');
    const css = postcss.parse(read('src/mobile/safeArea.css'));
    const shell = css.nodes.find(node => node.selector === '.se-app-shell');
    expect(shell.nodes.find(node => node.prop === 'padding').value)
      .toBe('var(--se-safe-top) var(--se-safe-right) 0 var(--se-safe-left)');
    expect(read('src/index.css')).toContain('@import "./mobile/safeArea.css"');
  });

  it('keeps board height inside the padded viewport and avoids adding the top inset twice', () => {
    const shell = read('src/designs/design1-mono/scoring/boardShell.css');
    expect(shell).toContain('min-height: calc(100dvh - var(--se-safe-top))');
    expect(shell).toContain('padding: 14px 16px 6px 18px');
    expect(shell).not.toContain('env(safe-area-inset-');
    expect(read('src/designs/design1-mono/scoring/goalsBoard.css')).toContain('padding-top: 10px');
  });

  it('bounds portal and full-height sheet surfaces below the cutout', () => {
    const css = read('src/designs/design1-mono/mono.css');
    expect(css).toContain('padding: max(20px, var(--se-safe-top))');
    expect(css).toContain('max-height: min(88vh, 720px, calc(100dvh - var(--se-safe-top)))');
    expect(read('src/designs/design1-mono/kit/sharelive.css'))
      .toContain('max-height: calc(100dvh - var(--se-safe-top))');
  });
});
