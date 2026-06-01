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
    const entitlementLinks = project.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) ?? [];
    expect(entitlementLinks).toHaveLength(2);
  });

  it('documents deployment-owned association assets for the declared app-link host', () => {
    const runbook = readFileSync(join(repoRoot, 'docs/mobile/app-link-associations.md'), 'utf8');

    expect(runbook).toContain('https://scoreeasy.app/.well-known/assetlinks.json');
    expect(runbook).toContain('https://scoreeasy.app/.well-known/apple-app-site-association');
    expect(runbook).toContain('Android package: `com.scoreeasy.app`');
    expect(runbook).toContain('iOS bundle identifier: `com.scoreeasy.app`');
    expect(runbook).toContain('Do not commit placeholder fingerprints or Team IDs');
  });
});
