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

  it('falls back to clipboard when the Web Share API rejects with a non-cancel failure', async () => {
    const share = vi.fn().mockRejectedValue(new Error('Share transport unavailable'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share,
      clipboard: { writeText },
    });

    await expect(shareText({
      text: 'Falcons 2 - 1 Sharks',
      url: 'https://scoreeasy.example/match/1',
    })).resolves.toEqual({
      shared: true,
      method: 'clipboard',
    });
    expect(writeText).toHaveBeenCalledWith('Falcons 2 - 1 Sharks\nhttps://scoreeasy.example/match/1');
  });

  it('does not copy to clipboard when the Web Share API is cancelled', async () => {
    const abort = new Error('Share dismissed');
    abort.name = 'AbortError';
    const share = vi.fn().mockRejectedValue(abort);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share,
      clipboard: { writeText },
    });

    await expect(shareText({
      text: 'Falcons 2 - 1 Sharks',
      url: 'https://scoreeasy.example/match/1',
    })).resolves.toEqual({
      shared: false,
      method: 'web-share-cancelled',
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('returns a structured failure when clipboard fallback is blocked', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });

    await expect(shareText({ text: 'Final score: 25-20' })).resolves.toEqual({
      shared: false,
      method: 'clipboard-failed',
    });
  });

  it('copies URL-only payloads with the clipboard fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });

    await expect(shareText({ url: 'https://scoreeasy.example/match/1' })).resolves.toEqual({
      shared: true,
      method: 'clipboard',
    });
    expect(writeText).toHaveBeenCalledWith('https://scoreeasy.example/match/1');
  });
});
