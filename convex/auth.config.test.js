import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Convex Clerk auth config', () => {
  it('uses the Clerk JWT issuer domain with the Convex audience', () => {
    const source = readFileSync(join(process.cwd(), 'convex/auth.config.ts'), 'utf8');

    expect(source).toContain('CLERK_JWT_ISSUER_DOMAIN');
    expect(source).toContain('https://clerk.scoreeasy.app');
    expect(source).toContain('applicationID: "convex"');
  });
});
