import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The HiFi-blend token layer is additive: it introduces rounded/soft/gold/live
// custom properties on top of the frozen brutalist Mono tokens. These contracts
// pin the token API (M1 foundation) so the 27 downstream screens can rely on it.
const root = process.cwd();
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8');

// Locate the compiled stylesheet emitted by `vite build`, if a build is present.
// Tailwind v4 copies `:root` custom properties through verbatim (they are not
// tree-shaken/purged like utility classes), so the authored source is the
// primary contract — but when dist/ exists we additionally assert the tokens
// survived the real build, catching any future purge/rewrite regression.
function readBuiltCss() {
  const assetsDir = join(root, 'dist', 'assets');
  if (!existsSync(assetsDir)) return null;
  const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
  if (cssFiles.length === 0) return null;
  return cssFiles.map((f) => readFileSync(join(assetsDir, f), 'utf8')).join('\n');
}
const builtCss = readBuiltCss();

// Extract the body of a specific brace-delimited block (e.g. an @media rule) by
// walking braces from the header, so assertions can't leak across rule
// boundaries. Returns the inner text between the block's matching braces.
function extractBlock(css, header) {
  const start = css.indexOf(header);
  if (start === -1) return null;
  const open = css.indexOf('{', start);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

// The frozen token API: exact declarations that downstream screens depend on.
// Pinning the VALUES (not just names) locks the API against silent regressions.
const FROZEN_TOKENS = [
  '--se-blend-radius-capsule: 999px',
  '--se-blend-radius-circle: 50%',
  '--se-blend-radius-soft-sm: 10px',
  '--se-blend-radius-soft: 12px',
  '--se-blend-radius-soft-lg: 16px',
  '--se-blend-green-wash: #e7f4ee',
  '--se-blend-green-wash-strong: #d6ecdf',
  '--se-blend-shadow-soft: 0 6px 20px -8px rgba(20, 40, 30, 0.28)',
  '--se-blend-shadow-cta: 0 8px 24px -6px rgba(35, 120, 75, 0.42)',
  '--se-blend-gold: #b8862e',
  '--se-blend-gold-bright: #e8b64c',
  '--se-blend-pulse-duration: 2.4s',
];

describe('blend design tokens (frozen values)', () => {
  it.each(FROZEN_TOKENS)('declares the exact frozen value: %s', (decl) => {
    expect(indexCss).toContain(decl);
  });

  it('defines the LIVE breathing pulse keyframes and helper class', () => {
    expect(indexCss).toContain('@keyframes se-blend-pulse');
    expect(indexCss).toMatch(/\.se-blend-pulse\s*\{[^}]*animation:\s*se-blend-pulse/);
  });

  it('gates the breathing pulse behind prefers-reduced-motion (brace-scoped)', () => {
    // Isolate the reduced-motion media block, then assert the override lives
    // INSIDE it — so an unrelated `.se-blend-pulse`/`animation: none` elsewhere
    // in the stylesheet can't satisfy the contract.
    const block = extractBlock(indexCss, '@media (prefers-reduced-motion: reduce)');
    expect(block).not.toBeNull();
    expect(block).toMatch(/\.se-blend-pulse\s*\{\s*animation:\s*none/);
  });
});

describe('blend tokens survive the production build', () => {
  it('keeps every frozen token in the compiled stylesheet when a build exists', () => {
    if (!builtCss) {
      // No dist/ build present in this run — source assertions above are the
      // contract; the CI `build` gate exercises the compiled path separately.
      expect(existsSync(join(root, 'src/index.css'))).toBe(true);
      return;
    }
    // The build minifies values (e.g. rgba(20,40,30,.28) -> #14281e47), so the
    // exact-value contract is enforced at source above; here we prove the build
    // did not DROP or rename any token declaration.
    for (const decl of FROZEN_TOKENS) {
      const name = decl.split(':')[0];
      expect(builtCss).toMatch(new RegExp(`${name}\\s*:`));
    }
    expect(builtCss).toContain('se-blend-pulse');
  });
});

describe('blend governance contract', () => {
  const govPath = join(root, 'src/designs/design1-mono/BLEND-GOVERNANCE.md');

  it('ships the BLEND-GOVERNANCE.md contract doc', () => {
    expect(existsSync(govPath)).toBe(true);
  });

  it('documents all six governance rules (not just an empty file)', () => {
    const gov = readFileSync(govPath, 'utf8');
    // Each of the six rules the downstream screens reference must be present.
    expect(gov).toMatch(/green\s*=\s*lead\s*\/\s*live only/i); // §1
    expect(gov).toMatch(/gold\s*=\s*one milestone accent per screen/i); // §2
    expect(gov).toMatch(/capsules?\s*&?\s*circles?\s*=\s*interactive elements only/i); // §3
    expect(gov).toMatch(/hard shell\s*\/\s*soft content/i); // §4
    expect(gov).toMatch(/breathing pulse\s*=\s*live-state only.*reduced-motion gated/i); // §5
    expect(gov).toMatch(/per-screen soft-element budget/i); // §6
  });
});
