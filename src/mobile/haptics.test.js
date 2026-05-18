import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hasNativePlugin: vi.fn(),
  impact: vi.fn(),
  isNativeMobile: vi.fn(),
  notification: vi.fn(),
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: mocks.impact,
    notification: mocks.notification,
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
  },
}));

vi.mock('./platform', () => ({
  hasNativePlugin: mocks.hasNativePlugin,
  isNativeMobile: mocks.isNativeMobile,
}));

import {
  correctionImpact,
  endMatchImpact,
  scoreImpact,
  warningImpact,
} from './haptics';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasNativePlugin.mockReturnValue(false);
  mocks.impact.mockResolvedValue(undefined);
  mocks.isNativeMobile.mockReturnValue(false);
  mocks.notification.mockResolvedValue(undefined);
});

function enableNativeHaptics() {
  mocks.hasNativePlugin.mockReturnValue(true);
  mocks.isNativeMobile.mockReturnValue(true);
}

describe('haptics', () => {
  it('does not call native haptics outside the native app shell', async () => {
    await expect(scoreImpact()).resolves.toBe(false);

    expect(mocks.impact).not.toHaveBeenCalled();
  });

  it('does not call native haptics when the plugin is unavailable', async () => {
    mocks.isNativeMobile.mockReturnValue(true);

    await expect(scoreImpact()).resolves.toBe(false);

    expect(mocks.impact).not.toHaveBeenCalled();
  });

  it('uses light impact feedback for scoring taps', async () => {
    enableNativeHaptics();

    await expect(scoreImpact()).resolves.toBe(true);

    expect(mocks.impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('uses medium impact feedback for corrections', async () => {
    enableNativeHaptics();

    await expect(correctionImpact()).resolves.toBe(true);

    expect(mocks.impact).toHaveBeenCalledWith({ style: 'MEDIUM' });
  });

  it('uses success notifications for completed matches', async () => {
    enableNativeHaptics();

    await expect(endMatchImpact()).resolves.toBe(true);

    expect(mocks.notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
  });

  it('uses warning notifications for blocked match-end actions', async () => {
    enableNativeHaptics();

    await expect(warningImpact()).resolves.toBe(true);

    expect(mocks.notification).toHaveBeenCalledWith({ type: 'WARNING' });
  });

  it('returns false when the native bridge rejects', async () => {
    enableNativeHaptics();
    mocks.impact.mockRejectedValue(new Error('bridge failed'));

    await expect(scoreImpact()).resolves.toBe(false);
  });
});
