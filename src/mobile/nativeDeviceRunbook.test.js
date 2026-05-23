import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('native device verification runbook', () => {
  it('covers Android and iOS installed-app evidence requirements', () => {
    const runbook = readFileSync(
      join(repoRoot, 'docs/mobile/native-device-verification-runbook.md'),
      'utf8',
    );

    expect(runbook).toContain('## Android Build And Install');
    expect(runbook).toContain('## iOS Build And Install');
    expect(runbook).toContain('## Smoke Matrix');
    expect(runbook).toContain('## Deep Link Commands');
    expect(runbook).toContain('## Evidence Template');
    expect(runbook).toContain('adb shell am start');
    expect(runbook).toContain('xcrun simctl openurl');
    expect(runbook).toContain('Offline startup');
    expect(runbook).toContain('Keyboard safety');
  });
});
