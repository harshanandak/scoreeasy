import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The HiFi-blend token layer is additive: it introduces rounded/soft/gold/live
// custom properties on top of the frozen brutalist Mono tokens. These contracts
// pin the token API (M1 foundation) so the 27 downstream screens can rely on it.
const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

describe('blend design tokens', () => {
  it('defines the rounded radius scale (capsule / circle / soft-card)', () => {
    expect(indexCss).toContain('--se-blend-radius-capsule: 999px');
    expect(indexCss).toContain('--se-blend-radius-circle: 50%');
    expect(indexCss).toContain('--se-blend-radius-soft:');
    expect(indexCss).toContain('--se-blend-radius-soft-sm:');
    expect(indexCss).toContain('--se-blend-radius-soft-lg:');
  });

  it('defines the soft green wash', () => {
    expect(indexCss).toContain('--se-blend-green-wash:');
  });

  it('defines the warm-green-black soft shadow and the colored CTA glow shadow', () => {
    expect(indexCss).toMatch(/--se-blend-shadow-soft:\s*[^;]*rgba\(\s*20/);
    expect(indexCss).toContain('--se-blend-shadow-cta:');
  });

  it('defines the gold milestone accent pair', () => {
    expect(indexCss).toContain('--se-blend-gold:');
    expect(indexCss).toContain('--se-blend-gold-bright:');
  });

  it('defines the LIVE breathing pulse keyframes and helper class', () => {
    expect(indexCss).toContain('@keyframes se-blend-pulse');
    expect(indexCss).toMatch(/\.se-blend-pulse\s*\{/);
  });

  it('gates the breathing pulse behind prefers-reduced-motion', () => {
    // The reduced-motion block must explicitly neutralize the pulse animation.
    expect(indexCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^]*?\.se-blend-pulse[^]*?animation:\s*none/,
    );
  });
});

describe('blend governance contract', () => {
  it('ships the BLEND-GOVERNANCE.md contract doc', () => {
    expect(
      existsSync(join(process.cwd(), 'src/designs/design1-mono/BLEND-GOVERNANCE.md')),
    ).toBe(true);
  });
});
