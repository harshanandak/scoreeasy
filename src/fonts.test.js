import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(resolve(path), 'utf8');

describe('bundled app fonts', () => {
  it('ships both Latin subsets of every brand face with local WOFF2 sources', () => {
    const css = postcss.parse(read('src/assets/fonts/fonts.css'));
    const faces = [];
    css.walkAtRules('font-face', rule => {
      const declarations = Object.fromEntries(rule.nodes.map(node => [node.prop, node.value]));
      faces.push(declarations);
      expect(declarations['font-display']).toBe('swap');
      const source = declarations.src.match(/^url\(\.\/([^)]*\.woff2)\) format\('woff2'\)$/);
      expect(source).not.toBeNull();
      expect(existsSync(resolve('src/assets/fonts', source[1]))).toBe(true);
      expect(declarations['unicode-range']).toMatch(/^U\+/);
    });
    for (const [family, weights] of [
      ['Figtree', ['400 900']],
      ['Bricolage Grotesque', ['700 800']],
      ['Barlow Condensed', ['700', '800']],
      ['JetBrains Mono', ['400 800']],
      ['Caveat', ['700']],
    ]) {
      for (const weight of weights) {
        const subsets = faces.filter(face => face['font-family'] === `'${family}'` && face['font-weight'] === weight);
        expect(subsets).toHaveLength(2);
        expect(subsets.some(face => face['unicode-range'].startsWith('U+0000-00FF'))).toBe(true);
        expect(subsets.some(face => face['unicode-range'].startsWith('U+0100-02BA'))).toBe(true);
      }
    }
    expect(faces).toHaveLength(12);
  });

  it('loads local fonts globally and uses Figtree for the boot screen', () => {
    const appCss = read('src/index.css');
    expect(appCss).toContain('@import "./assets/fonts/fonts.css";');
    expect(appCss + read('src/assets/fonts/fonts.css')).not.toMatch(/fonts\.googleapis\.com/i);
    expect(appCss).toContain('--font-serif: ui-serif, Georgia, serif;');
    const stacks = read('src/designs/design1-mono/theme/sportsTokens.js');
    expect(stacks).toContain('sans: "var(--font-sans)"');
    expect(stacks).toContain('serif: "var(--font-serif)"');
    const html = read('index.html');
    expect(html).not.toMatch(/\bInter\b/);
    expect(html).toMatch(/font-family: Figtree,/);
    for (const font of ['figtree-latin-400-900', 'bricolagegrotesque-latin-700-800']) {
      expect(html).toContain(`href="/src/assets/fonts/${font}.woff2" as="font" type="font/woff2" crossorigin`);
    }
  });
});
