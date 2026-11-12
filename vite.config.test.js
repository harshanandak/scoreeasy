// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VitePWA } from 'vite-plugin-pwa';

vi.mock('vite-plugin-pwa', () => ({ VitePWA: vi.fn(() => []) }));

describe('PWA update lifecycle', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('keeps the current version and its precache until the old clients close', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    await import('./vite.config.js');
    expect(VitePWA).toHaveBeenCalledTimes(1);
    const options = vi.mocked(VitePWA).mock.calls[0][0];
    expect(options.injectRegister).toBe(false);
    expect(options.registerType).toBe('prompt');
    expect(options.workbox.skipWaiting).toBe(false);
    expect(options.workbox.clientsClaim).toBe(false);
    expect(options.workbox.cleanupOutdatedCaches).toBe(true);
    expect(options.workbox.globPatterns).toContain('**/*.{js,css,html,svg,png,webp,woff2}');
    expect(options.workbox.navigateFallback).toBe('/index.html');
  });

  it('does not navigate open tabs when retiring a preview worker', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const { default: config } = await import('./vite.config.js');
    const cleanup = config.plugins.find((plugin) => plugin?.name === 'preview-service-worker-cleanup');
    const emitFile = vi.fn();
    cleanup.generateBundle.call({ emitFile });
    const source = emitFile.mock.calls[0][0].source;
    expect(source).toContain('self.registration.unregister()');
    expect(source).not.toMatch(/\.navigate\s*\(|location|reload/);
    expect(VitePWA).not.toHaveBeenCalled();
  });
});
