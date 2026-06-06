import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Android emulator QA helper', () => {
  it('documents executable emulator, install, and launch switches', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/mobile-android-env.ps1'), 'utf8');

    expect(script).toContain('[switch] $StartEmulator');
    expect(script).toContain('[switch] $WaitForBoot');
    expect(script).toContain('[switch] $InstallDebug');
    expect(script).toContain('[switch] $LaunchApp');
    expect(script).toContain('[switch] $WriteLocalProperties');
    expect(script).toContain('sdk.dir=');
    expect(script).toContain('swiftshader_indirect');
    expect(script).toContain('2>$null');
    expect(script).toContain("Invoke-AdbCapture -AdbArgs @('wait-for-device')");
    expect(script).toContain("Invoke-AdbCapture -AdbArgs @('shell', 'getprop', 'sys.boot_completed')");
    expect(script).toContain("Invoke-Adb -AdbArgs @('install', '-r', $apkPath)");
    expect(script).toContain("Invoke-Adb -AdbArgs @('shell', 'monkey', '-p', $PackageId, '1')");
    expect(script).toContain('app-debug.apk');
    expect(script).toContain('com.scoreeasy.app');
  });
});
