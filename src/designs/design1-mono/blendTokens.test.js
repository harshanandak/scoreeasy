import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// `?inline` runs src/index.css through the project's real Vite CSS pipeline
// (the @tailwindcss/vite plugin from vite.config.js + postcss.config.js) and
// hands back the compiled CSS string, built from the sources under test.
import compiledIndexCss from '../../index.css?inline';

// The HiFi-blend token layer is additive: it introduces rounded/soft/gold/live
// custom properties on top of the frozen brutalist Mono tokens. These contracts
// pin the token API (M1 foundation) so the 27 downstream screens can rely on it.
const root = process.cwd();
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8');

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

// Tailwind v4 copies `:root` custom properties through verbatim (they are not
// tree-shaken/purged like utility classes). Prove that against a compile of the
// CURRENT sources rather than whatever happens to sit in dist/: an untracked
// dist/ can be left over from another branch's build, or be half-written by a
// concurrent `vite build`, which made this contract flaky.
describe('blend tokens survive the Tailwind/PostCSS pipeline', () => {
  it('actually ran the Tailwind compiler (not a raw passthrough)', () => {
    expect(compiledIndexCss).not.toContain('@import "tailwindcss"');
    expect(compiledIndexCss).toMatch(/tailwindcss v\d/);
  });

  it.each(FROZEN_TOKENS)('keeps the exact frozen value through the pipeline: %s', (decl) => {
    expect(compiledIndexCss).toContain(decl);
  });

  it('keeps the LIVE breathing pulse keyframes through the pipeline', () => {
    expect(compiledIndexCss).toContain('@keyframes se-blend-pulse');
    expect(compiledIndexCss).toMatch(/\.se-blend-pulse\s*\{[^}]*animation:\s*se-blend-pulse/);
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
