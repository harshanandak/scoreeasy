import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('native app link configuration', () => {
  it('configures iOS associated domains for Score Easy app links', () => {
    const entitlements = readFileSync(join(repoRoot, 'ios/App/App/App.entitlements'), 'utf8');
    const project = readFileSync(join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');

    expect(entitlements).toContain('com.apple.developer.associated-domains');
    expect(entitlements).toContain('applinks:scoreeasy.app');
    expect(project).toContain('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;');
  });
});
