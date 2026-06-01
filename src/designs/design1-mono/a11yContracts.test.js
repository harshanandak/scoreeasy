import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mono accessibility contracts', () => {
  it('keeps a visible focus indicator for all common interactive controls', () => {
    const css = readFileSync(join(process.cwd(), 'src/designs/design1-mono/mono.css'), 'utf8');

    expect(css).toContain(':where(button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])):focus-visible');
    expect(css).toContain('outline: 3px solid var(--se-color-focus-ring');
  });

  it('keeps scorer headings safe when sport config is unavailable', () => {
    const scorerFiles = [
      'src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx',
      'src/designs/design1-mono/scoring/MonoCricketTestLiveScore.jsx',
      'src/designs/design1-mono/scoring/MonoGoalsLiveScore.jsx',
      'src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx',
      'src/designs/design1-mono/scoring/MonoTennisLiveScore.jsx',
    ];

    for (const scorerFile of scorerFiles) {
      const source = readFileSync(join(process.cwd(), scorerFile), 'utf8');
      expect(source).toMatch(/sportConfig\?\.name\s*\|\|\s*['"]Sport['"]}\s*match scorer/);
    }
  });
});
