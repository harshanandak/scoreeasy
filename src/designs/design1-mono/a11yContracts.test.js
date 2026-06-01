import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mono accessibility contracts', () => {
  it('keeps a visible focus indicator for all common interactive controls', () => {
    const css = readFileSync(join(process.cwd(), 'src/designs/design1-mono/mono.css'), 'utf8');

    expect(css).toContain(':where(button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])):focus-visible');
    expect(css).toContain('outline: 3px solid var(--se-color-focus-ring');
  });

  it('keeps cricket scorer headings safe when sport config is unavailable', () => {
    const liveScorer = readFileSync(join(process.cwd(), 'src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx'), 'utf8');
    const testScorer = readFileSync(join(process.cwd(), 'src/designs/design1-mono/scoring/MonoCricketTestLiveScore.jsx'), 'utf8');

    expect(liveScorer).toContain("{sportConfig?.name || 'Sport'} match scorer");
    expect(testScorer).toContain("{sportConfig?.name || 'Sport'} match scorer");
  });
});
