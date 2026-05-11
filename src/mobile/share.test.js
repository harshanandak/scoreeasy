import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareText } from './share';

describe('shareText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects empty share payloads', async () => {
    await expect(shareText({})).resolves.toEqual({ shared: false, method: 'empty' });
  });

  it('uses the Web Share API when available outside native', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });

    await expect(shareText({ text: 'Final score: 25-20' })).resolves.toEqual({
      shared: true,
      method: 'web-share',
    });
    expect(share).toHaveBeenCalledWith({
      title: 'Score Easy',
      text: 'Final score: 25-20',
      url: undefined,
    });
  });
});
