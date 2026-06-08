import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Android emulator QA helper', () => {
  it('documents executable emulator, install, and launch switches', () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const script = readFileSync(resolve(repoRoot, 'scripts/mobile-android-env.ps1'), 'utf8');

    expect(script).toContain('[switch] $StartEmulator');
    expect(script).toContain('[switch] $WaitForBoot');
    expect(script).toContain('[switch] $InstallDebug');
    expect(script).toContain('[switch] $LaunchApp');
    expect(script).toContain('[switch] $WriteLocalProperties');
    expect(script).toContain('sdk.dir=');
    expect(script).toContain('swiftshader_indirect');
    expect(script).toContain('2>$null');
    expect(script).toContain('function Wait-ForNewAndroidDeviceSerial');
    expect(script).toContain('function Find-RunningAvdSerial');
    expect(script).toContain('Multiple Android devices are running');
    expect(script).toContain('Starting AVD');
    expect(script).not.toContain("Invoke-AdbCapture -AdbArgs @('wait-for-device')");
    expect(script).toContain("Invoke-AdbCapture -AdbArgs @('shell', 'getprop', 'sys.boot_completed')");
    expect(script).toContain("Invoke-Adb -AdbArgs @('install', '-r', $apkPath)");
    expect(script).toContain("Invoke-Adb -AdbArgs @('shell', 'monkey', '-p', $PackageId, '1')");
    expect(script).toContain('app-debug.apk');
    expect(script).toContain('com.scoreeasy.app');
  });
});
