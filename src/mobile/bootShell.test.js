import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('native boot shell', () => {
  it('renders visible loading UI before React mounts', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).toContain('<div id="root">');
    expect(html).toContain('<output class="boot-shell"');
    expect(html).toContain('Loading Score Easy');
  });
});
